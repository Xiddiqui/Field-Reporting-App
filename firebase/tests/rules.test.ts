/**
 * Backend integration tests against the Firebase Emulator Suite (Firestore + Storage rules).
 * Run with: npm run test:backend
 *
 * createOrResolve() below is the same transaction the app runs in src/api/firebaseReportApi.ts,
 * written against the web SDK because the React Native SDK cannot run in Node.
 */
// The test library hands out compat instances, so the compat modules must be registered
import 'firebase/compat/firestore'
import 'firebase/compat/storage'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore'
import { ref, uploadBytes, type FirebaseStorage } from 'firebase/storage'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const REPORT_ID = '0b9f2d0e-6a51-4c39-9a7e-7f3c1f0e2a11'
const IMAGE_ID = '5d1c6a3e-2b7f-4e8a-9c0d-3e4f5a6b7c8d'

let env: RulesTestEnvironment
let db: Firestore
let storage: FirebaseStorage

const image = (reportId = REPORT_ID, imageId = IMAGE_ID, sizeBytes = 1024) => ({
  imageId,
  path: `reports/${reportId}/${imageId}.jpg`,
  url: 'https://example.invalid/image.jpg',
  sizeBytes,
  mimeType: 'image/jpeg',
  width: 1600,
  height: 1200,
})

const report = (overrides: Record<string, unknown> = {}) => ({
  clientReportId: REPORT_ID,
  description: 'Crack in the north retaining wall',
  imageCount: 1,
  images: [image()],
  reportedAt: 1_760_000_000_000,
  createdAt: serverTimestamp(),
  ...overrides,
})

const createOrResolve = async (id: string, data: Record<string, unknown>) => {
  const reportRef = doc(db, 'reports', id)
  await runTransaction(db, async transaction => {
    const existing = await transaction.get(reportRef)
    if (!existing.exists()) {
      transaction.set(reportRef, data)
    }
  })
  return getDoc(reportRef)
}

const jpeg = (bytes: number) => {
  const data = new Uint8Array(bytes)
  data.set([0xff, 0xd8, 0xff, 0xe0])
  return data
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-field-reporting',
    firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve(__dirname, '../storage.rules'), 'utf8') },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.clearStorage()
  const context = env.unauthenticatedContext()
  db = context.firestore() as unknown as Firestore
  storage = context.storage() as unknown as FirebaseStorage
})

afterAll(async () => {
  await env?.cleanup()
})

describe('report idempotency', () => {
  test('a valid report is created once', async () => {
    const snapshot = await assertSucceeds(createOrResolve(REPORT_ID, report()))
    expect(snapshot.exists()).toBe(true)
  })

  test('duplicate submissions resolve to the existing report instead of creating another', async () => {
    const first = await createOrResolve(REPORT_ID, report())
    const second = await createOrResolve(REPORT_ID, report({ description: 'retried with different text' }))
    expect(second.data()?.description).toBe(first.data()?.description)
    expect(second.data()?.createdAt.toMillis()).toBe(first.data()?.createdAt.toMillis())
    expect((await getDocs(collection(db, 'reports'))).size).toBe(1)
  })

  test('commit followed by a lost response: the retry reconciles the committed report', async () => {
    // Attempt 1 commits on the server, but the client never sees the result
    await createOrResolve(REPORT_ID, report()).catch(() => undefined)
    // Attempt 2 uses the same idempotency key
    const retried = await createOrResolve(REPORT_ID, report())
    expect(retried.id).toBe(REPORT_ID)
    expect((await getDocs(collection(db, 'reports'))).size).toBe(1)
  })

  test('a blind overwrite or update of a finalized report is rejected', async () => {
    await createOrResolve(REPORT_ID, report())
    await assertFails(setDoc(doc(db, 'reports', REPORT_ID), report()))
    await assertFails(updateDoc(doc(db, 'reports', REPORT_ID), { description: 'changed' }))
  })
})

describe('report validation', () => {
  const rejects = (data: Record<string, unknown>, id = REPORT_ID) => assertFails(setDoc(doc(db, 'reports', id), data))

  test('blank description', () => rejects(report({ description: '   ' })))
  test('zero images', () => rejects(report({ imageCount: 0, images: [] })))
  test('six images', () => {
    const six = Array.from({ length: 6 }, (_, i) => image(REPORT_ID, `5d1c6a3e-2b7f-4e8a-9c0d-3e4f5a6b7c8${i}`))
    return rejects(report({ imageCount: 6, images: six }))
  })
  test('image count that does not match the images', () => rejects(report({ imageCount: 2 })))
  test('image over 5 MiB', () => rejects(report({ images: [image(REPORT_ID, IMAGE_ID, MAX_IMAGE_BYTES + 1)] })))
  test('image path outside the report', () =>
    rejects(report({ images: [{ ...image(), path: `reports/other/${IMAGE_ID}.jpg` }] })))
  test('clientReportId that differs from the document id', () =>
    rejects(report(), '9a9a9a9a-6a51-4c39-9a7e-7f3c1f0e2a11'))
  test('client-supplied creation time', () => rejects(report({ createdAt: new Date() })))

  test('five images are accepted', async () => {
    const five = Array.from({ length: 5 }, (_, i) => image(REPORT_ID, `5d1c6a3e-2b7f-4e8a-9c0d-3e4f5a6b7c8${i}`))
    await assertSucceeds(setDoc(doc(db, 'reports', REPORT_ID), report({ imageCount: 5, images: five })))
  })
})

describe('image uploads', () => {
  const imageRef = (imageId = IMAGE_ID) => ref(storage, `reports/${REPORT_ID}/${imageId}.jpg`)

  test('a JPEG at exactly 5 MiB is accepted', () =>
    assertSucceeds(uploadBytes(imageRef(), jpeg(MAX_IMAGE_BYTES), { contentType: 'image/jpeg' })))

  test('a JPEG one byte over 5 MiB is rejected', () =>
    assertFails(uploadBytes(imageRef(), jpeg(MAX_IMAGE_BYTES + 1), { contentType: 'image/jpeg' })))

  test('a non-JPEG content type is rejected', () =>
    assertFails(uploadBytes(imageRef(), jpeg(1024), { contentType: 'image/png' })))

  test('re-uploading the same image key replaces it instead of adding a record', async () => {
    await assertSucceeds(uploadBytes(imageRef(), jpeg(1024), { contentType: 'image/jpeg' }))
    await assertSucceeds(uploadBytes(imageRef(), jpeg(2048), { contentType: 'image/jpeg' }))
  })

  test('images cannot be replaced once the report is finalized', async () => {
    await createOrResolve(REPORT_ID, report())
    await assertFails(uploadBytes(imageRef(), jpeg(1024), { contentType: 'image/jpeg' }))
  })
})
