from __future__ import annotations

import math
import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import RankingConfig, RoutingConfig
from app.db_connector.models import CsvDataContract


class HybridRanker:
    """ГИБРИДНОЕ РАНЖИРОВАНИЕ"""

    # Инициализация ранкера
    def __init__(self) -> None:
        self.contract = CsvDataContract()
        self.ranking_cfg = RankingConfig()
        self.routing_cfg = RoutingConfig()

    # Ограничение score в диапазоне 0..1
    @staticmethod
    def _clamp_score(value: float) -> float:
        return max(0.0, min(1.0, value))

    # Подсчет расстояния по haversine
    @staticmethod
    def _distance_km(first_place: dict[str, Any], second_place: dict[str, Any]) -> float:
        if (
            first_place.get("lat") is None
            or first_place.get("lon") is None
            or second_place.get("lat") is None
            or second_place.get("lon") is None
        ):
            return 0.0

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

    # Оценка travel time по расстоянию
    def _estimate_travel_minutes(
        self,
        first_place: dict[str, Any],
        second_place: dict[str, Any],
    ) -> int:
        distance_km = self._distance_km(first_place, second_place)
        if distance_km <= 0:
            return 0
        return int(round((distance_km / self.routing_cfg.average_speed_kmh) * 60))

    # Нормализация semantic score
    def _normalize_semantic_score(self, semantic_score: float) -> float:
        return self._clamp_score((semantic_score + 1.0) / 2.0)

    # Нормализация строкового токена
    @staticmethod
    def _normalize_token(value: Any) -> str:
        return str(value or "").strip().lower().replace(" ", "_")

    # Нормализация набора токенов
    def _normalize_tokens(self, values: list[Any]) -> set[str]:
        return {
            self._normalize_token(value)
            for value in values
            if self._normalize_token(value)
        }

    # Оценка preference fit
    def _score_preferences(
        self,
        trip_request: dict[str, Any],
        place: dict[str, Any],
    ) -> float:
        scores: list[float] = []
        preferences = trip_request.get("preferences", {})
        constraints = trip_request.get("constraints", {})
        stay = trip_request.get("stay", {})

        user_themes = set(preferences.get("themes", []))
        place_tokens = set(place.get("themes", [])) | set(place.get("tags", []))
        if user_themes:
            overlap = len(user_themes & place_tokens)
            scores.append(overlap / max(len(user_themes), 1))

        focus_categories = [
            str(value).strip()
            for value in preferences.get("focus_categories", [])
            if str(value).strip()
        ]
        if focus_categories:
            category = str(place.get("category", "") or "")
            if category in focus_categories:
                rank = focus_categories.index(category)
                scores.append(max(0.55, 1.0 - rank * 0.15))
            else:
                scores.append(0.45)

        if place.get("category") == "stay" and stay.get("stay_needed"):
            requested_types = set(stay.get("accommodation_type", []))
            if not requested_types:
                scores.append(0.7)
            else:
                scores.append(1.0 if place.get("place_type") in requested_types else 0.35)

            preferred_tags = self._normalize_tokens(stay.get("preferred_tags", []))
            if preferred_tags:
                place_tags = self._normalize_tokens(place.get("tags", []))
                if not place_tags:
                    scores.append(0.55)
                else:
                    overlap = len(preferred_tags & place_tags)
                    scores.append(max(overlap / max(len(preferred_tags), 1), 0.35))

        user_budget = constraints.get("budget_level", "")
        if user_budget:
            if place.get("price_level") == user_budget:
                scores.append(1.0)
            elif user_budget == "средний" and place.get("price_level") in {"низкий", "высокий"}:
                scores.append(0.7)
            else:
                scores.append(0.45)

        preferred_zone = set(stay.get("preferred_zone", []))
        if preferred_zone:
            area_value = str(place.get("area", "")).replace(" ", "_")
            scores.append(1.0 if area_value in preferred_zone else 0.5)

        preferred_cities = self._normalize_tokens(
            trip_request.get("client_context", {}).get("preferred_cities", []),
        )
        if preferred_cities:
            place_city = self._normalize_token(place.get("city", ""))
            if place_city:
                scores.append(1.0 if place_city in preferred_cities else 0.5)

        if place.get("category") == "activity":
            preferred_location_themes = set(preferences.get("preferred_location_themes", []))
            if preferred_location_themes:
                location_overlap = len(preferred_location_themes & set(place.get("themes", [])))
                scores.append(max(location_overlap / max(len(preferred_location_themes), 1), 0.35))

            preferred_location_types = self._normalize_tokens(
                preferences.get("preferred_location_types", []),
            )
            if preferred_location_types:
                place_type = self._normalize_token(place.get("place_type", ""))
                scores.append(1.0 if place_type in preferred_location_types else 0.45)

        if place.get("category") == "food":
            preferred_food_place_types = self._normalize_tokens(
                preferences.get("preferred_food_place_types", []),
            )
            if preferred_food_place_types:
                place_type = self._normalize_token(place.get("place_type", ""))
                scores.append(1.0 if place_type in preferred_food_place_types else 0.45)

            preferred_cuisine_types = self._normalize_tokens(
                preferences.get("preferred_cuisine_types", []),
            )
            if preferred_cuisine_types:
                cuisine_overlap = len(preferred_cuisine_types & self._normalize_tokens(place.get("tags", [])))
                scores.append(max(cuisine_overlap / max(len(preferred_cuisine_types), 1), 0.35))

        must_have = set(constraints.get("must_have", []))
        if "parking" in must_have:
            scores.append(1.0 if place.get("parking") else 0.2)
        if "family_friendly" in must_have:
            scores.append(1.0 if place.get("family_friendly") else 0.2)
        if "pet_friendly" in must_have:
            scores.append(1.0 if place.get("pet_friendly") else 0.2)

        if not scores:
            return 0.6
        return self._clamp_score(sum(scores) / len(scores))

    # Оценка логистики
    def _score_logistics(
        self,
        trip_request: dict[str, Any],
        place: dict[str, Any],
        anchor_place: dict[str, Any] | None,
    ) -> float:
        max_transfer_minutes = trip_request.get("transport", {}).get("max_transfer_minutes", 0)
        if anchor_place is None or max_transfer_minutes <= 0:
            return 0.75 if place.get("lat") is not None and place.get("lon") is not None else 0.45

        travel_minutes = self._estimate_travel_minutes(anchor_place, place)
        if travel_minutes == 0:
            return 0.5
        if travel_minutes <= max_transfer_minutes:
            return 1.0 - min(travel_minutes / max(max_transfer_minutes, 1), 1.0) * 0.3
        overflow_ratio = travel_minutes / max(max_transfer_minutes, 1)
        return self._clamp_score(0.7 - min(overflow_ratio - 1.0, 1.0) * 0.7)

    # Оценка family fit
    @staticmethod
    def _score_family(trip_request: dict[str, Any], place: dict[str, Any]) -> float:
        party = trip_request.get("party", {})
        if party.get("children", 0) > 0:
            if place.get("kids_friendly"):
                return 1.0
            if place.get("family_friendly"):
                return 0.8
            return 0.25
        if party.get("group_type") == "семья":
            return 1.0 if place.get("family_friendly") else 0.35
        return 0.75

    # Оценка trust score
    @staticmethod
    def _score_trust(place: dict[str, Any]) -> float:
        rating = float(place.get("rating", 0.0) or 0.0) / 5.0
        reviews = min(float(place.get("review_count", 0) or 0) / 1000.0, 1.0)
        if rating <= 0:
            return 0.35 + reviews * 0.2
        return max(0.35, min(1.0, rating * 0.75 + reviews * 0.25))

    # Оценка влияния погоды
    @staticmethod
    def _score_weather(place: dict[str, Any], weather_rows: list[dict[str, Any]]) -> float:
        if not weather_rows:
            return 0.7

        has_bad_weather = any(str(row.get("is_bad_for_outdoor", "")).lower() == "true" for row in weather_rows)
        if not has_bad_weather:
            return 0.9

        if place.get("category") == "food" or place.get("category") == "stay":
            return 0.95
        if place.get("category") == "wine":
            return 0.55
        return 0.7

    # Оценка diversity
    @staticmethod
    def _score_diversity(
        place: dict[str, Any],
        used_places: list[dict[str, Any]],
    ) -> float:
        if not used_places:
            return 1.0

        same_category = sum(1 for item in used_places if item.get("category") == place.get("category"))
        same_area = sum(1 for item in used_places if item.get("area") == place.get("area"))
        score = 1.0 - min(same_category * 0.18, 0.45) - min(same_area * 0.08, 0.24)
        return max(0.35, score)

    # Построение explainability текста
    @staticmethod
    def _build_reason(place: dict[str, Any], scores: dict[str, float]) -> str:
        reasons: list[str] = []
        if scores["semantic_score"] >= 0.75:
            reasons.append("сильное семантическое совпадение")
        if scores["preference_score"] >= 0.75:
            reasons.append("хорошо совпадает с предпочтениями")
        if scores["logistics_score"] >= 0.75:
            reasons.append("удобно по логистике")
        if scores["family_score"] >= 0.75:
            reasons.append("подходит под состав группы")
        if place.get("rating", 0.0) >= 4.7:
            reasons.append("высокий рейтинг")
        return ", ".join(reasons) or "релевантный кандидат"

    # Ранжирование семантических кандидатов
    def rank_candidates(
        self,
        trip_request: dict[str, Any],
        semantic_hits: list[dict[str, Any]],
        weather_rows: list[dict[str, Any]] | None = None,
        anchor_place: dict[str, Any] | None = None,
        used_places: list[dict[str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        ranked_places: list[dict[str, Any]] = []
        used_places = used_places or []
        weather_rows = weather_rows or []

        for hit in semantic_hits:
            place = hit["place"]
            semantic_score = self._normalize_semantic_score(float(hit.get("semantic_score", 0.0)))
            preference_score = self._score_preferences(trip_request, place)
            logistics_score = self._score_logistics(trip_request, place, anchor_place)
            family_score = self._score_family(trip_request, place)
            trust_score = self._score_trust(place)
            diversity_score = self._score_diversity(place, used_places)
            weather_score = self._score_weather(place, weather_rows)

            total_score = (
                semantic_score * self.ranking_cfg.semantic_weight
                + preference_score * self.ranking_cfg.preference_weight
                + logistics_score * self.ranking_cfg.logistics_weight
                + family_score * self.ranking_cfg.family_weight
                + trust_score * self.ranking_cfg.trust_weight
                + diversity_score * self.ranking_cfg.diversity_weight
                + weather_score * self.ranking_cfg.weather_weight
            )

            score_payload = {
                "semantic_score": semantic_score,
                "preference_score": preference_score,
                "logistics_score": logistics_score,
                "family_score": family_score,
                "trust_score": trust_score,
                "diversity_score": diversity_score,
                "weather_score": weather_score,
            }

            ranked_place = self.contract.create_ranked_place()
            ranked_place.update(score_payload)
            ranked_place["place"] = place
            ranked_place["score"] = round(total_score, 4)
            ranked_place["why_selected"] = self._build_reason(place, score_payload)
            ranked_places.append(ranked_place)

        ranked_places.sort(key=lambda item: item["score"], reverse=True)
        return ranked_places

from app.ml_core.ranker import HybridRanker

# Запуск
if __name__ == "__main__":
    print(HybridRanker().__class__.__name__)
