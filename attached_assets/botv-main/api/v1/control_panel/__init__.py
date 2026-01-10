"""Control Panel API v1 Package"""
from fastapi import APIRouter

# Import all routers
from api.v1.control_panel.games.router import router as games_router
from api.v1.control_panel.players.router import router as players_router
from api.v1.control_panel.profit_loss.router import router as profit_loss_router
from api.v1.control_panel.analytics.router import router as analytics_router
from api.v1.control_panel.roles.router import router as roles_router
from api.v1.control_panel.audit.router import router as audit_router
from api.v1.control_panel.agents.router import router as agents_router
from api.v1.control_panel.affiliates.router import router as affiliates_router
from api.v1.control_panel.notifications.router import router as notifications_router

# Create main control panel router
router = APIRouter(prefix="/control-panel", tags=["control-panel"])

# Include sub-routers
router.include_router(games_router)
router.include_router(players_router)
router.include_router(profit_loss_router)
router.include_router(analytics_router)
router.include_router(roles_router)
router.include_router(audit_router)
router.include_router(agents_router)
router.include_router(affiliates_router)
router.include_router(notifications_router)

__all__ = [
    'router',
    'games_router',
    'players_router',
    'profit_loss_router',
    'analytics_router',
    'roles_router',
    'audit_router',
    'agents_router',
    'affiliates_router',
    'notifications_router',
