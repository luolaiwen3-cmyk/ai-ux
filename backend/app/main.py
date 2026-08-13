from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.tasks import router as tasks_router
from app.api.sessions import router as participant_sessions_router
from app.api.analyst_sessions import router as analyst_sessions_router
from app.core.config import get_settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / "sessions").mkdir(exist_ok=True)
    (settings.data_dir / "backups").mkdir(exist_ok=True)
    yield


app = FastAPI(title="InsightUX API", version="0.1.0", lifespan=lifespan)
app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(participant_sessions_router, prefix="/api")
app.include_router(analyst_sessions_router, prefix="/api")

settings = get_settings()
assets_dir = settings.frontend_dist / "assets"
if assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/{path:path}", include_in_schema=False)
def frontend(path: str):
    index = settings.frontend_dist / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"message": "Frontend has not been built", "path": path}
