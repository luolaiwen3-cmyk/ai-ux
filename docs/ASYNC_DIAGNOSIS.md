# 异步诊断任务说明

InsightUX 将诊断请求保存到 SQLite 后交给进程内后台 Worker 执行。管理端发起诊断时无需等待 Qwen 最长 45 秒的调用，页面通过状态接口轮询结果；服务重启后，尚未完成的任务会被重新领取。

## 处理流程

```text
管理端 POST /api/v1/sessions/:sessionId/diagnosis
  → SQLite 写入 pending
  → HTTP 202 立即返回
  → 后台 Worker 领取任务
      ├─ 成功：completed，可查看、导出和分享报告
      ├─ 流水线异常：按指数退避自动重试
      └─ 达到最大次数：failed，保存错误并允许手动重试
```

Qwen 请求失败或超时仍遵循产品既有降级策略：系统生成明确标记的本地规则诊断，并将任务记为 `completed`。只有无法完成整个诊断流水线的异常才进入自动重试和 `failed` 状态。

## 状态与持久化字段

`diagnoses.status` 有三种状态：

- `pending`：已排队、执行中或等待下一次重试。
- `completed`：诊断成功，报告和分享 Token 可用。
- `failed`：已耗尽自动重试次数，可由管理员手动重新入队。

队列同时保存以下运行信息：

- `attempt_count` / `max_attempts`：已执行次数和最大次数。
- `last_error`：最近一次流水线异常，最长返回 1000 个字符。
- `queued_at` / `started_at` / `completed_at`：排队、首次执行和结束时间。
- `next_attempt_at`：下次自动重试时间。
- `claimed_at`：当前进程领取标记；进程启动时会释放中断遗留的领取标记。

升级时 migration `002_async_diagnoses.sql` 会重建诊断表并保留旧版本的已完成或失败报告、模型信息、结果 JSON 和分享 Token。生产升级前仍应按照常规流程备份 SQLite 数据文件。

## API

### 创建或重试诊断

```http
POST /api/v1/sessions/:sessionId/diagnosis
Cookie: insightux_admin=...
```

返回 `202 Accepted`。同一会话已有 `pending` 任务时，该请求是幂等的，不会重置正在执行的任务；已有 `completed` 或 `failed` 记录时，请求会将其重新置为 `pending`。

### 查询状态

```http
GET /api/v1/sessions/:sessionId/diagnosis
Cookie: insightux_admin=...
```

管理端默认在任务处于 `pending` 时每 1.2 秒轮询。查询结果包含状态、尝试次数、时间字段，以及失败时的 `lastError`。只有 `completed` 响应会暴露 `shareToken`。

## 配置

```dotenv
# 每次入队最多执行 3 次，允许范围 1-10。
DIAGNOSIS_MAX_ATTEMPTS=3

# 首次重试基础间隔，单位毫秒，允许范围 100-60000。
DIAGNOSIS_RETRY_DELAY_MS=2000
```

重试使用指数退避。例如基础间隔为 2000 毫秒时，连续失败后的等待时间依次为 2 秒、4 秒、8 秒。

## 恢复与关闭行为

- 服务启动时释放上次进程中断遗留的 `claimed_at`，并继续处理所有到期的 `pending` 任务。
- 正常关闭时停止领取新任务，并等待当前诊断结束后再关闭数据库。
- Worker 内部异常会释放任务领取标记，并在基础重试间隔后重新唤醒。
- 待重试时间和尝试次数均保存在 SQLite 中，不依赖浏览器页面保持打开。

## 部署边界

当前实现面向 InsightUX 的单进程私有部署，使用一个顺序 Worker 控制模型调用压力。不要让多个应用进程同时连接并处理同一个 SQLite 数据文件：启动恢复逻辑可能释放另一个进程仍在执行的任务。

未来需要多实例部署时，应将领取标记升级为带所有者和过期时间的租约，或迁移到 Redis、RabbitMQ 等外部任务队列，再增加全局并发限制。

## 验证覆盖

自动化测试覆盖：

- API 返回 `202`，并通过 GET 状态接口完成轮询。
- 自动重试耗尽后持久化 `failed`、尝试次数和错误。
- 管理员将失败任务重新入队。
- 进程启动后接管中断前已领取的任务。
- 从旧数据库迁移时保留已完成报告和分享 Token。
- 诊断完成后分享报告仍保持只读且不返回 rrweb 和面部帧正文。
