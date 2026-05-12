# backend/test_db.py
import asyncio
from app.db.session import async_engine
from sqlalchemy import text

async def test():
    try:
        async with async_engine.connect() as conn:
            result = await conn.execute(text("SELECT version()"))
            print("✅ DB OK:", result.scalar())
            
            # Test PostGIS
            result = await conn.execute(text("SELECT PostGIS_version()"))
            print("✅ PostGIS OK:", result.scalar())
            
            # Test users table
            result = await conn.execute(text("SELECT COUNT(*) FROM users"))
            print("✅ Users count:", result.scalar())
    except Exception as e:
        print(f"❌ DB ERROR: {type(e).__name__}: {e}")

asyncio.run(test())