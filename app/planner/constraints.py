from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


class TripConstraintChecker:
    """ПРОВЕРКА ЖЕСТКИХ ОГРАНИЧЕНИЙ"""

    # Инициализация проверяющего слоя
    def __init__(self) -> None:
        self.weekday_map = {
            0: "пн",
            1: "вт",
            2: "ср",
            3: "чт",
            4: "пт",
            5: "сб",
            6: "вс",
        }

    # Проверка бюджета
    @staticmethod
    def _matches_budget(trip_request: dict[str, Any], place: dict[str, Any]) -> bool:
        budget_level = trip_request.get("constraints", {}).get("budget_level", "")
        if not budget_level or not place.get("price_level"):
            return True

        compatible_budgets = {
            "низкий": {"низкий", "бесплатно"},
            "средний": {"низкий", "средний", "бесплатно"},
            "высокий": {"низкий", "средний", "высокий", "бесплатно"},
        }
        return place.get("price_level") in compatible_budgets.get(
            budget_level,
            {place.get("price_level")},
        )

    # Проверка обязательных флагов
    @staticmethod
    def _matches_must_have(trip_request: dict[str, Any], place: dict[str, Any]) -> bool:
        constraints = trip_request.get("constraints", {})
        must_have = set(constraints.get("must_have", []))
        if "parking" in must_have and not place.get("parking"):
            return False
        if (
            "family_friendly" in must_have
            and place.get("category") == "stay"
            and not place.get("family_friendly")
        ):
            return False
        if (
            "pet_friendly" in must_have
            and place.get("category") == "stay"
            and not place.get("pet_friendly")
        ):
            return False
        return True

    # Проверка stay-типа
    @staticmethod
    def _matches_stay_type(trip_request: dict[str, Any], place: dict[str, Any]) -> bool:
        if place.get("category") != "stay":
            return True

        stay_types = set(trip_request.get("stay", {}).get("accommodation_type", []))
        if not stay_types:
            return True
        return place.get("place_type") in stay_types

    # Проверка состава группы
    @staticmethod
    def _matches_party(trip_request: dict[str, Any], place: dict[str, Any]) -> bool:
        party = trip_request.get("party", {})
        constraints = trip_request.get("constraints", {})
        if (
            constraints.get("kids_friendly_required")
            and place.get("category") in {"stay", "food"}
            and not place.get("kids_friendly")
            and not place.get("family_friendly")
        ):
            return place.get("category") == "food"
        if party.get("children", 0) > 0 and place.get("category") == "food":
            return True
        return True

    # Проверка рабочих дней
    def _matches_working_days(self, trip_request: dict[str, Any], place: dict[str, Any]) -> bool:
        working_days = place.get("working_days", [])
        if not working_days:
            return True

        start_date = trip_request.get("dates", {}).get("start_date", "")
        if not start_date:
            return True

        try:
            parsed_date = datetime.strptime(start_date, "%Y-%m-%d")
        except Exception:
            return True

        weekday = self.weekday_map[parsed_date.weekday()]
        return weekday in working_days

    # Проверка сезонности места
    @staticmethod
    def _matches_seasonality(trip_request: dict[str, Any], place: dict[str, Any]) -> bool:
        season = str(trip_request.get("travel_season", "") or "").strip().lower()
        place_seasonality = str(place.get("seasonality", "") or "").strip().lower()
        if not season or not place_seasonality or place_seasonality == "круглый_год":
            return True

        season_map = {
            "зима": {"круглый_год", "зима"},
            "весна": {"круглый_год", "весна", "не_зимой"},
            "лето": {"круглый_год", "лето", "не_зимой"},
            "осень": {"круглый_год", "осень", "не_зимой"},
        }
        allowed_values = season_map.get(season, {"круглый_год"})
        return place_seasonality in allowed_values

    # Проверка исключаемых типов мест
    @staticmethod
    def _matches_avoid_place_types(trip_request: dict[str, Any], place: dict[str, Any]) -> bool:
        raw_values = trip_request.get("constraints", {}).get("avoid_place_types", [])
        if not raw_values:
            return True

        normalized_values = {
            str(value).strip().lower().replace(" ", "_")
            for value in raw_values
            if str(value).strip()
        }
        place_type = str(place.get("place_type", "") or "").strip().lower().replace(" ", "_")
        if not place_type:
            return True
        return place_type not in normalized_values

    # Проверка наличия координат для маршрута
    @staticmethod
    def _matches_geo(place: dict[str, Any]) -> bool:
        if place.get("category") == "stay":
            return place.get("lat") is not None and place.get("lon") is not None
        if place.get("category") in {"food", "wine"}:
            return place.get("lat") is not None and place.get("lon") is not None
        return True

    # Фильтрация общих кандидатов
    def filter_places(
        self,
        trip_request: dict[str, Any],
        places: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        filtered_places: list[dict[str, Any]] = []
        for place in places:
            if not self._matches_budget(trip_request, place):
                continue
            if not self._matches_must_have(trip_request, place):
                continue
            if not self._matches_stay_type(trip_request, place):
                continue
            if not self._matches_party(trip_request, place):
                continue
            if not self._matches_working_days(trip_request, place):
                continue
            if not self._matches_seasonality(trip_request, place):
                continue
            if not self._matches_avoid_place_types(trip_request, place):
                continue
            if not self._matches_geo(place):
                continue
            filtered_places.append(place)
        return filtered_places

from app.planner.constraints import TripConstraintChecker

# Запуск
if __name__ == "__main__":
    print(TripConstraintChecker().__class__.__name__)
