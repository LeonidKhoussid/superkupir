from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import numpy as np


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import EmbeddingConfig, RoutingConfig
from app.db_connector.repositories import CsvRepository
from app.ml_core.embeddings import PlaceEmbeddings
from app.ml_core.ranker import HybridRanker
from app.planner.constraints import TripConstraintChecker


class TripSearchService:
    """ПОИСК И КАНДИДАТЫ ПОЕЗДКИ"""

    # Инициализация поискового сервиса
    def __init__(self) -> None:
        self.repository = CsvRepository()
        self.embedding_cfg = EmbeddingConfig()
        self.routing_cfg = RoutingConfig()
        self.embeddings = PlaceEmbeddings()
        self.ranker = HybridRanker()
        self.constraint_checker = TripConstraintChecker()

    # Фильтрация релевантной погоды
    def _select_weather_rows(self, trip_request: dict[str, Any]) -> list[dict[str, Any]]:
        weather_rows = self.repository.read_weather_rows()
        if not weather_rows:
            return []

        destination_city = str(
            trip_request.get("client_context", {}).get("destination_city", "")
        ).lower()
        start_date = trip_request.get("dates", {}).get("start_date", "")

        filtered_weather = [
            row
            for row in weather_rows
            if (not destination_city or destination_city in str(row.get("city", "")).lower())
            and (not start_date or str(row.get("date", "")) >= start_date)
        ]
        return filtered_weather[:24]

    # Группировка мест по категориям
    @staticmethod
    def _group_places_by_category(places: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
        grouped_places = {
            "stay": [],
            "food": [],
            "wine": [],
            "activity": [],
        }
        for place in places:
            category = place.get("category", "")
            if category in grouped_places:
                grouped_places[category].append(place)
            else:
                grouped_places["activity"].append(place)
        return grouped_places

    # Группировка ранжированных мест по категориям
    def _group_ranked_candidates(
        self,
        ranked_candidates: list[dict[str, Any]],
    ) -> dict[str, list[dict[str, Any]]]:
        grouped_candidates = {
            "stay": [],
            "food": [],
            "wine": [],
            "activity": [],
        }

        for candidate in ranked_candidates:
            category = candidate["place"].get("category", "")
            if category == "stay":
                grouped_candidates["stay"].append(candidate)
            elif category == "food":
                grouped_candidates["food"].append(candidate)
            elif category == "wine":
                grouped_candidates["wine"].append(candidate)
            else:
                grouped_candidates["activity"].append(candidate)

        for category_name, items in grouped_candidates.items():
            grouped_candidates[category_name] = items[: self.routing_cfg.max_candidates_per_category]
        return grouped_candidates

    # Поиск подходящих кандидатов
    def search(self, trip_request: dict[str, Any]) -> dict[str, Any]:
        all_places = self.repository.read_all_places()
        filtered_places = self.constraint_checker.filter_places(trip_request, all_places)
        cached_embedding = trip_request.get("query_embedding", [])
        if isinstance(cached_embedding, list) and cached_embedding:
            query_embedding = np.asarray(cached_embedding, dtype=np.float32)
        else:
            query_embedding = self.embeddings.encode_query(trip_request)
        grouped_places = self._group_places_by_category(filtered_places)

        semantic_hits: list[dict[str, Any]] = []
        for category_name, category_places in grouped_places.items():
            if not category_places:
                continue
            category_limit = max(self.routing_cfg.max_candidates_per_category * 3, 10)
            semantic_hits.extend(
                self.embeddings.semantic_search(
                    query_vector=query_embedding,
                    places=category_places,
                    top_k=category_limit,
                )
            )

        ranked_candidates = self.ranker.rank_candidates(
            trip_request=trip_request,
            semantic_hits=semantic_hits,
            weather_rows=[],
        )
        grouped_candidates = self._group_ranked_candidates(ranked_candidates)

        return {
            "query_embedding": query_embedding.tolist(),
            "weather_rows": [],
            "all_places": all_places,
            "filtered_places": filtered_places,
            "ranked_candidates": ranked_candidates,
            "grouped_candidates": grouped_candidates,
        }


from app.services.search import TripSearchService

# Запуск
if __name__ == "__main__":
    print(TripSearchService().__class__.__name__)
