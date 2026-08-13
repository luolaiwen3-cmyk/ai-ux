from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.config import get_settings
from app.core.security import COOKIE_NAME, create_session_token, require_admin, verify_password
from app.schemas.auth import AdminResponse, LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AdminResponse)
def login(payload: LoginRequest, response: Response) -> AdminResponse:
    settings = get_settings()
    if payload.username != settings.admin_username or not verify_password(payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    response.set_cookie(
        COOKIE_NAME,
        create_session_token(payload.username),
        httponly=True,
        samesite="strict",
        secure=settings.environment == "production",
        max_age=settings.session_ttl_seconds,
        path="/",
    )
    return AdminResponse(username=payload.username)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


@router.get("/me", response_model=AdminResponse)
def me(username: str = Depends(require_admin)) -> AdminResponse:
    return AdminResponse(username=username)
