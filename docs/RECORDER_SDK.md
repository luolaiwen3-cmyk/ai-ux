# InsightUX Recorder SDK 接入指南

本文面向需要把自有网页作为 InsightUX 测试目标的前端和部署人员。Recorder SDK 在目标网页的 iframe 中运行，采集 rrweb 行为事件，并通过受校验的 `postMessage` 协议交给 InsightUX 测试容器。

当前协议版本：`1.0.0`。

## 1. 适用范围

URL 任务只适用于满足以下条件的网站：

- 研究方可以修改目标网页并加入 SDK `<script>` 标签。
- 目标网页允许被 InsightUX 通过 iframe 嵌入。
- 测试期间页面保持在任务配置 URL 的同一源中。
- 生产环境目标 URL 使用 HTTPS。

SDK 不负责抓取或代理第三方网站，也不能绕过目标网站的 CSP、`X-Frame-Options`、登录策略或浏览器同源限制。无法修改的第三方网站目前不能作为完整录制的 URL 任务。

如果网页可以打包为纯静态文件，优先使用“上传网站 ZIP”。InsightUX 会为 ZIP 页面自动注入 SDK，无需手工接入。

## 2. 快速接入

### 2.1 创建 URL 任务

1. 登录 InsightUX 分析工作台，进入“任务管理”。
2. 新建任务，在“测试网页”步骤选择“外部网页 URL”。
3. 填写目标网页的完整 URL 并创建草稿。
4. 在任务卡片点击“接入并验证”，复制系统生成的代码。

界面生成的代码是该任务的唯一权威版本，结构如下：

```html
<script
  src="https://insightux.example.com/insightux-recorder.js"
  data-task-id="TASK_UUID"
  data-parent-origin="https://insightux.example.com"
></script>
```

字段含义：

| 属性 | 必填 | 说明 |
|---|---:|---|
| `src` | 是 | 当前 InsightUX 部署提供的稳定 SDK 地址。不要复制到第三方 CDN。 |
| `data-task-id` | 是 | 创建任务后生成的任务 UUID，必须与当前任务完全一致。 |
| `data-parent-origin` | 是 | InsightUX 被试端的源，仅包含协议、主机和端口，不包含路径或末尾 `/`。 |

推荐把代码原样放在目标页面 `</body>` 之前，不要修改任务 ID，也不要添加会改变执行来源或时机的包装加载器。

### 2.2 配置目标网站响应头

目标网页必须允许 InsightUX 嵌入和加载 SDK。使用 CSP 时，可按部署域名配置：

```http
Content-Security-Policy: frame-ancestors https://insightux.example.com; script-src 'self' https://insightux.example.com
```

同时注意：

- 不要返回 `X-Frame-Options: DENY`。
- 跨源部署通常也不能使用 `X-Frame-Options: SAMEORIGIN`；应通过 CSP `frame-ancestors` 精确允许 InsightUX。
- 如果已有 CSP，只合并所需来源，不要用上面的示例覆盖其他业务指令。
- 页面中的 Cookie、登录和第三方存储仍受浏览器 iframe/第三方 Cookie 策略约束。

### 2.3 验证并发布

部署目标网页后，在任务卡片点击“接入并验证”。InsightUX 会：

1. 在受控 iframe 中加载任务 URL。
2. 等待 SDK 发出 `READY` 消息。
3. 校验 iframe 窗口、页面源、任务 ID和 SDK 版本。
4. 在 10 秒内握手成功后，将任务标记为“已验证”。

只有已验证任务才能发布或试跑。修改任务 URL 会立即撤销原验证结果；如果任务正在发布，会退回草稿，必须重新验证。

## 3. 页面和路由要求

### 单页应用

React、Vue 等 SPA 只需在入口 HTML 中加载一次 SDK。客户端路由切换不会中断当前录制。

### 多页应用

发生完整页面跳转时，新页面必须再次包含同一任务的 SDK 标签。所有测试页面应保持同源；跳转到另一个源后，InsightUX 会拒绝该页面的消息，后续行为不会进入当前录制。

### iframe sandbox 限制

URL 页面运行于以下权限范围：

```text
allow-scripts allow-forms allow-modals allow-popups allow-same-origin
```

因此依赖顶层窗口导航、自动下载、弹出窗口反向控制父页面等能力的流程可能无法正常工作。目标页面不应尝试访问或修改 InsightUX 父页面 DOM。

## 4. 数据采集行为

SDK 基于 rrweb 记录当前目标文档，主要包括：

- DOM 全量快照及后续 DOM 变化。
- 鼠标点击、移动和页面滚动。
- 表单交互、媒体状态及页面变化。
- 每 5 秒生成一次用于稳定回放的全量快照。

默认隐私设置：

- `maskTextSensitive: true`
- `maskAllInputs: true`
- 不采集麦克风。
- SDK 自身不访问摄像头；面部数据由 InsightUX 父页面在被试授权后独立采集。
- SDK 不直接调用 InsightUX API，而是把事件批次发送给父测试容器。

采样与上限：

