from __future__ import annotations

import csv
import sys
from pathlib import Path
from typing import Any


class PlacesCsvPipeline:
    """ОЧИСТКА CSV МЕСТ И ВИН"""

    _BOOL_TOKENS = frozenset(
        {"true", "false", "1", "0", "да", "нет", "yes", "no"},
    )

    _CITIES_ORDERED = (
        "Южная Озереевка",
        "Широкая Балка",
        "Абрау-Дюрсо",
        "Новороссийск",
        "Мысхако",
        "Федотовка",
    )

    # Корень проекта и каталоги ввода-вывода
    def __init__(self, base_dir: Path | None = None) -> None:
        self.base_dir = base_dir or Path(__file__).resolve().parents[1]
        self.backup_places_raw = self.base_dir / "data — копия" / "places" / "raw"
        self.backup_wines = self.base_dir / "data — копия" / "wines" / "wines_main.csv"
        self.output_dir = self.base_dir / "data" / "places"

    # Проверка пустой ячейки
    @classmethod
    def _is_empty(cls, value: Any) -> bool:
        if value is None:
            return True
        text = str(value).strip()
        if not text:
            return True
        low = text.lower()
        if low in {"nan", "none", "null", "#n/a", "n/a"}:
            return True
        return False

    # Колонка только с булевыми значениями
    def _column_is_bool_only(self, rows: list[dict[str, Any]], col: str) -> bool:
        seen: list[str] = []
        for row in rows:
            v = row.get(col, "")
            if self._is_empty(v):
                continue
            seen.append(str(v).strip().lower())
        if not seen:
            return False
        return all(s in self._BOOL_TOKENS for s in seen)

    # Есть ли пустые ячейки в колонке
    def _column_has_any_empty(self, rows: list[dict[str, Any]], col: str) -> bool:
        for row in rows:
            if self._is_empty(row.get(col, "")):
                return True
        return False

    # Извлечение города из строки адреса
    def _city_from_text(self, address: str, fallback: str = "") -> str:
        blob = f"{address} {fallback}".strip()
        if not blob:
            return ""
        for city in self._CITIES_ORDERED:
            if city in blob:
                return city
        return ""

    # Чтение UTF-8 CSV
    def _read_csv(self, path: Path) -> tuple[list[str], list[dict[str, Any]]]:
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            fieldnames = list(reader.fieldnames or [])
            rows = [dict(row) for row in reader]
        return fieldnames, rows

    # Запись UTF-8 CSV
    def _write_csv(
        self,
        path: Path,
        fieldnames: list[str],
        rows: list[dict[str, Any]],
    ) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for row in rows:
                writer.writerow({k: row.get(k, "") for k in fieldnames})

    # Очистка food.csv
    def _process_food(self, src: Path, dst: Path, type_stem: str) -> None:
        _, rows = self._read_csv(src)
        drop_exact = {
            "area",
            "opening_time",
            "closing_time",
            "working_days",
        }
        all_cols = list(rows[0].keys()) if rows else []
        drop: set[str] = set(drop_exact)
        for c in all_cols:
            if c in drop:
                continue
            if self._column_is_bool_only(rows, c):
                drop.add(c)
        keep = [c for c in all_cols if c not in drop]
        addr_key = "address" if "address" in keep else None
        out_rows: list[dict[str, Any]] = []
        for row in rows:
            new_row = {k: row.get(k, "") for k in keep}
            new_row["city"] = self._city_from_text(row.get(addr_key, "") if addr_key else "")
            new_row["type"] = type_stem
            out_rows.append(new_row)
        fieldnames = keep + ["city", "type"]
        self._write_csv(dst, fieldnames, out_rows)

    # Очистка hotels.csv
    def _process_hotels(self, src: Path, dst: Path, type_stem: str) -> None:
        _, rows = self._read_csv(src)
        drop_exact = {
            "area",
            "stars",
            "check_in_time",
            "check_out_time",
            "meal_options",
            "room_types",
            "availability_mode",
            "available_from",
            "available_to",
        }
        all_cols = list(rows[0].keys()) if rows else []
        drop: set[str] = set(drop_exact)
        for c in all_cols:
            if c in drop:
                continue
            if self._column_is_bool_only(rows, c):
                drop.add(c)
            elif self._column_has_any_empty(rows, c):
                drop.add(c)
        keep = [c for c in all_cols if c not in drop]
        addr_key = "address" if "address" in keep else None
        out_rows = []
        for row in rows:
            new_row = {k: row.get(k, "") for k in keep}
            new_row["city"] = self._city_from_text(row.get(addr_key, "") if addr_key else "")
            new_row["type"] = type_stem
            out_rows.append(new_row)
        fieldnames = keep + ["city", "type"]
        self._write_csv(dst, fieldnames, out_rows)

    # Очистка locations.csv
    def _process_locations(self, src: Path, dst: Path, type_stem: str) -> None:
        _, rows = self._read_csv(src)
        drop_exact = {
            "opening_time",
            "closing_time",
            "working_days",
            "avg_visit_duration_min",
            "price_level",
            "price_rub",
            "review_summary",
            "trust_score",
        }
        all_cols = list(rows[0].keys()) if rows else []
        drop: set[str] = set(drop_exact)
        for c in all_cols:
            if c in drop:
                continue
            if self._column_is_bool_only(rows, c):
                drop.add(c)
        keep = [c for c in all_cols if c not in drop]
        addr_key = "address" if "address" in keep else None
        out_rows = []
        for row in rows:
            new_row = {k: row.get(k, "") for k in keep}
            new_row["city"] = self._city_from_text(row.get(addr_key, "") if addr_key else "")
            new_row["type"] = type_stem
            out_rows.append(new_row)
        fieldnames = keep + ["city", "type"]
        self._write_csv(dst, fieldnames, out_rows)

    # Очистка wines_main.csv
    def _process_wines_main(self, src: Path, dst: Path, type_stem: str) -> None:
        _, rows = self._read_csv(src)
        if not rows:
            self._write_csv(dst, ["city", "type"], [])
            return
        all_cols = list(rows[0].keys())
        drop = {c for c in all_cols if self._column_has_any_empty(rows, c)}
        keep = [c for c in all_cols if c not in drop]
        addr_key = "address" if "address" in keep else None
        fb_key = "source_location" if "source_location" in keep else ""
        out_rows = []
        for row in rows:
            new_row = {k: row.get(k, "") for k in keep}
            addr = row.get(addr_key, "") if addr_key else ""
            fb = row.get(fb_key, "") if fb_key else ""
            new_row["city"] = self._city_from_text(str(addr), str(fb))
            new_row["type"] = type_stem
            out_rows.append(new_row)
        fieldnames = keep + ["city", "type"]
        self._write_csv(dst, fieldnames, out_rows)

    # Запуск всех шагов
    def run(self) -> None:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        jobs = [
            (self.backup_places_raw / "food.csv", self.output_dir / "food.csv", "food", self._process_food),
            (self.backup_places_raw / "hotels.csv", self.output_dir / "hotels.csv", "hotels", self._process_hotels),
            (self.backup_places_raw / "locations.csv", self.output_dir / "locations.csv", "locations", self._process_locations),
            (self.backup_wines, self.output_dir / "wines_main.csv", "wines_main", self._process_wines_main),
        ]
        for src, dst, stem, handler in jobs:
            if not src.exists():
                print(f"[etl] пропуск (нет файла): {src}", file=sys.stderr)
                continue
            handler(src, dst, stem)
            print(f"[etl] записано: {dst}")


# Запуск
if __name__ == "__main__":
    PlacesCsvPipeline().run()
