import { ApiError } from '../api/apiErrors'
import { withFailureSimulation, type FailureConfig } from '../api/failureSimulation'
import type { ReportApi } from '../delivery/deliveryTypes'
import { createUploadWorker } from '../delivery/uploadWorker'
import { FakeServer, InMemoryRepository, makeReport } from './fakes'

// These tests drive the real upload worker with no React component mounted

const setup = (options: { api?: (server: FakeServer) => ReportApi; idleMs?: number } = {}) => {
  const server = new FakeServer()
  const repository = new InMemoryRepository()
  const clock = { now: 10_000 }
  const deleted: string[] = []
  const worker = createUploadWorker({
    repository,
    api: options.api ? options.api(server) : server.api,
    now: () => clock.now,
    random: () => 0.5, // no jitter, so delays are exact
    requestIdleTimeoutMs: options.idleMs ?? 1_000,
    deleteLocalFiles: async paths => {
      deleted.push(...paths)
    },
  })
  // Runs the worker until nothing is due, advancing the clock past each scheduled retry
  const runUntilSettled = async (maxRounds = 10) => {
    for (let round = 0; round < maxRounds; round++) {
      await worker.run()
      const next = await repository.nextScheduledAttemptAt()
      if (next === null) {
        return
      }
      clock.now = Math.max(clock.now, next)
    }
  }
  return { server, repository, clock, worker, deleted, runUntilSettled }
}

// Failure simulation with a local config, so tests do not share global state
const simulated = (initial: Partial<FailureConfig>) => {
  let config: FailureConfig = { mode: 'off', target: 'any', remaining: 1, latencyMs: 0, ...initial }
  return (server: FakeServer) => withFailureSimulation(server.api, () => config, next => {
    config = { ...config, ...next }
  })
}

