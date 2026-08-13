import { sessionsApi } from '../api/client.js'

const DB_NAME = 'insightux-upload'
const DB_VERSION = 2
const STORE = 'batches'
const META_STORE = 'meta'

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' })
        store.createIndex('sessionId', 'sessionId')
      }
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore(mode, operation) {
  const db = await openDb()
  try {
    const transaction = db.transaction(STORE, mode)
    const completion = new Promise((resolve, reject) => {
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    const result = await operation(transaction.objectStore(STORE))
    await completion
    return result
  } finally {
    db.close()
  }
}

export async function listPending(sessionId) {
  return withStore('readonly', async (store) => {
    const all = await requestResult(store.index('sessionId').getAll(sessionId))
    return all.sort((a, b) => a.createdAt - b.createdAt || a.sequence - b.sequence)
  })
}

export async function enqueueBatch(sessionId, uploadToken, stream, records) {
  if (!records.length) return null
  const db = await openDb()
  try {
    const transaction = db.transaction([STORE, META_STORE], 'readwrite')
    const completion = new Promise((resolve, reject) => {
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    const store = transaction.objectStore(STORE)
    const metaStore = transaction.objectStore(META_STORE)
    const metaKey = `${sessionId}:${stream}`
    const meta = await requestResult(metaStore.get(metaKey))
    const sequence = meta?.nextSequence || 0
    const batch = {
      key: `${sessionId}:${stream}:${sequence}`,
      sessionId,
      uploadToken,
      stream,
      sequence,
      records,
      attempts: 0,
      createdAt: Date.now()
    }
    store.put(batch)
    metaStore.put({ key: metaKey, nextSequence: sequence + 1 })
    await completion
    return batch
  } finally {
    db.close()
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => item === undefined ? 'null' : stableStringify(item)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

async function checksum(records) {
  const bytes = new TextEncoder().encode(stableStringify(records))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function syncPending(sessionId) {
  const batches = await listPending(sessionId)
  for (const batch of batches) {
    try {
      await sessionsApi.uploadBatch(sessionId, batch.uploadToken, {
        stream: batch.stream,
        sequence: batch.sequence,
        records: batch.records,
        checksum: await checksum(batch.records)
      })
      await withStore('readwrite', async (store) => store.delete(batch.key))
    } catch (error) {
      await withStore('readwrite', async (store) => {
        store.put({ ...batch, attempts: batch.attempts + 1, lastError: error.message, updatedAt: Date.now() })
      })
      throw error
    }
  }
  return { synced: batches.length }
}

export async function pendingCount(sessionId) {
  return (await listPending(sessionId)).length
}
