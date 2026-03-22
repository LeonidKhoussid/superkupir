"""Pydantic-схемы запроса/ответа для генерации маршрута по квизу (stateless API)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class QuizAnswerItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    step_id: int = Field(ge=1, le=5, description="Номер шага квиза 1–5")
    option: str = Field(min_length=1)


class SeasonMappingEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    label: str | None = None


class PlaceDatasetItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    place_id: int
    lat: float | None = None
    lon: float | None = None
    category: str | None = None
    description: str | None = None
    cost_hint: float | None = None
    duration_hint_minutes: int | None = None
    season_ids: list[int] | None = None
    family_friendly: bool | None = None
    city_hint: str | None = None


class QuizRouteGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answers: list[QuizAnswerItem]
    places: list[PlaceDatasetItem] = Field(min_length=1)
    season_mapping: list[SeasonMappingEntry] = Field(min_length=1)


class RoutePlaceStop(BaseModel):
    model_config = ConfigDict(extra="forbid")

    place_id: int
    sort_order: int = Field(ge=1)
    stay_duration_minutes: int = Field(ge=1)


class QuizRouteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    season_id: int
    total_estimated_cost: float = Field(ge=0)
    total_estimated_duration_minutes: int = Field(ge=1)
    places: list[RoutePlaceStop] = Field(min_length=1)
