const snippetPattern = /src="([^"]+)"[^>]*data-task-id="([^"]+)"[^>]*data-parent-origin="([^"]+)"/i

function configFromSnippet(snippet) {
  const match = snippetPattern.exec(snippet) || /data-task-id="([^"]+)"[^>]*data-parent-origin="([^"]+)"[^>]*src="([^"]+)"/i.exec(snippet)
  if (!match) return null
  if (match.length === 4 && match[1].includes('insightux-recorder')) {
    return { sdkSrc: match[1], taskId: match[2], parentOrigin: match[3] }
  }
  return { taskId: match[1], parentOrigin: match[2], sdkSrc: match[3] }
}

async function loadConfig() {
  const response = await fetch('/sdk-config')
  return response.json()
}

function fillForm(config) {
  document.querySelector('#task-id').value = config.taskId || ''
  document.querySelector('#parent-origin').value = config.parentOrigin || 'http://localhost:5173'
  document.querySelector('#sdk-src').value = config.sdkSrc || ''
  const status = document.querySelector('#sdk-status')
  status.className = `status ${config.taskId ? 'ok' : ''}`
  status.textContent = config.taskId
    ? `已接入任务 ${config.taskId}。请把 InsightUX 任务 URL 设为 ${location.origin}/`
    : '尚未接入。创建外部 URL 任务后，把生成的 script 标签粘贴到左侧。'
}

async function saveConfig(config) {
  const response = await fetch('/sdk-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || '保存失败')
  return payload
}

function bootInstall() {
  if (window.parent !== window) return
  const root = document.querySelector('#sdk-install')
  if (!root) return
  root.innerHTML = `<h2>InsightUX SDK 接入</h2>
    <div class="sdk-grid">
      <div>
        <p>1. 在 InsightUX 新建「外部网页 URL」任务，目标地址填写 <code>${location.origin}/</code>。</p>
        <p>2. 复制任务卡片中的 SDK 代码，粘贴到下面。</p>
        <label>SDK 代码<textarea id="snippet" rows="4" placeholder="粘贴 InsightUX 生成的 script 标签"></textarea></label>
        <div class="sdk-actions">
          <button class="btn btn-accent" id="parse-snippet" type="button">解析并保存</button>
          <button class="btn btn-ghost" id="clear-config" type="button">清除接入</button>
        </div>
      </div>
      <div>
        <label>任务 ID<input id="task-id" placeholder="创建任务后生成的 UUID"></label>
        <label>InsightUX 源<input id="parent-origin" placeholder="http://localhost:5173"></label>
        <label>SDK 地址<input id="sdk-src" placeholder="留空则使用 源/insightux-recorder.js"></label>
        <div class="sdk-actions">
          <button class="btn" id="save-config" type="button">保存配置</button>
        </div>
        <p class="sdk-hint">localhost 与 127.0.0.1 不是同一个源，必须和浏览器地址栏中的 InsightUX 完全一致。</p>
        <p id="sdk-status" class="status"></p>
      </div>
    </div>`

  const readForm = () => ({
    taskId: document.querySelector('#task-id').value,
    parentOrigin: document.querySelector('#parent-origin').value,
    sdkSrc: document.querySelector('#sdk-src').value
  })

  const report = async (action) => {
    const status = document.querySelector('#sdk-status')
    try {
      fillForm(await action())
    } catch (error) {
      status.className = 'status err'
      status.textContent = error.message
    }
  }

  document.querySelector('#parse-snippet').onclick = () => report(async () => {
    const parsed = configFromSnippet(document.querySelector('#snippet').value)
    if (!parsed) throw new Error('无法解析 script 标签，请粘贴任务界面生成的完整代码')
    return saveConfig(parsed)
  })
  document.querySelector('#save-config').onclick = () => report(() => saveConfig(readForm()))
  document.querySelector('#clear-config').onclick = () => report(async () => {
    const response = await fetch('/sdk-config', { method: 'DELETE' })
    return response.json()
  })
  loadConfig().then(fillForm).catch((error) => {
    document.querySelector('#sdk-status').textContent = error.message
  })
}

bootInstall()
