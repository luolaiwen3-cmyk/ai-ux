# InsightUX

InsightUX 是一个面向 UX 研究员的私有化用户测试平台。研究员创建任务并发布匿名链接；被试授权后完成测试，浏览器同步采集 rrweb 行为事件与 MediaPipe 面部特征；研究员可以回放会话、查看确定性指标、运行 Qwen 多模态诊断并分享报告。

## 已实现能力

- 管理员登录与服务端接口鉴权
- 任务创建、编辑、发布、暂停和真实 Token 链接
- 内置模板、静态网站 ZIP 上传和接入录制 SDK 的外部 URL 测试
- 管理员试跑与正式会话统计隔离
- 知情同意、真实摄像头/面部检测和行为-only 明确降级
- 每位被试唯一会话、rrweb 录制、MediaPipe 降采样和服务端持久化
- 会话筛选、排序、实际时长回放、面部曲线和行为指标
- 可配置 Qwen3-VL 诊断；未配置或调用失败时明确标注本地规则降级
- 诊断持久化、动态打印/PDF 报告和不可预测 Token 只读分享
- SQLite 数据库、API 集成测试、ESLint、CI 和 Docker 私有部署

完整完成口径见 [产品设计与验收规范](docs/PRODUCT_DESIGN.md)，当前实施记录见 [实施计划](docs/IMPLEMENTATION_PLAN.md)。

## 技术架构

```text
React + Vite (HashRouter)
        │
        ├── rrweb 行为采集
        ├── MediaPipe FaceLandmarker
        │
        ▼
Fastify `/api/v1`
        │
        ├── Route Schema / Service / Repository
        ├── better-sqlite3 ─── SQLite migrations
        └── ZIP / 静态测试网站
        ▼
DashScope OpenAI-compatible API (可选 Qwen3-VL)
```

Fastify 在生产环境同时提供版本化 API 和构建后的前端静态资源。路由使用 JSON Schema 校验，业务规则位于 Service，SQL 集中在 Repository，数据库结构由编号 migration 管理。SQLite 是业务数据的唯一真相来源；浏览器存储只在提交失败时充当临时缓冲，服务器确认成功后会清除。

## 本地开发

要求 Node.js 22.5 或更高版本。

```bash
npm install
cp .env.example .env
npm run dev
```

开发地址：

- 前端：<http://localhost:5173>
- API：<http://localhost:8787/api/v1/health>
- OpenAPI 文档：<http://localhost:8787/docs>
- 内置演示任务：<http://localhost:5173/#/join/abc123>

`.env.example` 中的默认值仅供本地开发。分析端打开 <http://localhost:5173/#/>，默认开发密码为 `demo`；生产部署必须通过 `ADMIN_PASSWORD` 设置其他安全密码。

## AI 配置

不配置 AI 密钥也能运行完整流程，此时报告会显示“本地规则引擎”，不会冒充 Qwen。接入阿里云百炼时设置：

```dotenv
DASHSCOPE_API_KEY=sk-your-key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen3-vl-plus
```

密钥只由 Node 服务读取，不会进入浏览器构建产物。不同百炼地域的 API Key 与 Base URL 必须配套；模型不可用或 45 秒超时时，系统保存规则降级原因并继续生成报告。

诊断请求会先持久化为后台任务并立即返回，页面自动轮询任务状态。进程重启后会继续未完成任务；流水线异常按照 `DIAGNOSIS_MAX_ATTEMPTS` 和 `DIAGNOSIS_RETRY_DELAY_MS` 自动重试，耗尽后保存失败原因并允许手动重试。状态机、接口和运维边界见 [异步诊断任务说明](docs/ASYNC_DIAGNOSIS.md)。

## 创建网页测试

在 `/#/tasks` 新建任务时可以选择三种测试网页：

- **内置结算模板**：无需额外配置，适合演示优惠券决策分析。
- **上传网站 ZIP**：ZIP 根目录必须包含 `index.html`，可以包含相对引用的 HTML、CSS、JavaScript、图片、字体和音视频静态资源。压缩包最大 20 MiB，解压后最大 100 MiB、1000 个文件。
- **外部 URL**：适用于研究员可控制的网站。创建任务后，将界面生成的 `<script>` 标签加入目标网页；目标网页允许 iframe 且 SDK 握手通过后，任务才能发布。生产环境仅允许 HTTPS URL。

