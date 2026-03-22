from __future__ import annotations

import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.db_connector.models import CsvDataContract
from app.db_connector.session import CsvSession


class BackendCsvExporter:
    """ЭКСПОРТ CSV ДЛЯ ОСНОВНОГО БЕКА"""

    # Инициализация экспортера
    def __init__(self) -> None:
        self.contract = CsvDataContract()
        self.session = CsvSession()
        self._source_index: dict[tuple[str, str], dict[str, Any]] | None = None

    # Нормализация текста
    @staticmethod
    def _normalize_text(value: Any) -> str:
        return " ".join(str(value or "").replace("\n", " ").split()).strip()

    # Нормализация числового значения
    @staticmethod
    def _as_float(value: Any) -> float | None:
        if value in ("", None):
            return None
        try:
            return float(str(value).replace(",", "."))
        except Exception:
            return None

    # Нормализация целочисленного значения
    @staticmethod
    def _as_int(value: Any) -> int:
        if value in ("", None):
            return 0
        try:
            return int(float(str(value).replace(",", ".")))
        except Exception:
            return 0

    # Построение lookup по сырым place-таблицам
    def _build_source_index(self) -> dict[tuple[str, str], dict[str, Any]]:
        datasets = {
            "food": self.session.read_dataset("food"),
            "hotels": self.session.read_dataset("hotels"),
            "locations": self.session.read_dataset("locations"),
            "wines": self.session.read_dataset("wines"),
        }
        index: dict[tuple[str, str], dict[str, Any]] = {}
        for source_table, rows in datasets.items():
            for row in rows:
                raw_id = row.get("place_id", "") if source_table != "wines" else row.get("wines_id", "")
                normalized_id = self._normalize_text(raw_id)
                if not normalized_id:
                    continue
                index[(source_table, normalized_id)] = dict(row)
        return index

    # Получение lookup по сырому источнику
    def _get_source_index(self) -> dict[tuple[str, str], dict[str, Any]]:
        if self._source_index is None:
            self._source_index = self._build_source_index()
        return self._source_index

    # Поиск сырой строки места
    def _find_source_row(self, route_row: dict[str, Any]) -> dict[str, Any]:
        source_table = self._normalize_text(route_row.get("source_table", ""))
        raw_id = self._normalize_text(route_row.get("source_place_id", ""))
        if not source_table:
            return {}
        if raw_id:
            return self._get_source_index().get((source_table, raw_id), {})

        place_id = self._normalize_text(route_row.get("place_id", ""))
        numeric_id = place_id.split("_", 1)[1] if "_" in place_id else place_id
        return self._get_source_index().get((source_table, numeric_id), {})

    # Вычисление длительности посещения
    def _estimate_duration(self, route_row: dict[str, Any]) -> int:
        duration_min = self._as_int(route_row.get("duration_min", 0))
        if duration_min > 0:
            return duration_min

        category = self._normalize_text(route_row.get("category", ""))
        duration_map = {
            "stay": 60,
            "food": 90,
            "wine": 120,
            "activity": 120,
        }
        return duration_map.get(category, 90)

    # Вычисление примерной стоимости
    def _estimate_cost(self, route_row: dict[str, Any], source_row: dict[str, Any]) -> str:
        value_candidates = [
            route_row.get("avg_price_per_night_rub", ""),
            route_row.get("avg_bill_rub", ""),
            route_row.get("loc_price_rub", ""),
            source_row.get("avg_price_per_night_rub", ""),
            source_row.get("avg_bill_rub", ""),
            source_row.get("price_rub", ""),
        ]
        for candidate in value_candidates:
            price_value = self._as_int(candidate)
            if price_value > 0:
                return str(price_value)
        return ""

    # Поиск картинки места
    def _extract_image_url(self, route_row: dict[str, Any], source_row: dict[str, Any]) -> str:
        for key in ("image_url", "photo_url", "image", "logo_url", "card_url"):
            route_value = self._normalize_text(route_row.get(key, ""))
            if route_value:
                return route_value
            source_value = self._normalize_text(source_row.get(key, ""))
            if source_value:
                return source_value
        return ""

    # Вычисление сезона точки
    def _resolve_season(self, route_row: dict[str, Any], source_row: dict[str, Any]) -> str:
        season = self._normalize_text(source_row.get("seasonality", ""))
        if season:
            return season
        return self._normalize_text(route_row.get("travel_season", "")) or "круглый_год"

    # Сборка одной backend-строки
    def _build_backend_row(self, route_row: dict[str, Any]) -> dict[str, Any]:
        source_row = self._find_source_row(route_row)
        latitude = self._as_float(route_row.get("lat"))
        longitude = self._as_float(route_row.get("lon"))
        return {
            "user_id": self._normalize_text(route_row.get("user_id", "")),
            "day": self._as_int(route_row.get("day", 0)),
            "place_id": self._normalize_text(route_row.get("place_id", "")),
            "name": self._normalize_text(route_row.get("name", "")),
            "description": self._normalize_text(route_row.get("description", "")),
            "type": self._normalize_text(route_row.get("place_type", "") or route_row.get("category", "")),
            "latitude": latitude if latitude is not None else "",
            "longitude": longitude if longitude is not None else "",
            "address": self._normalize_text(route_row.get("address", "")),
            "estimated_duration": self._estimate_duration(route_row),
            "estimated_cost": self._estimate_cost(route_row, source_row),
            "image_url": self._extract_image_url(route_row, source_row),
            "season": self._resolve_season(route_row, source_row),
        }

    # Экспорт набора route-строк в backend-формат
    def export_rows(self, route_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        exported_rows = [self._build_backend_row(route_row) for route_row in route_rows]
        return [
            row
            for row in exported_rows
            if self._normalize_text(row.get("place_id", ""))
        ]

    # Запись backend-CSV
    def write_rows(self, path: Path, route_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        backend_rows = self.export_rows(route_rows)
        self.session.write_rows(path, self.contract.backend_route_columns, backend_rows)
        return backend_rows


from app.services.backend_exporter import BackendCsvExporter

# Запуск
if __name__ == "__main__":
    print(BackendCsvExporter().__class__.__name__)
