#!/usr/bin/env python3
"""
FastAPI main application with control panel API
Production-ready REST API for LangSense
"""

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool, NullPool
from contextlib import asynccontextmanager
import logging
import os

from config import DATABASE_URL, ENVIRONMENT
from models import Base
from api.v1.control_panel import router as control_panel_router

logger = logging.getLogger(__name__)

# Global database session maker
async_session_maker = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan - startup and shutdown events"""
    global async_session_maker
    
    # Startup
    logger.info(f"Starting API server (environment: {ENVIRONMENT})...")
    
    # Initialize database
    db_url = DATABASE_URL
    
    # Normalize database URL for async driver
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
    
    # Configure engine based on database type
    if "sqlite" in db_url:
        engine = create_async_engine(
            db_url,
            poolclass=StaticPool,
            connect_args={"check_same_thread": False},
            echo=False
        )
    else:
        pool_class = NullPool if ENVIRONMENT == "production" else None
        engine = create_async_engine(
            db_url,
            echo=False,
            poolclass=pool_class
        )
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session_maker = async_sessionmaker(
        engine, 
        expire_on_commit=False,
        class_=None
    )
    logger.info("✓ Database initialized successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down API server...")
    await engine.dispose()
    logger.info("✓ Database connection closed")


# Create FastAPI app
app = FastAPI(
    title="LangSense Control Panel API",
    description="Production-ready REST API for LangSense control panel operations",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Configure CORS based on environment
cors_origins = [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
]

if ENVIRONMENT == "production":
    # In production, specify exact allowed origins
    cors_origins = os.getenv("CORS_ORIGINS", "https://yourdomain.com").split(",")
else:
    # Development: allow all
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
)


# Dependency to get database session
async def get_db():
    """Get async database session"""
    if async_session_maker is None:
        raise RuntimeError("Database session maker not initialized")
    
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Root endpoint
@app.get("/", tags=["System"])
async def root():
    """API root endpoint with metadata"""
    return {
        "name": "LangSense Control Panel API",
        "version": "1.0.0",
        "status": "operational",
        "environment": ENVIRONMENT,
        "docs": "/docs",
        "redoc": "/redoc"
    }


# Health check endpoint
@app.get("/health", tags=["System"], status_code=200)
async def health_check():
    """
    Health check endpoint for monitoring and load balancers
    
    Returns operational status and database connectivity
    """
    try:
        # Test database connection
        if async_session_maker:
            async with async_session_maker() as session:
                await session.execute("SELECT 1")
        
        return {
            "status": "healthy",
            "environment": ENVIRONMENT,
            "database": "connected",
            "version": "1.0.0"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed"
        )


# Include control panel router
app.include_router(
    control_panel_router,
    tags=["Control Panel"]
)


# Custom OpenAPI schema
def custom_openapi():
    """Customize OpenAPI schema for better documentation"""
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="LangSense Control Panel API",
        version="1.0.0",
        description="Comprehensive REST API for game management, player management, financial operations, and system administration.",
        routes=app.routes,
    )
    
    # Add security scheme
    openapi_schema["components"]["securitySchemes"] = {
        "BearerToken": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "JWT Bearer token for authentication"
        }
    }
    
    # Add common error responses
    openapi_schema["components"]["responses"] = {
        "BadRequest": {
            "description": "Bad request - invalid parameters",
            "content": {
                "application/json": {
                    "schema": {"type": "object", "properties": {"detail": {"type": "string"}}}
                }
            }
        },
        "Unauthorized": {
            "description": "Unauthorized - missing or invalid authentication",
            "content": {
                "application/json": {
                    "schema": {"type": "object", "properties": {"detail": {"type": "string"}}}
                }
            }
        },
        "Forbidden": {
            "description": "Forbidden - insufficient permissions",
            "content": {
                "application/json": {
                    "schema": {"type": "object", "properties": {"detail": {"type": "string"}}}
                }
            }
        },
        "NotFound": {
            "description": "Resource not found",
            "content": {
                "application/json": {
                    "schema": {"type": "object", "properties": {"detail": {"type": "string"}}}
                }
            }
        },
        "InternalServerError": {
            "description": "Internal server error",
            "content": {
                "application/json": {
                    "schema": {"type": "object", "properties": {"detail": {"type": "string"}}}
                }
            }
        }
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api.app:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=ENVIRONMENT != "production",
        log_level="info"
    )
