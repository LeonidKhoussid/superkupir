"""Pydantic-схемы домена и API (общие модули)."""

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