ZIP 内容保存在 `INSIGHTUX_SITE_DIR`（默认 `./data/task-sites`），Docker 部署中与 SQLite 一起进入 `/app/data` 持久卷。上传内容在无同源权限的 sandbox iframe 中运行；不支持服务端程序、数据库或上传后构建。

每个已验证任务都可点击“试跑”。试跑完整记录行为和面部数据并可回放，但使用 `T-xxx` 编号，不计入任务会话数、仪表盘或正式会话，也不能生成诊断、报告和分享链接。

外部 URL 的完整接入、响应头、安全协议和排障说明见 [Recorder SDK 接入指南](docs/RECORDER_SDK.md)。

## 验证

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

测试覆盖确定性指标、规则诊断、版本化 SQLite migration 与约束、安全 ZIP 解压、录制 SDK 协议，以及从网页上传/URL 验证、正式会话、试跑隔离、回放、诊断到分享报告的 API 和浏览器完整链路。端到端测试默认使用本机 Google Chrome。

## 生产运行

### Node 进程

```bash
cp .env.example .env
# 修改 ADMIN_PASSWORD、ADMIN_SESSION_SECRET 和 PUBLIC_APP_URL
npm ci
npm run build
NODE_ENV=production npm start
```

应用默认监听 <http://localhost:8787>，SQLite 默认写入 `data/data.db`。旧版 `data/insightux.db` 不会自动迁移或读取。生产模式会拒绝缺失管理员密码或长度不足 32 字符的会话密钥，并且默认不创建演示任务。

### Docker Compose

```bash
cp .env.example .env
# 先设置强密码、随机会话密钥和公开 HTTPS 地址
docker compose up -d --build
```

`insightux-data` 数据卷保存 SQLite 文件和上传的网站内容。升级前应备份该卷；外部部署建议在反向代理终止 HTTPS，并限制管理端访问来源。

## 隐私与数据边界

- 不请求或采集麦克风。
- 不保存连续原始摄像头视频。
- 面部数据包含关键点、情绪估测和每秒最多一张 160×120 低清缩略图。
- 配置 DashScope 后，诊断会将会话指标和最多三张低清缩略图发送至阿里云百炼；被试入口会据实展示这一处理方式。未配置时不会向外部 AI 服务发送采集数据。
- 单个会话最多接收 10,000 个 rrweb 事件、600 个面部帧和 12 MiB 请求体。
- 被试在提交前可以退出；系统会将会话标记为退出并清除服务端和浏览器缓冲。
- 已提交数据由部署方按照研究协议管理；当前版本不提供被试自行删除已提交研究数据的入口。
- 情绪值是启发式 UX 信号，不是心理或医疗诊断。

## 主要路由

| 路由 | 用途 | 权限 |
|---|---|---|
| `/#/login` | 管理员登录 | 公开 |
| `/#/` | 仪表盘 | 管理员 |
| `/#/tasks` | 任务管理 | 管理员 |
| `/#/sessions` | 会话列表 | 管理员 |
| `/#/sessions/:id` | 深度分析与诊断 | 管理员 |
| `/#/report/:id` | 报告导出 | 管理员 |
| `/#/join/:token` | 被试入口 | 有效活动 Token |
| `/#/calibrate/:sessionId` | 面部校准 | 匿名会话凭证 |
| `/#/task/:sessionId` | 测试任务 | 匿名会话凭证 |
| `/#/share/:token` | 只读分享报告 | 有效分享 Token |

## 项目结构

```text
src/                  React 页面、组件和浏览器采集
server/               Fastify API、Service、Repository、SQLite migrations 与诊断
test/                 单元测试和 API 集成测试
docs/                 产品规范与实施记录
.github/workflows/    CI
Dockerfile            私有部署镜像
docker-compose.yml    单机持久化部署
```
