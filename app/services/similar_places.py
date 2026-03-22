from __future__ import annotations

import math
import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import PathConfig
from app.db_connector.models import CsvDataContract
from app.db_connector.repositories import CsvRepository
from app.db_connector.session import CsvSession


class SimilarPlacesFinder:
    """ПОИСК ПОХОЖИХ ТОЧЕК ПО ПРИЗНАКАМ"""

    _BOOL_KEYS = (
        "family_friendly",
        "kids_friendly",
        "romantic",
        "pet_friendly",
        "parking",
    )
    _PRICE_RANK = {"бесплатно": 0, "низкий": 1, "средний": 2, "высокий": 3}

    def __init__(self) -> None:
        self.paths = PathConfig()
        self.paths.ensure_directories()
        self.repository = CsvRepository()
        self.contract = CsvDataContract()
        self.csv_session = CsvSession()
        self.w_jaccard = 0.30
        self.w_type = 0.15
        self.w_price_level = 0.15
        self.w_price_rub = 0.10
        self.w_geo = 0.15
        self.w_bool = 0.15

    # Haversine между двумя точками (км)
    @staticmethod
    def _distance_km(a: dict[str, Any], b: dict[str, Any]) -> float | None:
        if (
            a.get("lat") is None
            or a.get("lon") is None
            or b.get("lat") is None
            or b.get("lon") is None
        ):
            return None
        r = 6371.0
        lat1, lon1 = math.radians(float(a["lat"])), math.radians(float(a["lon"]))
        lat2, lon2 = math.radians(float(b["lat"])), math.radians(float(b["lon"]))
        dlat, dlon = lat2 - lat1, lon2 - lon1
        h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        return r * 2 * math.asin(math.sqrt(h))

    # Разбор place_id и загрузка пула кандидатов
    def _load_pool(self, place_id: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        pid = place_id.strip()
        if pid.startswith("hotel_"):
            pool = self.repository.read_hotel_places()
        elif pid.startswith("food_"):
            pool = self.repository.read_food_places()
        elif pid.startswith("loc_"):
            pool = self.repository.read_location_places()
        elif pid.startswith("wine_"):
            pool = self.repository.read_wine_places()
        else:
            raise ValueError(
                "Неверный place_id: ожидается префикс hotel_, food_, loc_ или wine_",
            )
        anchor: dict[str, Any] | None = None
        for p in pool:
            if p.get("place_id") == pid:
                anchor = p
                break
        if anchor is None:
            raise ValueError(f"Точка не найдена: {place_id}")
        return anchor, pool

    # Jaccard по темам и тегам
    @staticmethod
    def _jaccard_themes_tags(anchor: dict[str, Any], cand: dict[str, Any]) -> float:
        sa = set(anchor.get("themes", [])) | set(anchor.get("tags", []))
        sb = set(cand.get("themes", [])) | set(cand.get("tags", []))
        if not sa and not sb:
            return 0.5
        inter = len(sa & sb)
        union = len(sa | sb)
        return inter / union if union else 0.5

    # Совпадение уровня цены
    def _price_level_score(self, anchor: dict[str, Any], cand: dict[str, Any]) -> float:
        la = str(anchor.get("price_level", "") or "").strip().lower()
        lb = str(cand.get("price_level", "") or "").strip().lower()
        if not la or not lb:
            return 0.5
        ra = self._PRICE_RANK.get(la)
        rb = self._PRICE_RANK.get(lb)
        if ra is None or rb is None:
            return 1.0 if la == lb else 0.4
        if ra == rb:
            return 1.0
        if abs(ra - rb) == 1:
            return 0.5
        return 0.2

    # Близость числовой цены
    @staticmethod
    def _price_rub_score(anchor: dict[str, Any], cand: dict[str, Any]) -> float:
        pa = int(anchor.get("price_rub", 0) or 0)
        pb = int(cand.get("price_rub", 0) or 0)
        if pa <= 0 or pb <= 0:
            return 0.5
        hi, lo = max(pa, pb), min(pa, pb)
        return lo / hi if hi else 0.5

    # Гео-близость к якорю
    def _geo_score(self, anchor: dict[str, Any], cand: dict[str, Any]) -> float:
        dist = self._distance_km(anchor, cand)
        if dist is None:
            return 0.5
        return 1.0 / (1.0 + dist)

    # Доля совпадения булевых признаков
    def _bool_score(self, anchor: dict[str, Any], cand: dict[str, Any]) -> float:
        n = 0
        matches = 0
        for key in self._BOOL_KEYS:
            av = anchor.get(key)
            cv = cand.get(key)
            if isinstance(av, bool) and isinstance(cv, bool):
                n += 1
                if av == cv:
                    matches += 1
        if n == 0:
            return 0.5
        return matches / n

    # Скоринг кандидата относительно якоря
    def _similarity_score(self, anchor: dict[str, Any], cand: dict[str, Any]) -> float:
        at = str(anchor.get("place_type") or "").strip()
        bt = str(cand.get("place_type") or "").strip()
        if not at and not bt:
            type_sc = 0.5
        elif at == bt:
            type_sc = 1.0
        else:
            type_sc = 0.0

        jac = self._jaccard_themes_tags(anchor, cand)
        pl = self._price_level_score(anchor, cand)
        pr = self._price_rub_score(anchor, cand)
        geo = self._geo_score(anchor, cand)
        boo = self._bool_score(anchor, cand)

        total = (
            self.w_jaccard * jac
            + self.w_type * type_sc
            + self.w_price_level * pl
            + self.w_price_rub * pr
            + self.w_geo * geo
            + self.w_bool * boo
        )
        wsum = (
            self.w_jaccard
            + self.w_type
            + self.w_price_level
            + self.w_price_rub
            + self.w_geo
            + self.w_bool
        )
        return round(total / wsum, 4) if wsum else 0.0

    # Построение строки для CSV
    def _build_row(
        self,
        anchor_id: str,
        score: float,
        place: dict[str, Any],
    ) -> dict[str, Any]:
        themes = ";".join(place.get("themes", []) or [])
        tags = ";".join(place.get("tags", []) or [])
        flat = self.contract.flatten_place_source_fields(place)
        row: dict[str, Any] = {
            "anchor_place_id": anchor_id,
            "similarity_score": score,
            "place_id": place.get("place_id", ""),
            "source_table": place.get("source_table", ""),
            "category": place.get("category", ""),
            "place_type": place.get("place_type", ""),
            "name": place.get("name", ""),
            "lat": place.get("lat"),
            "lon": place.get("lon"),
            "area": place.get("area", ""),
            "price_level": place.get("price_level", ""),
            "price_rub": place.get("price_rub", 0),
            "rating": place.get("rating", 0.0),
            "themes": themes,
            "tags": tags,
            "description": place.get("description", ""),
        }
        row.update(flat)
        return row

    # Ранжирование похожих без записи
    def _rank_similar(self, place_id: str, top_k: int) -> list[dict[str, Any]]:
        anchor, pool = self._load_pool(place_id)
        scored: list[tuple[float, dict[str, Any]]] = []
        for cand in pool:
            if cand.get("place_id") == anchor.get("place_id"):
                continue
            sc = self._similarity_score(anchor, cand)
            scored.append((sc, cand))
        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[: max(0, top_k)]
        return [self._build_row(place_id, sc, p) for sc, p in top]

    # Поиск похожих и сохранение в CSV
    def find_and_save(
        self,
        place_id: str,
        top_k: int = 12,
        output_path: Path | None = None,
    ) -> tuple[list[dict[str, Any]], Path]:
        rows = self._rank_similar(place_id, top_k)
        out = output_path or self.paths.similar_places_csv_path
        self.csv_session.write_rows(
            out,
            self.contract.similar_places_columns,
            rows,
        )
        return rows, out

    # Поиск без записи (для API)
    def find_similar(self, place_id: str, top_k: int = 12) -> list[dict[str, Any]]:
        return self._rank_similar(place_id, top_k)


# Запуск
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Похожие точки по place_id")
    parser.add_argument("place_id", nargs="?", default="hotel_1", help="hotel_*, food_*, loc_*, wine_*")
    parser.add_argument("-k", "--top-k", type=int, default=12)
    args = parser.parse_args()
    finder = SimilarPlacesFinder()
    result, path = finder.find_and_save(args.place_id, top_k=args.top_k)
    print(f"Сохранено {len(result)} строк в {path}")
