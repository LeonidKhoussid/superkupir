from __future__ import annotations

import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.db_connector.models import CsvDataContract
from app.db_connector.session import CsvSession


class CsvRepository:
    """CSV-РЕПОЗИТОРИЙ ДАННЫХ"""

    # Инициализация репозитория
    def __init__(self) -> None:
        self.contract = CsvDataContract()
        self.session = CsvSession()

    # Нормализация bool-значения
    @staticmethod
    def _normalize_bool(value: Any) -> bool:
        if isinstance(value, bool):
            return value
        normalized = str(value).strip().lower()
        return normalized in {"true", "1", "yes", "да"}

    # Нормализация int-значения
    @staticmethod
    def _normalize_int(value: Any) -> int:
        if value in ("", None):
            return 0
        try:
            return int(float(str(value).replace(",", ".")))
        except Exception:
            return 0

    # Нормализация float-значения
    @staticmethod
    def _normalize_float(value: Any) -> float | None:
        if value in ("", None):
            return None
        try:
            return float(str(value).replace(",", "."))
        except Exception:
            return None

    # Разделение значений по ;
    @staticmethod
    def _split_values(value: Any) -> list[str]:
        if value in ("", None):
            return []
        return [item.strip() for item in str(value).split(";") if item.strip()]

    # Сборка тематических тегов
    def _build_themes(self, row: dict[str, Any]) -> list[str]:
        themes = set()
        for key in ("themes", "tags", "cuisine_types", "meal_options"):
            themes.update(self._split_values(row.get(key, "")))

        boolean_theme_map = {
            "family_friendly": "family",
            "kids_friendly": "kids",
            "romantic": "romantic",
            "local_food": "local_food",
            "wine_focus": "wine",
            "pet_friendly": "pet_friendly",
            "spa": "spa",
            "pool": "pool",
            "sea_view": "sea_view",
        }
        for source_key, theme_name in boolean_theme_map.items():
            if self._normalize_bool(row.get(source_key)):
                themes.add(theme_name)

        return sorted(themes)

    # Нормализация записи ресторана
    def _normalize_food_row(self, row: dict[str, Any]) -> dict[str, Any]:
        place = self.contract.create_place_record()
        place.update(
            {
                "place_id": f"food_{row.get('place_id', '')}",
                "source_table": "food",
                "category": "food",
                "name": row.get("name", ""),
                "address": row.get("address", ""),
                "lat": self._normalize_float(row.get("lat")),
                "lon": self._normalize_float(row.get("lon")),
                "area": row.get("area", ""),
                "city": row.get("city", ""),
                "place_type": row.get("place_type", ""),
                "opening_time": row.get("opening_time", ""),
                "closing_time": row.get("closing_time", ""),
                "working_days": self._split_values(row.get("working_days", "")),
                "seasonality": row.get("seasonality", "круглый_год"),
                "price_level": row.get("avg_bill_level", ""),
                "price_rub": self._normalize_int(row.get("avg_bill_rub")),
                "rating": self._normalize_float(row.get("rating")) or 0.0,
                "review_count": self._normalize_int(row.get("review_count")),
                "description": row.get("description", ""),
                "tags": self._split_values(row.get("cuisine_types", "")),
                "themes": self._build_themes(row),
                "family_friendly": self._normalize_bool(row.get("family_friendly")),
                "kids_friendly": self._normalize_bool(row.get("kids_friendly")),
                "romantic": self._normalize_bool(row.get("romantic")),
                "pet_friendly": False,
                "parking": self._normalize_bool(row.get("parking")),
                "booking_required": self._normalize_bool(row.get("reservation_required")),
                "raw_record": row,
            }
        )
        return place

    # Нормализация записи отеля
    def _normalize_hotel_row(self, row: dict[str, Any]) -> dict[str, Any]:
        place = self.contract.create_place_record()
        stay_tags = self._split_values(row.get("tags", ""))
        stay_tags.extend(self._split_values(row.get("meal_options", "")))
        stay_tags.extend(self._split_values(row.get("room_types", "")))
        place.update(
            {
                "place_id": f"hotel_{row.get('place_id', '')}",
                "source_table": "hotels",
                "category": "stay",
                "name": row.get("name", ""),
                "address": row.get("address", ""),
                "lat": self._normalize_float(row.get("lat")),
                "lon": self._normalize_float(row.get("lon")),
                "area": row.get("area", ""),
                "city": row.get("city", ""),
                "place_type": row.get("hotel_type", ""),
                "opening_time": row.get("check_in_time", ""),
                "closing_time": row.get("check_out_time", ""),
                "working_days": [],
                "seasonality": row.get("seasonality", "круглый_год"),
                "price_level": row.get("price_level", ""),
                "price_rub": self._normalize_int(row.get("avg_price_per_night_rub")),
                "rating": self._normalize_float(row.get("rating")) or 0.0,
                "review_count": self._normalize_int(row.get("review_count")),
                "description": row.get("description", ""),
                "tags": sorted(set(stay_tags)),
                "themes": self._build_themes(row),
                "family_friendly": self._normalize_bool(row.get("family_friendly")),
                "kids_friendly": self._normalize_bool(row.get("kids_friendly")),
                "romantic": self._normalize_bool(row.get("romantic")),
                "pet_friendly": self._normalize_bool(row.get("pet_friendly")),
                "parking": self._normalize_bool(row.get("parking")),
                "sea_view": self._normalize_bool(row.get("sea_view")),
                "availability_mode": row.get("availability_mode", ""),
                "raw_record": row,
            }
        )
        return place

    # Нормализация записи винодельни
    def _normalize_wine_row(self, row: dict[str, Any]) -> dict[str, Any]:
        place = self.contract.create_place_record()
        wine_tags = ["wine", "winery", row.get("size", "")]
        place.update(
            {
                "place_id": f"wine_{row.get('wines_id', '')}",
                "source_table": "wines",
                "category": "wine",
                "name": row.get("name", ""),
                "address": row.get("address", ""),
                "lat": self._normalize_float(row.get("lat")),
                "lon": self._normalize_float(row.get("lon")),
                "area": "",
                "city": row.get("city", ""),
                "place_type": "винодельня",
                "opening_time": row.get("opening_time", ""),
                "closing_time": row.get("closing_time", ""),
                "working_days": self._split_values(row.get("working_days", "")),
                "seasonality": row.get("seasonality", "круглый_год"),
                "price_level": "средний",
                "price_rub": 0,
                "rating": self._normalize_float(row.get("rating")) or 0.0,
                "review_count": self._normalize_int(row.get("review_count")),
                "description": row.get("description", ""),
                "tags": [tag for tag in wine_tags if tag],
                "themes": [
                    "вино",
                    "дегустация",
                    "гастрономия",
                    "экскурсия",
                ],
                "family_friendly": False,
                "kids_friendly": False,
                "romantic": False,
                "pet_friendly": False,
                "parking": False,
                "guided_experience": True,
                "raw_record": row,
            }
        )
        return place

    # Нормализация записи локации
    def _normalize_location_row(self, row: dict[str, Any]) -> dict[str, Any]:
        place = self.contract.create_place_record()
        place.update(
            {
                "place_id": f"loc_{row.get('place_id', '')}",
                "source_table": "locations",
                "category": "activity",
                "name": row.get("name", ""),
                "address": row.get("address", ""),
                "lat": self._normalize_float(row.get("lat")),
                "lon": self._normalize_float(row.get("lon")),
                "area": row.get("area", ""),
                "city": row.get("city", ""),
                "place_type": row.get("location_type", ""),
                "opening_time": row.get("opening_time", ""),
                "closing_time": row.get("closing_time", ""),
                "working_days": self._split_values(row.get("working_days", "")),
                "price_level": row.get("price_level", ""),
                "price_rub": self._normalize_int(row.get("price_rub")),
                "rating": self._normalize_float(row.get("rating")) or 0.0,
                "review_count": self._normalize_int(row.get("review_count")),
                "description": row.get("description", ""),
                "tags": self._split_values(row.get("tags", "")),
                "themes": self._split_values(row.get("themes", "")),
                "family_friendly": self._normalize_bool(row.get("family_friendly")),
                "kids_friendly": self._normalize_bool(row.get("kids_friendly")),
                "romantic": self._normalize_bool(row.get("romantic")),
                "pet_friendly": self._normalize_bool(row.get("pet_friendly")),
                "parking": self._normalize_bool(row.get("parking")),
                "booking_required": self._normalize_bool(row.get("booking_required")),
                "guided_experience": self._normalize_bool(row.get("guided_experience")),
                "seasonality": row.get("seasonality", "круглый_год"),
                "quiet_place": self._normalize_bool(row.get("quiet_place")),
                "raw_record": row,
            }
        )
        return place

    # Чтение ресторанов
    def read_food_places(self) -> list[dict[str, Any]]:
        rows = self.session.read_dataset("food")
        return [self._normalize_food_row(row) for row in rows]

    # Чтение отелей
    def read_hotel_places(self) -> list[dict[str, Any]]:
        rows = self.session.read_dataset("hotels")
        return [self._normalize_hotel_row(row) for row in rows]

    # Чтение локаций
    def read_location_places(self) -> list[dict[str, Any]]:
        rows = self.session.read_dataset("locations")
        return [self._normalize_location_row(row) for row in rows]

    # Чтение виноделен
    def read_wine_places(self) -> list[dict[str, Any]]:
        rows = self.session.read_dataset("wines")
        return [self._normalize_wine_row(row) for row in rows]

    # Чтение прогноза погоды
    def read_weather_rows(self) -> list[dict[str, Any]]:
        return self.session.read_dataset("weather")

    # Чтение всех мест
    def read_all_places(self) -> list[dict[str, Any]]:
        places: list[dict[str, Any]] = []
        places.extend(self.read_food_places())
        places.extend(self.read_hotel_places())
        places.extend(self.read_location_places())
        places.extend(self.read_wine_places())
        return places

    # Чтение пользователей
    def read_user_requests(self) -> list[dict[str, Any]]:
        return self.session.read_dataset("users")

    # Чтение базовых профилей пользователей
    def read_user_base_rows(self) -> list[dict[str, Any]]:
        return self.session.read_dataset("user_base")

    # Чтение user_01_base.csv
    def read_user_01_base_rows(self) -> list[dict[str, Any]]:
        return self.session.read_dataset("user_01_base")

    # Чтение строк уточнений user_detail.csv
    def read_user_detail_rows(self) -> list[dict[str, Any]]:
        return self.session.read_dataset("user_detail")

    # Чтение строк user_02_detail.csv
    def read_user_02_detail_rows(self) -> list[dict[str, Any]]:
        return self.session.read_dataset("user_02_detail")

    # Строка user_detail по user_id
    def find_user_detail_row(self, user_id: str) -> dict[str, Any] | None:
        target = str(user_id).strip()
        for row in self.read_user_detail_rows():
            if str(row.get("user_id", "")).strip() == target:
                return row
        return None

    # Поиск строки user_base по id
    def find_user_base_row(self, user_id: str) -> dict[str, Any] | None:
        target = str(user_id).strip()
        for row in self.read_user_base_rows():
            if str(row.get("id", "")).strip() == target:
                return row
        return None

    # Поиск строки user_01_base по id
    def find_user_01_base_row(self, user_id: str) -> dict[str, Any] | None:
        target = str(user_id).strip()
        for row in self.read_user_01_base_rows():
            if str(row.get("id", "")).strip() == target:
                return row
        return None

    # Последняя строка user_02_detail по user_id
    def find_latest_user_02_detail_row(self, user_id: str) -> dict[str, Any] | None:
        target = str(user_id).strip()
        matched_rows = [
            row for row in self.read_user_02_detail_rows()
            if str(row.get("user_id", "")).strip() == target
        ]
        if not matched_rows:
            return None
        return matched_rows[-1]

    # Строки base_route для пользователя
    def read_base_route_for_user(self, user_id: str) -> list[dict[str, Any]]:
        target = str(user_id).strip()
        rows = self.session.read_dataset("base_route")
        return [row for row in rows if str(row.get("user_id", "")).strip() == target]

    # Добавление расширенного профиля (refinement)
    def append_user_detailed(
        self,
        trip_request: dict[str, Any],
        user_id: str,
        refinement_raw_text: str,
    ) -> None:
        row = self.contract.build_user_detailed_row(
            trip_request,
            user_id=user_id,
            refinement_raw_text=refinement_raw_text,
        )
        self.session.append_rows(
            self.session.get_dataset_path("user_expanded"),
            self.contract.user_detailed_columns,
            [row],
        )

    # Добавление расширенного маршрута
    def append_extended_route_rows(self, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        self.session.append_rows(
            self.session.get_dataset_path("extended_route"),
            self.contract.base_route_columns,
            rows,
        )

    # Добавление нормализованного запроса пользователя
    def append_user_request(self, trip_request: dict[str, Any]) -> None:
        row = self.contract.build_user_row(trip_request)
        self.session.append_rows(
            self.session.get_dataset_path("users"),
            self.contract.users_columns,
            [row],
        )

    # Сохранение итоговых маршрутов
    def write_final_routes(self, rows: list[dict[str, Any]]) -> None:
        self.session.write_rows(
            self.session.get_dataset_path("final_routes"),
            self.contract.final_route_columns,
            rows,
        )

    # Сохранение nearby-рекомендаций
    def write_nearby_places(self, rows: list[dict[str, Any]]) -> None:
        self.session.write_rows(
            self.session.get_dataset_path("nearby_places"),
            self.contract.nearby_columns,
            rows,
        )


from app.db_connector.repositories import CsvRepository

# Запуск
if __name__ == "__main__":
    print(len(CsvRepository().read_all_places()))
