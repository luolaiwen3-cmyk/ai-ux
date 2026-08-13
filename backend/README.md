# Backend

FastAPI + SQLite 后端服务。

```bash
UV_CACHE_DIR=../.uv-cache uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

配置使用根目录 `.env` 中的 `INSIGHTUX_` 前缀变量。API 路由位于 `app/api`，业务服务位于 `app/services`，结构化模型位于 `app/models`，数据库迁移位于 `migrations`。