describe('upload worker', () => {
  test('uploads every image, finalizes once, and reconciles before deleting local files', async () => {
    const { server, repository, worker, deleted } = setup()
    const report = makeReport(server, 3)
    repository.add(report)

    await worker.run()

    expect(repository.get(report.clientReportId).status).toBe('uploaded')
    expect(server.reports.size).toBe(1)
    expect(server.objects.size).toBe(3)
    expect(server.createCalls).toEqual([report.clientReportId])
    expect(deleted.sort()).toEqual(report.images.map(image => image.localPath).sort())
  })

  test('commit-then-lost-response is retried with the same key and resolves to one server report', async () => {
    const { server, repository, runUntilSettled } = setup({
      api: simulated({ mode: 'drop_after_commit', target: 'createOrResolveReport' }),
    })
    const report = makeReport(server, 2)
    repository.add(report)

    await runUntilSettled()

    expect(server.createCalls).toEqual([report.clientReportId, report.clientReportId])
    expect(server.reports.size).toBe(1)
    expect(repository.get(report.clientReportId).status).toBe('uploaded')
  })

  test('two dropped connections mid-upload: retried with backoff, no duplicate images', async () => {
    const { server, repository, clock, worker, runUntilSettled } = setup({
      api: simulated({ mode: 'drop_before_request', target: 'uploadImage', remaining: 2 }),
    })
    const report = makeReport(server, 3)
    repository.add(report)

    await worker.run()
    let stored = repository.get(report.clientReportId)
    expect(stored.status).toBe('retry_scheduled')
    expect(stored.nextAttemptAt).toBe(clock.now + 2_000)
    expect(repository.lastError.get(report.clientReportId)).toBe('network')

    clock.now = stored.nextAttemptAt as number
    await worker.run()
    stored = repository.get(report.clientReportId)
    expect(stored.status).toBe('retry_scheduled')
    expect(stored.nextAttemptAt).toBe(clock.now + 4_000)

    await runUntilSettled()
    expect(repository.get(report.clientReportId).status).toBe('uploaded')
    expect(server.reports.size).toBe(1)
    expect(server.objects.size).toBe(3)
    for (const object of server.objects.values()) {
      expect(object.writes).toBe(1)
    }
  })

  test('images confirmed in an earlier attempt are not sent again', async () => {
    const { server, repository, runUntilSettled } = setup({
      api: simulated({ mode: 'server_error', target: 'createOrResolveReport' }),
    })
    const report = makeReport(server, 3)
    repository.add(report)

    await runUntilSettled()

    expect(server.uploadCalls).toHaveLength(3)
    expect(repository.get(report.clientReportId).status).toBe('uploaded')
  })

  test('a hanging request times out and is retried safely with the same idempotency key', async () => {
    const { server, repository, worker, runUntilSettled } = setup({
      idleMs: 20,
      api: simulated({ mode: 'hang', target: 'createOrResolveReport' }),
    })
    const report = makeReport(server, 1)
    repository.add(report)

    await worker.run()
    expect(repository.get(report.clientReportId).status).toBe('retry_scheduled')
    expect(repository.lastError.get(report.clientReportId)).toBe('timeout')

    await runUntilSettled()
    expect(repository.get(report.clientReportId).status).toBe('uploaded')
    expect(server.reports.size).toBe(1)
  })

  test('a permanent validation error needs attention and is not retried automatically', async () => {
    const { server, repository, clock, worker } = setup({
      api: simulated({ mode: 'validation_error', target: 'createOrResolveReport' }),
    })
    const report = makeReport(server, 1)
    repository.add(report)

    await worker.run()
    clock.now += 60 * 60_000
    await worker.run()

    expect(repository.get(report.clientReportId).status).toBe('needs_attention')
    expect(server.createCalls).toHaveLength(0)
  })

  test('manual retry resets backoff and delivers a needs-attention report', async () => {
    const { server, repository, worker } = setup({
      api: simulated({ mode: 'validation_error', target: 'createOrResolveReport' }),
    })
    const report = makeReport(server, 1)
    repository.add(report)
    await worker.run()
    expect(repository.get(report.clientReportId).consecutiveFailures).toBe(1)

    await worker.retryNow(report.clientReportId)

    expect(repository.get(report.clientReportId).status).toBe('uploaded')
    expect(repository.get(report.clientReportId).consecutiveFailures).toBe(0)
  })

  test('permission errors (401/403 equivalent) are surfaced instead of retried', async () => {
    const { server, repository, worker } = setup({
      api: fake => ({ ...fake.api, uploadImage: async () => { throw new ApiError('permission', 'denied') } }),
    })
    const report = makeReport(server, 1)
    repository.add(report)

    await worker.run()

    expect(repository.get(report.clientReportId).status).toBe('needs_attention')
    expect(repository.lastError.get(report.clientReportId)).toBe('permission')
  })

  test('a report is not finalized while an image is missing on the server', async () => {
    const { server, repository, worker, runUntilSettled } = setup({
      api: fake => {
        let lose = true
        return {
          ...fake.api,
          uploadImage: async (input, ctx) => {
            const result = await fake.api.uploadImage(input, ctx)
            if (lose) {
              lose = false
              fake.objects.delete(result.remotePath) // server lost the object
            }
            return result
          },
        }
      },
    })
    const report = makeReport(server, 2)
    repository.add(report)

    await worker.run()
    expect(server.createCalls).toHaveLength(0)
    expect(repository.get(report.clientReportId).images[0].status).toBe('ready')

    await runUntilSettled()
    expect(repository.get(report.clientReportId).status).toBe('uploaded')
    expect(server.objects.size).toBe(2)
  })

  test('a stored image that does not match the local file blocks finalization', async () => {
    const { server, repository, worker } = setup()
    const report = makeReport(server, 1)
    server.localSizes.set(report.images[0].localPath, 123) // server receives different bytes
    repository.add(report)

    await worker.run()

    expect(repository.get(report.clientReportId).status).toBe('needs_attention')
    expect(repository.lastError.get(report.clientReportId)).toBe('verification_failed')
    expect(server.reports.size).toBe(0)
  })

  test('overlapping triggers do not run concurrent uploads for the same report', async () => {
    const { server, repository, worker } = setup({ api: simulated({ mode: 'latency', latencyMs: 10, remaining: null }) })
    const report = makeReport(server, 2)
    repository.add(report)

    await Promise.all([worker.run(), worker.run(), worker.run()])

    expect(server.uploadCalls).toHaveLength(2)
    expect(server.createCalls).toHaveLength(1)
  })

  test('a second worker cannot claim a report leased by the first', async () => {
    const { server, repository, worker } = setup({ api: simulated({ mode: 'latency', latencyMs: 10, remaining: null }) })
    const other = createUploadWorker({ repository, api: server.api, now: () => 10_000 })
    const report = makeReport(server, 1)
    repository.add(report)

    await Promise.all([worker.run(), other.run()])

    expect(server.uploadCalls).toHaveLength(1)
    expect(server.reports.size).toBe(1)
  })

  test('after a force-quit, a stale uploading report is recovered and delivered once', async () => {
    const { server, repository, clock, worker } = setup()
    const report = makeReport(server, 2, { status: 'uploading', leaseExpiresAt: 10_000 + 60_000 })
    repository.add(report)

    await worker.run()
    expect(server.uploadCalls).toHaveLength(0) // lease still held, nothing runs

    expect(await repository.recoverInterruptedUploads(clock.now)).toBe(1)
    await worker.run()
    expect(repository.get(report.clientReportId).status).toBe('uploaded')
    expect(server.reports.size).toBe(1)
  })

  test('every client report UUID maps to exactly one server report', async () => {
    const { server, repository, runUntilSettled } = setup({
      api: simulated({ mode: 'drop_after_commit', target: 'any', remaining: 4 }),
    })
    const reports = [makeReport(server, 5), makeReport(server, 1), makeReport(server, 3)]
    reports.forEach(report => repository.add(report))

    await runUntilSettled(20)

    expect([...server.reports.keys()].sort()).toEqual(reports.map(r => r.clientReportId).sort())
    expect(server.objects.size).toBe(9)
    for (const report of reports) {
      expect(repository.get(report.clientReportId).status).toBe('uploaded')
    }
  })

  test('does not start attempts when the connectivity hint says offline', async () => {
    const server = new FakeServer()
    const repository = new InMemoryRepository()
    const worker = createUploadWorker({ repository, api: server.api, canAttempt: () => false })
    const report = makeReport(server, 1)
    repository.add(report)

    await worker.run()

    expect(repository.get(report.clientReportId).status).toBe('queued')
    expect(server.uploadCalls).toHaveLength(0)
  })
})
