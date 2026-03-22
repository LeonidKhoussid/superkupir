"""Совместимость: используйте `app.schemas.quiz_route` как канонический модуль."""

from __future__ import annotations

from app.schemas.quiz_route import (
    PlaceDatasetItem,
    QuizAnswerItem,
    QuizRouteGenerateRequest,
    QuizRouteResponse,
    RoutePlaceStop,
    SeasonMappingEntry,
)

__all__ = [
    "PlaceDatasetItem",
    "QuizAnswerItem",
    "QuizRouteGenerateRequest",
    "QuizRouteResponse",
    "RoutePlaceStop",
    "SeasonMappingEntry",
]
