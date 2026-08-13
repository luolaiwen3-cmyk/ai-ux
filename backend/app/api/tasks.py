import secrets
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_admin
from app.models import SessionRecord, Task
from app.schemas.tasks import PublicTaskResponse, TaskCreate, TaskResponse, TaskUpdate

router = APIRouter(tags=["tasks"])


def task_response(task: Task, count: int = 0) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        name=task.name,
        scenario=task.scenario,
        public_token=task.public_token,
        status=task.status,
        created_at=task.created_at,
        session_count=count,
    )


@router.get("/tasks", response_model=list[TaskResponse], dependencies=[Depends(require_admin)])
def list_tasks(db: Session = Depends(get_db)) -> list[TaskResponse]:
    rows = db.execute(
        select(Task, func.count(SessionRecord.id)).outerjoin(SessionRecord).group_by(Task.id).order_by(Task.created_at.desc())
    ).all()
    return [task_response(task, count) for task, count in rows]


@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_task(payload: TaskCreate, db: Session = Depends(get_db)) -> TaskResponse:
    task = Task(id=str(uuid4()), name=payload.name.strip(), scenario=payload.scenario, public_token=secrets.token_urlsafe(24), status="active")
    db.add(task)
    db.commit()
    db.refresh(task)
    return task_response(task)


@router.patch("/tasks/{task_id}", response_model=TaskResponse, dependencies=[Depends(require_admin)])
def update_task(task_id: str, payload: TaskUpdate, db: Session = Depends(get_db)) -> TaskResponse:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(task)
    return task_response(task, len(task.sessions))


@router.get("/public/tasks/{token}", response_model=PublicTaskResponse)
def public_task(token: str, db: Session = Depends(get_db)) -> PublicTaskResponse:
    task = db.scalar(select(Task).where(Task.public_token == token, Task.status == "active"))
    if not task:
        raise HTTPException(status_code=404, detail="测试任务不存在或已关闭")
    return PublicTaskResponse.model_validate(task, from_attributes=True)
