from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

db_url = settings.DATABASE_URL.strip()

# Ensure the URL uses the asyncpg driver prefix
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://") and "+asyncpg" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Drop any parameters that asyncpg doesn't support but Neon might provide
# (like channel_binding=prefer which is meant for libpq, and sslmode)
if "?" in db_url:
    base, qs = db_url.split("?", 1)
    params = [p for p in qs.split("&") if "channel_binding" not in p and "sslmode" not in p]
    db_url = f"{base}?{'&'.join(params)}" if params else base

connect_args = {"timeout": 10}
# Neon databases require SSL. asyncpg expects `ssl=True` in connect kwargs
# rather than `sslmode=require` in the query string.
if "neon.tech" in db_url:
    connect_args["ssl"] = True

kw = {
    "echo": False,
    "connect_args": connect_args,
}

if "sqlite" not in db_url:
    kw.update({
        "pool_size": 3,
        "max_overflow": 5,
        "pool_timeout": 10,
        "pool_recycle": 300,  # 5 minutes for serverless DBs
        "pool_pre_ping": True,  # ⬅️ This fixes the "connection is closed" error!
    })

engine = create_async_engine(db_url, **kw)
    
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
