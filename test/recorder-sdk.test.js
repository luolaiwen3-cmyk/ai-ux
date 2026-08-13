import assert from 'node:assert/strict'
import test from 'node:test'
import { createRecorderBridge, RECORDER_CHANNEL } from '../src/recorderSdk.js'

test('录制 SDK 校验父窗口来源、任务和 nonce 并批量停止', () => {
  const parent = { postMessageCalls: [], postMessage(message, origin) { this.postMessageCalls.push({ message, origin }) } }
  const listeners = new Map()
  const windowObject = {
    parent,
    addEventListener(type, listener) { listeners.set(type, listener) },
    removeEventListener(type) { listeners.delete(type) },
    setInterval() { return 1 },
    clearInterval() {}
  }
  let emit
  let stopped = false
  const bridge = createRecorderBridge({
    windowObject, taskId: 'task-1', parentOrigin: 'https://insight.test',
    recordFunction(options) { emit = options.emit; return () => { stopped = true } }
  })
  assert.equal(parent.postMessageCalls[0].message.type, 'READY')
  assert.equal(parent.postMessageCalls[0].origin, 'https://insight.test')

  const send = (data, origin = 'https://insight.test') => listeners.get('message')({ source: parent, origin, data })
  send({ channel: RECORDER_CHANNEL, type: 'START', taskId: 'task-1', nonce: 'wrong-origin' }, 'https://attacker.test')
  assert.equal(emit, undefined)
  send({ channel: RECORDER_CHANNEL, type: 'START', taskId: 'other', nonce: 'wrong-task' })
  assert.equal(emit, undefined)
  send({ channel: RECORDER_CHANNEL, type: 'START', taskId: 'task-1', nonce: 'n-1' })
  assert.equal(typeof emit, 'function')
  emit({ type: 0, timestamp: 1, data: {} })
  send({ channel: RECORDER_CHANNEL, type: 'STOP', taskId: 'task-1', nonce: 'wrong' })
  assert.equal(stopped, false)
  send({ channel: RECORDER_CHANNEL, type: 'STOP', taskId: 'task-1', nonce: 'n-1' })
  assert.equal(stopped, true)
  assert.equal(parent.postMessageCalls.at(-2).message.type, 'EVENT_BATCH')
  assert.equal(parent.postMessageCalls.at(-1).message.type, 'STOPPED')
  bridge.destroy()
})

