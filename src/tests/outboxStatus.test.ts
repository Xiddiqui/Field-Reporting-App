import { describeOutboxStatus, type OutboxStatusInput } from '../features/outbox/outboxStatus'

const input = (overrides: Partial<OutboxStatusInput>): OutboxStatusInput => ({
  status: 'queued',
  imageStatuses: ['ready'],
  lastErrorMessage: null,
  nextAttemptAt: null,
  serverReportId: null,
  ...overrides,
})

describe('outbox status wording', () => {
  test('queued while offline reads as waiting for connection', () => {
    expect(describeOutboxStatus(input({}), false, undefined, 0).label).toBe('Waiting for connection')
    expect(describeOutboxStatus(input({}), true, undefined, 0).label).toBe('Saved locally')
  })

  test('only a server-confirmed report reads as uploaded', () => {
    const labels = (['preparing', 'queued', 'uploading', 'retry_scheduled', 'needs_attention'] as const)
      .map(status => describeOutboxStatus(input({ status }), true, undefined, 0).label)
    expect(labels).not.toContain('Uploaded')
    expect(describeOutboxStatus(input({ status: 'uploaded', serverReportId: 'abc' }), true, undefined, 0).label).toBe('Uploaded')
  })

  test('upload progress never shows a full bar before confirmation', () => {
    const status = describeOutboxStatus(
      input({ status: 'uploading' }),
      true,
      { clientReportId: 'x', imageIndex: 0, imageCount: 1, imageFraction: 1, stage: 'finalizing' },
      0,
    )
    expect(status.progress).toBeLessThan(1)
    expect(status.detail).toMatch(/confirm/i)
  })

  test('retry scheduled shows the countdown and allows manual retry', () => {
    const status = describeOutboxStatus(input({ status: 'retry_scheduled', nextAttemptAt: 12_000, lastErrorMessage: 'Could not reach the server.' }), true, undefined, 2_000)
    expect(status).toMatchObject({ label: 'Retry scheduled', canRetry: true })
    expect(status.detail).toContain('10s')
  })

  test('needs attention explains the error and allows manual retry', () => {
    expect(describeOutboxStatus(input({ status: 'needs_attention', lastErrorMessage: 'Rejected' }), true, undefined, 0))
      .toMatchObject({ label: 'Needs attention', detail: 'Rejected', canRetry: true, tone: 'error' })
  })
})
