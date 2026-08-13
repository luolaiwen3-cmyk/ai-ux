import { createServer } from 'node:http'

const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:8899')
  if (url.pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok')
    return
  }
  const taskId = url.searchParams.get('taskId') || ''
  const sdk = url.pathname === '/no-sdk' ? '' : `<script src="http://127.0.0.1:5173/insightux-recorder.js" data-task-id="${taskId}" data-parent-origin="http://127.0.0.1:5173"></script>`
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(`<!doctype html><html><head>${sdk}</head><body><h1>External test target</h1><button id="external-action">External action</button></body></html>`)
})

server.listen(8899, '127.0.0.1')
const stop = () => server.close(() => process.exit(0))
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

