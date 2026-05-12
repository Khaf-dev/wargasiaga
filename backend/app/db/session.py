from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from typing import AsyncGenerator
from app.core.config import settings

# Supabase pooler URL pakai postgresql://, tapi asyncpg butuh postgresql+asyncpg://
db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# PENTING untuk Supabase pooler (Supavisor di transaction mode):
# 1. statement_cache_size=0 → asyncpg DISABLE prepared statement caching
# 2. prepared_statement_cache_size=0 → SQLAlchemy adapter juga disable
# 3. poolclass=NullPool → SQLAlchemy gak pool, biarin Supavisor yang pool
# 4. server_settings jit=off → matiin JIT yang kadang nge-cache statement
async_engine = create_async_engine(
    db_url,
    echo=settings.DEBUG,
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        "server_settings": {
            "jit": "off",
        },
    },
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency untuk mendapatkan session database."""
    async with AsyncSessionLocal() as session:
        yield session