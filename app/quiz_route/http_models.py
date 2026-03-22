from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

_ALLOWED_SEASONS = frozenset({"spring", "summer", "autumn", "winter"})
_EXCURSIONS = frozenset({"активный", "умеренный", "спокойный"})


class QuizRouteRequestModel(BaseModel):
    """ТЕЛО ЗАПРОСА КВИЗА V2"""

    people_count: int = Field(ge=1)
    season: str
    budget_from: float | int
    budget_to: float | int
    excursion_type: str
    days_count: int = Field(ge=1)
    request_id: str | None = None
    locale: str | None = None

    # Нормализация сезона (fall → autumn)
    @field_validator("season", mode="before")
    @classmethod
    def normalize_season(cls, value: object) -> str:
        if not isinstance(value, str):
            raise TypeError("season must be a string")
        s = value.strip().lower()
        if s == "fall":
            return "autumn"
        return s

    # Проверка допустимых сезонов
    @field_validator("season", mode="after")
    @classmethod
    def validate_season(cls, value: str) -> str:
        if value not in _ALLOWED_SEASONS:
            raise ValueError("season must be one of: spring, summer, autumn, winter, fall")
        return value

    # Нормализация стиля поездки
    @field_validator("excursion_type", mode="before")
    @classmethod
    def normalize_excursion(cls, value: object) -> str:
        if not isinstance(value, str):
            raise TypeError("excursion_type must be a string")
        return value.strip().lower()

    # Допустимые значения excursion_type
    @field_validator("excursion_type", mode="after")
    @classmethod
    def validate_excursion(cls, value: str) -> str:
        if value not in _EXCURSIONS:
            raise ValueError("excursion_type must be активный | умеренный | спокойный")
        return value

    # Порядок бюджета
    @model_validator(mode="after")
    def budget_bounds(self) -> QuizRouteRequestModel:
        if float(self.budget_to) < float(self.budget_from):
            raise ValueError("budget_to must be greater than or equal to budget_from")
        return self


class QuizRouteResponseModel(BaseModel):
    """УСПЕШНЫЙ ОТВЕТ С ПОРЯДКОМ place_ids"""

    place_ids: list[int]
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    rationale: str | None = None


class QuizRouteErrorModel(BaseModel):
    """ТЕЛО ОШИБКИ 422"""

    error: Literal["unsatisfiable"] = "unsatisfiable"
    detail: str
