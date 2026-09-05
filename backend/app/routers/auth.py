import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.dependencies import get_current_user
from app.models.models import User, PasswordResetToken
from app.schemas.schemas import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserRead,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.services.audit import log_action

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        is_active=True,
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_action(db, user, "REGISTER", "User", user.id, details=f"New account created: {user.email}")

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="This account has been deactivated")

    log_action(db, user, "LOGIN", "User", user.id)

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/logout")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # JWTs are stateless; logout is handled client-side by discarding the token.
    log_action(db, user, "LOGOUT", "User", user.id)
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return UserRead.model_validate(user)


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    # Always return 200 so we don't leak whether an email exists.
    if not user:
        return {"detail": "If that email exists, a reset link has been generated."}

    token = secrets.token_urlsafe(32)
    reset = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(reset)
    db.commit()

    # Development mode: log the token instead of sending an email.
    print(f"[MedRelease] Password reset token for {user.email}: {token}")

    log_action(db, user, "FORGOT_PASSWORD", "User", user.id)

    return {
        "detail": "If that email exists, a reset link has been generated.",
        "dev_reset_token": token,
    }


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset = db.query(PasswordResetToken).filter(PasswordResetToken.token == payload.token).first()
    if not reset or reset.used or reset.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = db.get(User, reset.user_id)
    user.hashed_password = hash_password(payload.new_password)
    reset.used = True
    db.commit()

    log_action(db, user, "RESET_PASSWORD", "User", user.id)

    return {"detail": "Password has been reset. You can now log in."}
