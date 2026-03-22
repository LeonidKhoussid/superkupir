from __future__ import annotations

import csv
import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import CsvConfig, PathConfig
from app.db_connector.csv_normalize import CsvNormalize


class CsvSession:
    """CSV-СЕССИЯ ПРОЕКТА"""

    # Инициализация CSV-сессии
    def __init__(self) -> None:
        self.csv_cfg = CsvConfig()
        self.paths = PathConfig()
        self.paths.ensure_directories()

    # Чтение CSV-файла
    def read_rows(self, path: Path) -> list[dict[str, Any]]:
        if not path.exists():
            return []

        with path.open(
            "r",
            encoding=self.csv_cfg.encoding,
            newline="",
        ) as file:
            reader = csv.DictReader(file, delimiter=self.csv_cfg.delimiter)
            return [CsvNormalize.normalize_row(dict(row)) for row in reader]

    # Полная запись CSV-файла
    def write_rows(
        self,
        path: Path,
        fieldnames: list[str],
        rows: list[dict[str, Any]],
    ) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open(
            "w",
            encoding=self.csv_cfg.encoding,
            newline="",
        ) as file:
            writer = csv.DictWriter(
                file,
                fieldnames=fieldnames,
                delimiter=self.csv_cfg.delimiter,
            )
            writer.writeheader()
            clean = [CsvNormalize.sanitize_row_for_write(r, fieldnames) for r in rows]
            writer.writerows(clean)

    # Добавление строк в CSV-файл
    def append_rows(
        self,
        path: Path,
        fieldnames: list[str],
        rows: list[dict[str, Any]],
    ) -> None:
        if not rows:
            return

        path.parent.mkdir(parents=True, exist_ok=True)
        should_write_header = not path.exists() or path.stat().st_size == 0
        with path.open(
            "a",
            encoding=self.csv_cfg.encoding,
            newline="",
        ) as file:
            writer = csv.DictWriter(
                file,
                fieldnames=fieldnames,
                delimiter=self.csv_cfg.delimiter,
            )
            if should_write_header:
                writer.writeheader()
            clean = [CsvNormalize.sanitize_row_for_write(r, fieldnames) for r in rows]
            writer.writerows(clean)

    # Получение пути по имени датасета
    def get_dataset_path(self, dataset_name: str) -> Path:
        dataset_map = {
            "food": self.paths.food_csv_path,
            "hotels": self.paths.hotels_csv_path,
            "locations": self.paths.locations_csv_path,
            "weather": self.paths.weather_csv_path,
            "wines": self.paths.wines_csv_path,
            "wines_main": self.paths.wines_csv_path,
            "users": self.paths.users_csv_path,
            "user_base": self.paths.user_base_csv_path,
            "user_01_base": self.paths.user_01_base_csv_path,
            "user_detail": self.paths.user_detail_csv_path,
            "user_02_detail": self.paths.user_02_detail_csv_path,
            "user_expanded": self.paths.user_expanded_csv_path,
            "dialog": self.paths.dialog_csv_path,
            "recsys_01_base": self.paths.recsys_01_base_csv_path,
            "recsys_02_detail": self.paths.recsys_02_detail_csv_path,
            "base_route": self.paths.base_route_csv_path,
            "extended_route": self.paths.extended_route_csv_path,
            "final_routes": self.paths.final_routes_csv_path,
            "nearby_places": self.paths.nearby_places_csv_path,
            "similar_places": self.paths.similar_places_csv_path,
        }
        if dataset_name not in dataset_map:
            raise KeyError(f"Неизвестный датасет: {dataset_name}")
        return dataset_map[dataset_name]

    # Чтение датасета по имени
    def read_dataset(self, dataset_name: str) -> list[dict[str, Any]]:
        return self.read_rows(self.get_dataset_path(dataset_name))


from app.db_connector.session import CsvSession

# Запуск
if __name__ == "__main__":
    print(CsvSession().get_dataset_path("food"))