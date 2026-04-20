from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User, Role, AdminPermission

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token: missing subject")
    except JWTError as e:
        err_str = str(e).lower()
        if "expired" in err_str or "expir" in err_str:
            raise HTTPException(status_code=401, detail="Session expired. Please log out and log in again.")
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    result = await db.execute(
        select(User)
        .options(joinedload(User.permissions))
        .where(User.id == user_id)
    )
    user = result.scalars().first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_optional_user(
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
) -> User | None:
    """Like get_current_user, but returns None if no valid token is provided."""
    if not credentials:
        return None
        
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            return None
            
        result = await db.execute(
            select(User)
            .options(joinedload(User.permissions))
            .where(User.id == user_id)
        )
        return result.scalars().first()
    except:
        return None


def require_roles(*roles: Role):
    """Dependency factory: restrict endpoint to specific roles."""
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(r.value for r in roles)}"
            )
        return user
    return role_checker


def require_admin_permissions(
    manage_users: bool = False,
    manage_batches: bool = False,
    manage_courses: bool = False,
    manage_leaves: bool = False
):
    """Dependency factory: restrict endpoint based on granular admin permissions."""
    async def permission_checker(
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ) -> User:
        if user.role == Role.SUPER_ADMIN:
            return user
            
        if user.role not in [Role.ADMIN, Role.TRAINER]:
            raise HTTPException(status_code=403, detail="Admin access required")
            
        result = await db.execute(select(AdminPermission).where(AdminPermission.user_id == user.id))
        perm = result.scalars().first()
        
        if not perm:
            raise HTTPException(status_code=403, detail="Admin permissions not configured")
            
        if manage_users and not perm.manage_users:
            raise HTTPException(status_code=403, detail="Missing permission: manage_users")
        if manage_batches and not perm.manage_batches:
            raise HTTPException(status_code=403, detail="Missing permission: manage_batches")
        if manage_courses and not perm.manage_courses:
            raise HTTPException(status_code=403, detail="Missing permission: manage_courses")
        if manage_leaves and not perm.manage_leaves:
            raise HTTPException(status_code=403, detail="Missing permission: manage_leaves")
            
        return user
    return permission_checker
