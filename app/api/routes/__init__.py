"""Маршруты HTTP API."""

from app.api.routes.quiz_route import router as quiz_route_router
from app.api.routes.recommendations import router as recommendations_router

__all__ = ["quiz_route_router", "recommendations_router"]
