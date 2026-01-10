#!/usr/bin/env python3
"""
FastAPI main application
REST API backend for LangSense mobile app
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from redis import asyncio as aioredis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from contextlib import asynccontextmanager
import logging

from config import DATABASE_URL, CORS_ORIGINS, ENVIRONMENT, REDIS_URL
from models import Base
from api.routes import auth, users, financial, admin, settings, predictive, model_monitoring
from api.middleware import setup_logging

logger = logging.getLogger(__name__)

# Global database session maker
async_session_maker = None
redis_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan - startup and shutdown events"""
    global async_session_maker, redis_client
    
    # Startup
    logger.info("Starting FastAPI application...")
    
    # Initialize database
    db_url = DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
    
    if "sqlite" in db_url:
        engine = create_async_engine(
            db_url,
            poolclass=StaticPool,
            connect_args={"check_same_thread": False},
            echo=False
        )
    else:
        engine = create_async_engine(db_url, echo=False)
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session_maker = async_sessionmaker(engine, expire_on_commit=False)
    logger.info("Database initialized successfully")

    # Initialize Redis client if configured
    if REDIS_URL:
        try:
            redis_client = aioredis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
            await redis_client.ping()
            logger.info("Redis connection verified")
        except Exception as exc:  # pragma: no cover - defensive
            logger.error(f"Redis initialization failed: {exc}")
            redis_client = None
    
    yield
    
    # Shutdown
    logger.info("Shutting down FastAPI application...")
    if redis_client:
        try:
            await redis_client.close()
        except Exception:  # pragma: no cover - defensive
            logger.exception("Failed closing Redis client")
    await engine.dispose()


# Create FastAPI app
app = FastAPI(
    title="LangSense API",
    description="REST API for LangSense Mobile Application",
    version="1.0.0",
    lifespan=lifespan
)

# Setup logging
setup_logging()

# Configure CORS
allowed_origins = CORS_ORIGINS if ENVIRONMENT == "production" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)


# Dependency to get database session
async def get_db():
    """Get database session"""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(financial.router, prefix="/api/v1/financial", tags=["Financial Services"])
app.include_router(settings.router, prefix="/api/v1/settings", tags=["Settings"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(predictive.router)
app.include_router(model_monitoring.router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "LangSense API",
        "version": "1.0.0",
        "status": "active"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    database_ok = False
    redis_ok = None
    errors = {}

    # Database check
    try:
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
        database_ok = True
    except Exception as exc:
        errors["database"] = f"{exc.__class__.__name__}: {exc}"
        logger.error(f"Health check database failure: {exc}")

    # Redis check (optional)
    if REDIS_URL:
        try:
            if redis_client is None:
                errors["redis"] = "not_initialized"
                redis_ok = False
            else:
                await redis_client.ping()
                redis_ok = True
        except Exception as exc:
            redis_ok = False
            errors["redis"] = f"{exc.__class__.__name__}: {exc}"
            logger.error(f"Health check redis failure: {exc}")
    else:
        redis_ok = None

    healthy = database_ok and (redis_ok in (True, None))

    payload = {
        "status": "healthy" if healthy else "degraded",
        "environment": ENVIRONMENT,
        "database": "connected" if database_ok else "degraded",
        "redis": (
            "connected" if redis_ok is True else "not_configured" if redis_ok is None else "degraded"
        ),
        "version": "1.0.0",
    }

    if not healthy:
        payload["errors"] = errors
        raise HTTPException(status_code=503, detail=payload)

    return payload


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
