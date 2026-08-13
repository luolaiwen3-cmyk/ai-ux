# InsightUX

InsightUX 是一个面向 UX 研究员的私有化用户测试平台。研究员创建任务并发布匿名链接；被试授权后完成测试，浏览器同步采集 rrweb 行为事件与 MediaPipe 面部特征；研究员可以回放会话、查看确定性指标、运行 Qwen 多模态诊断并分享报告。

## 已实现能力

- 管理员登录与服务端接口鉴权
- 任务创建、编辑、发布、暂停和真实 Token 链接
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
Node HTTP API ─── SQLite
        │             ├── Task
        │             ├── Session
        │             └── Diagnosis / Share Token
        ▼
DashScope OpenAI-compatible API (可选 Qwen3-VL)
```

Node 服务在生产环境同时提供 API 和构建后的前端静态资源。业务数据以 SQLite 为唯一真相来源；浏览器存储只在提交失败时充当临时缓冲，服务器确认成功后会清除。

## 本地开发

要求 Node.js 22.5 或更高版本。

```bash
npm install
cp .env.example .env
npm run dev
```

开发地址：

- 前端：<http://localhost:5173>
- API：<http://localhost:8787/api/health>
- 内置演示任务：<http://localhost:5173/#/join/abc123>

`.env.example` 中的默认值仅供本地开发。分析端打开 <http://localhost:5173/#/>，默认开发密码为 `change-me`（复制示例配置后）；请在首次运行前修改。

## AI 配置

不配置 AI 密钥也能运行完整流程，此时报告会显示“本地规则引擎”，不会冒充 Qwen。接入阿里云百炼时设置：

```dotenv
DASHSCOPE_API_KEY=sk-your-key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen3-vl-plus
```

密钥只由 Node 服务读取，不会进入浏览器构建产物。不同百炼地域的 API Key 与 Base URL 必须配套；模型不可用或 45 秒超时时，系统保存规则降级原因并继续生成报告。

## 验证

```bash
npm run lint
npm test
npm run build
```

测试覆盖确定性指标、规则诊断、SQLite 数据约束，以及从管理员登录、任务发布、匿名会话、数据提交、诊断到公开分享报告的完整 API 链路。

## 生产运行

### Node 进程

```bash
cp .env.example .env
# 修改 ADMIN_PASSWORD、ADMIN_SESSION_SECRET 和 PUBLIC_APP_URL
npm ci
npm run build
NODE_ENV=production npm start
```

应用默认监听 <http://localhost:8787>，SQLite 默认写入 `data/insightux.db`。生产模式会拒绝缺失管理员密码或长度不足 32 字符的会话密钥。

### Docker Compose

```bash
cp .env.example .env
# 先设置强密码、随机会话密钥和公开 HTTPS 地址
docker compose up -d --build
```

`insightux-data` 数据卷保存 SQLite 文件。升级前应备份该卷；外部部署建议在反向代理终止 HTTPS，并限制管理端访问来源。

## 隐私与数据边界

- 不请求或采集麦克风。
- 不保存连续原始摄像头视频。
- 面部数据包含关键点、情绪估测和每秒最多一张 160×120 低清缩略图。
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
server/               HTTP API、鉴权、SQLite、指标与诊断
test/                 单元测试和 API 集成测试
docs/                 产品规范与实施记录
.github/workflows/    CI
Dockerfile            私有部署镜像
docker-compose.yml    单机持久化部署
```
