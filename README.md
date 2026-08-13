# InsightUX

InsightUX 是一个本机运行的 UX 行为录制与诊断平台。参与者端记录 rrweb 行为和 MediaPipe 派生面部特征，分析端从 FastAPI + SQLite 后端读取会话、回放与报告。

## 架构

```text
frontend/   React + Vite
backend/    FastAPI + SQLAlchemy + Alembic
data/       SQLite、压缩录制文件与备份（Git 忽略）
docs/       系统说明
scripts/    开发和检查脚本
```

SQLite 只保存任务、会话、批次索引和报告。体积较大的 rrweb 与面部特征批次存为 `data/sessions/{session_id}/{stream}/*.json.gz`。系统不会保存原始视频、音频或面部截图。

## 首次安装

```bash
cd backend
UV_CACHE_DIR=../.uv-cache uv sync --dev

cd ../frontend
npm install
```

复制 `.env.example` 为 `.env`。开发环境默认管理员：

- 用户名：`admin`
- 密码：`admin123`

正式使用前必须替换管理员密码哈希和 `INSIGHTUX_SESSION_SECRET`。生成密码哈希：

```bash
cd backend
UV_CACHE_DIR=../.uv-cache uv run python -c "from argon2 import PasswordHasher; print(PasswordHasher().hash('你的密码'))"
```

## 开发运行

```bash
chmod +x scripts/dev.sh scripts/check.sh
./scripts/dev.sh
```

- 前端：http://127.0.0.1:5173
- API 文档：http://127.0.0.1:8000/docs
- 分析端登录：http://127.0.0.1:5173/#/login

Vite 会把 `/api` 代理到 FastAPI。后端启动时自动执行 Alembic 迁移。

## 生产运行（本机）

```bash
cd frontend && npm run build
cd ../backend
UV_CACHE_DIR=../.uv-cache uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

访问 http://127.0.0.1:8000。只使用一个 Uvicorn worker，且不要将 SQLite 数据目录放在网络文件系统。

## 数据流程

1. 管理员登录后创建任务并复制测试链接。
2. 参与者同意后，后端创建唯一会话。
3. rrweb 和面部特征先写入 IndexedDB 队列，再按幂等批次上传。
4. 后端原子写入 gzip 文件并在 SQLite 记录索引。
5. 测试结束后确认会话完成；失败批次可在感谢页重试。
6. 分析端读取真实会话、回放数据并持久化模板诊断报告。

## 旧数据导入

会话列表会检测旧版 `localStorage` 录制并显示导入入口。导入成功后，由管理员决定是否清理浏览器副本。重复导入不会创建重复会话。

## 备份与恢复

分析端侧栏可下载完整备份。命令行备份：

```bash
cd backend
UV_CACHE_DIR=../.uv-cache uv run python -m app.cli backup
```

恢复前停止后端：

```bash
cd backend
UV_CACHE_DIR=../.uv-cache uv run python -m app.cli restore ../data/backups/insightux-backup-xxx.tar.gz
```

恢复前会自动备份当前数据。备份包含一致性 SQLite 快照与全部会话文件。

## 验证

```bash
./scripts/check.sh
```

该命令运行后端测试、数据库迁移和前端生产构建。

## 当前限制

- 第一阶段仅支持本机，不开放局域网或公网访问。
- 仅有单一管理员，不包含多用户和角色权限。
- 诊断报告使用本地模板持久化，暂未调用真实 Qwen API。
- 已完成数据默认保留，管理员可手动删除；未完成会话超过 24 小时会自动清理。
