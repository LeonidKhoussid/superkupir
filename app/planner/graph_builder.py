from __future__ import annotations

import math
import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import RoutingConfig


class TripGraphBuilder:
    """ПОСТРОЕНИЕ ГРАФА ПОЕЗДКИ"""

    # Инициализация граф-билдера
    def __init__(self) -> None:
        self.routing_cfg = RoutingConfig()

    # Расчет расстояния в км
    @staticmethod
    def _distance_km(first_place: dict[str, Any], second_place: dict[str, Any]) -> float:
        if (
            first_place.get("lat") is None
            or first_place.get("lon") is None
            or second_place.get("lat") is None
            or second_place.get("lon") is None
        ):
            return float("inf")

        radius_km = 6371.0
        lat1 = math.radians(float(first_place["lat"]))
        lon1 = math.radians(float(first_place["lon"]))
        lat2 = math.radians(float(second_place["lat"]))
        lon2 = math.radians(float(second_place["lon"]))
        delta_lat = lat2 - lat1
        delta_lon = lon2 - lon1
        haversine = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
        )
        return radius_km * 2 * math.asin(math.sqrt(haversine))

    # Оценка времени в пути
    def _estimate_travel_minutes(
        self,
        first_place: dict[str, Any],
        second_place: dict[str, Any],
    ) -> int:
        distance_km = self._distance_km(first_place, second_place)
        if distance_km == float("inf"):
            return 9999
        return int(round((distance_km / self.routing_cfg.average_speed_kmh) * 60))

    # Построение in-memory графа
    def build_graph(self, places: list[dict[str, Any]]) -> dict[str, Any]:
        nodes = {place["place_id"]: place for place in places}
        edges: list[dict[str, Any]] = []

        for source_place in places:
            for target_place in places:
                if source_place["place_id"] == target_place["place_id"]:
                    continue

                distance_km = self._distance_km(source_place, target_place)
                if distance_km == float("inf"):
                    continue

                shared_themes = set(source_place.get("themes", [])) & set(target_place.get("themes", []))
                edge_types = ["travel_time_to"]
                if distance_km <= self.routing_cfg.nearby_radius_km:
                    edge_types.append("located_near")
                if shared_themes:
                    edge_types.append("same_theme_as")

                edges.append(
                    {
                        "from_id": source_place["place_id"],
                        "to_id": target_place["place_id"],
                        "edge_types": edge_types,
                        "distance_km": round(distance_km, 3),
                        "travel_time_min": self._estimate_travel_minutes(
                            source_place,
                            target_place,
                        ),
                    }
                )

        return {
            "nodes": nodes,
            "edges": edges,
        }

    # Получение соседних мест
    def get_nearby_places(
        self,
        anchor_place: dict[str, Any],
        places: list[dict[str, Any]],
        limit: int,
        allowed_categories: set[str] | None = None,
    ) -> list[dict[str, Any]]:
        nearby_candidates: list[dict[str, Any]] = []
        for place in places:
            if place["place_id"] == anchor_place["place_id"]:
                continue
            if allowed_categories is not None and place.get("category") not in allowed_categories:
                continue

            distance_km = self._distance_km(anchor_place, place)
            if distance_km == float("inf") or distance_km > self.routing_cfg.nearby_radius_km:
                continue

            nearby_candidates.append(
                {
                    "place": place,
                    "distance_km": round(distance_km, 3),
                    "travel_estimate_min": self._estimate_travel_minutes(anchor_place, place),
                }
            )

        nearby_candidates.sort(key=lambda item: item["distance_km"])
        return nearby_candidates[:limit]

from app.planner.graph_builder import TripGraphBuilder

# Запуск
if __name__ == "__main__":
    print(TripGraphBuilder().__class__.__name__)