| 项目 | 当前值 |
|---|---:|
| 鼠标移动采样 | 每 50 ms |
| 滚动采样 | 每 100 ms |
| 媒体采样 | 每 800 ms |
| 单批最大事件数 | 100 |
| 定时刷新间隔 | 500 ms |
| 单次录制最大事件数 | 10,000 |
| SDK 估算数据上限 | 10 MiB |

达到事件或数据上限时，SDK 会先发送剩余事件，再以 `maxEvents` 或 `maxDataSize` 原因结束录制。父容器仍允许提交已经采集的数据。

## 5. 消息协议

普通接入方无需自行实现消息协议。以下内容用于安全审计、排障或开发兼容测试容器。

所有消息都包含：

```js
{
  channel: 'insightux-recorder',
  type: 'READY',
  taskId: 'TASK_UUID',
  version: '1.0.0',
  nonce: ''
}
```

完整时序：

```text
目标网页 SDK                     InsightUX 父容器
     │                                  │
     ├──────── READY ──────────────────>│ 校验窗口、源、任务和版本
     │<─────── START + nonce ───────────┤
     ├──────── STARTED + nonce ────────>│
     ├──────── EVENT_BATCH ────────────>│ 每 100 条或 500 ms
     │<─────── STOP + nonce ────────────┤ 被试点击“完成测试”
     ├──────── EVENT_BATCH ────────────>│ 刷新尾部事件
     └──────── STOPPED ────────────────>│
```

| `type` | 方向 | 关键字段 | 说明 |
|---|---|---|---|
| `READY` | SDK → 父容器 | `taskId`, `version` | SDK 已加载，尚未开始录制。 |
| `START` | 父容器 → SDK | `taskId`, `nonce` | 通过随机 nonce 授权本次录制。 |
| `STARTED` | SDK → 父容器 | `nonce` | rrweb 已启动。 |
| `EVENT_BATCH` | SDK → 父容器 | `nonce`, `events` | 当前 rrweb 事件批次。 |
| `STOP` | 父容器 → SDK | `nonce` | 请求停止并刷新剩余事件。 |
| `STOPPED` | SDK → 父容器 | `nonce`, `reason`, `eventCount` | 录制已结束。 |

SDK 只接受来自 `window.parent`、来源等于 `data-parent-origin`、频道和任务 ID 匹配的消息。录制开始后，`STOP` 的 nonce 还必须与当前会话一致。父容器也会反向校验 iframe 窗口、目标源、任务 ID、版本和 nonce。

## 6. 本地开发

默认开发地址：

- InsightUX 前端：`http://localhost:5173`
- InsightUX API：`http://localhost:8787`
- SDK：`http://localhost:5173/insightux-recorder.js`（由 Vite 代理到 API 服务）

本地目标网站使用其他端口时，仍属于不同源。请确保 `data-parent-origin` 与浏览器地址栏中的 InsightUX 源完全一致。例如 `localhost` 与 `127.0.0.1` 是不同主机，不能混用。

运行 SDK 和完整网页任务测试：

```bash
npm test
npm run test:e2e
```

生产构建会额外生成稳定文件：

```text
dist/insightux-recorder.js
```

## 7. 常见问题

### 10 秒后提示“无法连接录制 SDK”

依次检查：

1. 页面源代码中是否存在当前任务生成的 `<script>`。
2. SDK 请求是否返回 JavaScript，而不是登录页、404 或反向代理的 HTML。
3. `data-task-id` 是否属于当前任务。
4. `data-parent-origin` 是否与当前 InsightUX 地址的协议、主机和端口完全一致。
5. 浏览器控制台是否有 CSP、Mixed Content 或脚本加载错误。
6. 目标响应是否被 `X-Frame-Options` 或 CSP `frame-ancestors` 阻止。

### 页面可以预览，但任务不能发布

“能在 iframe 中显示”不等于“SDK 握手成功”。任务必须收到版本为 `1.0.0`、任务 ID 和目标源均匹配的 `READY` 消息，服务端才会保存验证结果。

### 页面内部点击没有进入回放

检查测试时是否显示“测试记录中”和事件数；如果事件数始终为 0，通常是 SDK 未收到 `START`，原因多为 `data-parent-origin` 不匹配或页面在验证后跳转到了另一个源。

### 修改网页内容后是否要重新验证

只修改同一 URL 下的页面内容不会自动撤销验证，但上线前应主动点击“重新验证”并完成一次试跑。修改任务 URL 会强制撤销验证。

### SDK 是否可以独立初始化

不可以。SDK 只在页面被 iframe 嵌入且存在有效 `data-task-id` 时初始化；它必须收到 InsightUX 父容器携带随机 nonce 的 `START` 消息后才开始录制。直接在普通浏览器标签页打开目标网页不会启动采集。

## 8. 版本升级

任务验证会检查 SDK 协议版本。升级 InsightUX 后应使用当前部署在任务界面生成的新代码，并对已有 URL 任务执行“重新验证”和试跑。不要把旧版本 SDK 文件长期缓存到自有 CDN。

实现源码见 [`src/recorderSdk.js`](../src/recorderSdk.js)，协议自动化测试见 [`test/recorder-sdk.test.js`](../test/recorder-sdk.test.js)。

