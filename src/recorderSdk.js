import { record } from 'rrweb'

export const RECORDER_CHANNEL = 'insightux-recorder'
export const RECORDER_VERSION = '1.0.0'

const limits = { maxEvents: 10000, maxBytes: 10 * 1024 * 1024, batchSize: 100 }

export function createRecorderBridge({ windowObject, taskId, parentOrigin = '', recordFunction = record }) {
  let stop = null
  let nonce = ''
  let batch = []
  let eventCount = 0
  let estimatedBytes = 0
  let timer = null

  const post = (type, payload = {}) => {
    windowObject.parent.postMessage({
      channel: RECORDER_CHANNEL, type, taskId, version: RECORDER_VERSION, nonce, ...payload
    }, parentOrigin || '*')
  }

  const flush = () => {
    if (batch.length === 0) return
    post('EVENT_BATCH', { events: batch })
    batch = []
  }

  const finish = (reason = 'manual') => {
    if (!stop) return
    stop()
    stop = null
    if (timer) windowObject.clearInterval(timer)
    timer = null
    flush()
    post('STOPPED', { reason, eventCount })
  }

  const begin = (message) => {
    if (stop) return
    nonce = String(message.nonce || '')
    if (!nonce) return
    batch = []
    eventCount = 0
    estimatedBytes = 0
    stop = recordFunction({
      emit(event) {
        const bytes = JSON.stringify(event).length
        eventCount += 1
        estimatedBytes += bytes
        batch.push(event)
        if (batch.length >= limits.batchSize) flush()
        if (eventCount >= limits.maxEvents) finish('maxEvents')
        else if (estimatedBytes >= limits.maxBytes) finish('maxDataSize')
      },
      maskTextSensitive: true,
      maskAllInputs: true,
      sampling: { mousemove: 50, mouseInteraction: true, scroll: 100, input: 'last', media: 800 },
      checkoutEveryNms: 5000
    })
    timer = windowObject.setInterval(flush, 500)
    post('STARTED')
  }

  const onMessage = (event) => {
    if (event.source !== windowObject.parent) return
    if (parentOrigin && event.origin !== parentOrigin) return
    const message = event.data
    if (message?.channel !== RECORDER_CHANNEL || message.taskId !== taskId) return
    if (message.type === 'START') begin(message)
    if (message.type === 'STOP' && stop && message.nonce === nonce) finish('manual')
  }

  windowObject.addEventListener('message', onMessage)
  post('READY')
  return {
    destroy() {
      finish('destroyed')
      windowObject.removeEventListener('message', onMessage)
    }
  }
}

function boot() {
  const script = document.currentScript || [...document.scripts].find((item) => item.src.includes('insightux-recorder'))
  const taskId = script?.dataset.taskId || ''
  const parentOrigin = script?.dataset.parentOrigin || ''
  if (!taskId || window.parent === window) return
  createRecorderBridge({ windowObject: window, taskId, parentOrigin })
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') boot()
