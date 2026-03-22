from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import RoutingConfig
from app.planner.graph_builder import TripGraphBuilder


class RouteOptimizer:
    """ОПТИМИЗАЦИЯ МАРШРУТА"""

    # Инициализация оптимизатора
    def __init__(self) -> None:
        self.routing_cfg = RoutingConfig()
        self.graph_builder = TripGraphBuilder()

    # Парсинг времени HH:MM
    @staticmethod
    def _time_to_minutes(time_text: str, default_minutes: int) -> int:
        if not time_text or ":" not in time_text:
            return default_minutes
        try:
            hours, minutes = time_text.split(":", maxsplit=1)
            return int(hours) * 60 + int(minutes)
        except Exception:
            return default_minutes

    # Форматирование datetime строки
    @staticmethod
    def _format_datetime(date_value: datetime, minutes_from_midnight: int) -> str:
        midnight = date_value.replace(hour=0, minute=0, second=0, microsecond=0)
        return (midnight + timedelta(minutes=minutes_from_midnight)).strftime("%Y-%m-%d %H:%M")

    # Получение даты старта маршрута
    @staticmethod
    def _get_start_date(trip_request: dict[str, Any]) -> datetime:
        start_date = trip_request.get("dates", {}).get("start_date", "")
        if start_date:
            try:
                return datetime.strptime(start_date, "%Y-%m-%d")
            except Exception:
                return datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        return datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    # Выбор якорного отеля
    @staticmethod
    def _select_hotel(
        stay_candidates: list[dict[str, Any]],
        variant_index: int,
    ) -> dict[str, Any] | None:
        if not stay_candidates:
            return None
        candidate_index = min(variant_index, len(stay_candidates) - 1)
        return stay_candidates[candidate_index]

    # Нормализация ключа
    @staticmethod
    def _normalize_key(value: Any) -> str:
        return str(value or "").strip().lower().replace(" ", "_")

    # Нормализация типа точки
    def _place_type_key(self, place: dict[str, Any]) -> str:
        return self._normalize_key(place.get("place_type", "") or place.get("category", ""))

    # Явно ли пользователь просит винодельни
    def _has_explicit_wine_request(self, trip_request: dict[str, Any]) -> bool:
        preferences = trip_request.get("preferences", {})
        raw_tokens: list[str] = []
        for key in (
            "themes",
            "food_preferences",
            "preferred_cuisine_types",
            "preferred_location_types",
            "focus_categories",
        ):
            raw_tokens.extend(preferences.get(key, []))
        raw_tokens.extend(str(trip_request.get("query_text", "") or "").split())
        raw_tokens.extend(str(trip_request.get("semantic_profile_text", "") or "").split())
        normalized_tokens = {self._normalize_key(token) for token in raw_tokens if self._normalize_key(token)}
        wine_tokens = {
            "вино",
            "wine",
            "винодельня",
            "винный_тур",
            "дегустация",
        }
        return bool(normalized_tokens & wine_tokens) or "wine" in normalized_tokens

    # Максимум винодельных stop-ов на поездку
    def _get_trip_wine_limit(
        self,
        trip_request: dict[str, Any],
        days_count: int,
    ) -> int:
        if not self._has_explicit_wine_request(trip_request):
            return 0
        computed_limit = max(1, (days_count + 1) // 2)
        return min(computed_limit, self.routing_cfg.max_wine_stops_per_trip)

    # Число stop-ов на день с учётом варианта и темпа
    def _get_daily_stop_limit(
        self,
        variant_name: str,
        trip_request: dict[str, Any],
    ) -> int:
        variant_map = {
            "relaxed": self.routing_cfg.relaxed_daily_stop_limit,
            "balanced": self.routing_cfg.balanced_daily_stop_limit,
            "dense": self.routing_cfg.dense_daily_stop_limit,
        }
        stop_limit = variant_map.get(variant_name, self.routing_cfg.balanced_daily_stop_limit)
        pace = str(trip_request.get("preferences", {}).get("pace", "") or "").strip().lower()
        if pace in {"спокойный", "низкий", "медленно", "slow", "relaxed"}:
            stop_limit = max(3, stop_limit - 1)
        elif pace in {"активный", "плотный", "быстро", "интенсив", "intense"}:
            stop_limit = min(self.routing_cfg.max_daily_stops, stop_limit + 1)
        return min(stop_limit, self.routing_cfg.max_daily_stops)

    # Число активностей на день с учётом варианта и темпа из запроса
    def _get_daily_activity_limit(
        self,
        variant_name: str,
        trip_request: dict[str, Any],
    ) -> int:
        variant_map = {
            "relaxed": self.routing_cfg.relaxed_daily_activity_limit,
            "balanced": self.routing_cfg.balanced_daily_activity_limit,
            "dense": self.routing_cfg.dense_daily_activity_limit,
        }
        activity_limit = variant_map.get(variant_name, self.routing_cfg.balanced_daily_activity_limit)
        pace = str(trip_request.get("preferences", {}).get("pace", "") or "").strip().lower()
        if pace in {"спокойный", "низкий", "медленно", "slow", "relaxed"}:
            activity_limit = max(1, activity_limit - 1)
        elif pace in {"активный", "плотный", "быстро", "интенсив", "intense"}:
            activity_limit = min(4, activity_limit + 1)
        return activity_limit

    # Оценка перехода к следующему кандидату
    def _score_transition(
        self,
        trip_request: dict[str, Any],
        anchor_place: dict[str, Any] | None,
        candidate: dict[str, Any],
    ) -> float:
        base_score = float(candidate.get("score", 0.0))
        if anchor_place is None:
            return base_score

        travel_minutes = self.graph_builder._estimate_travel_minutes(
            anchor_place,
            candidate["place"],
        )
        max_transfer = int(
            trip_request.get("transport", {}).get("max_transfer_minutes", 0)
            or self.routing_cfg.default_transfer_minutes,
        )
        if travel_minutes == 9999:
            travel_score = 0.0
        else:
            travel_score = max(0.0, 1.0 - min(travel_minutes / max(max_transfer, 1), 1.0))

        same_area_bonus = 0.0
        anchor_area = self._normalize_key(anchor_place.get("area", ""))
        candidate_area = self._normalize_key(candidate["place"].get("area", ""))
        if anchor_area and anchor_area == candidate_area:
            same_area_bonus = 0.05

        same_city_bonus = 0.0
        anchor_city = self._normalize_key(anchor_place.get("city", ""))
        candidate_city = self._normalize_key(candidate["place"].get("city", ""))
        if anchor_city and anchor_city == candidate_city:
            same_city_bonus = 0.04

        return round(base_score * 0.8 + travel_score * 0.2 + same_area_bonus + same_city_bonus, 6)

    # Выбор лучшего кандидата из пула
    def _pick_candidate(
        self,
        trip_request: dict[str, Any],
        pool: list[dict[str, Any]],
        used_place_ids: set[str],
        anchor_place: dict[str, Any] | None,
        used_type_keys: set[str] | None = None,
    ) -> dict[str, Any] | None:
        filtered = [
            candidate
            for candidate in pool
            if candidate.get("place", {}).get("place_id", "") not in used_place_ids
        ]
        if not filtered:
            return None

        if used_type_keys is not None:
            unique_type_candidates = [
                candidate
                for candidate in filtered
                if self._place_type_key(candidate.get("place", {})) not in used_type_keys
            ]
            if unique_type_candidates:
                filtered = unique_type_candidates

        filtered.sort(
            key=lambda candidate: self._score_transition(
                trip_request,
                anchor_place,
                candidate,
            ),
            reverse=True,
        )
        return filtered[0]

    # Формирование stop-объекта
    def _build_stop(
        self,
        day_index: int,
        stop_order: int,
        place: dict[str, Any],
        start_date: datetime,
        start_minutes: int,
        duration_min: int,
        score: float,
        why_selected: str,
        previous_place: dict[str, Any] | None,
    ) -> dict[str, Any]:
        distance_from_prev_km = 0.0
        travel_estimate_min = 0
        if previous_place is not None:
            distance_from_prev_km = round(
                self.graph_builder._distance_km(previous_place, place),
                3,
            )
            if distance_from_prev_km == float("inf"):
                distance_from_prev_km = 0.0
            travel_estimate_min = self.graph_builder._estimate_travel_minutes(
                previous_place,
                place,
            )
            if travel_estimate_min == 9999:
                travel_estimate_min = 0

        day_date = start_date + timedelta(days=day_index - 1)
        end_minutes = start_minutes + duration_min
        return {
            "day": day_index,
            "stop_order": stop_order,
            "place": place,
            "start_time": self._format_datetime(day_date, start_minutes),
            "end_time": self._format_datetime(day_date, end_minutes),
            "duration_min": duration_min,
            "score": round(score, 4),
            "distance_from_prev_km": distance_from_prev_km,
            "travel_estimate_min": travel_estimate_min,
            "why_selected": why_selected,
        }

    # Добавление stop-а в маршрут
    def _append_stop(
        self,
        day_stops: list[dict[str, Any]],
        day_index: int,
        stop_order: int,
        candidate: dict[str, Any],
        start_date: datetime,
        start_minutes: int,
        duration_min: int,
        previous_place: dict[str, Any] | None,
    ) -> tuple[dict[str, Any], int, int]:
        place = candidate["place"]
        travel_minutes = 0
        if previous_place is not None:
            travel_minutes = self.graph_builder._estimate_travel_minutes(previous_place, place)
            if travel_minutes == 9999:
                travel_minutes = 0
        effective_start = start_minutes + travel_minutes if previous_place is not None else start_minutes
        stop_payload = self._build_stop(
            day_index=day_index,
            stop_order=stop_order,
            place=place,
            start_date=start_date,
            start_minutes=effective_start,
            duration_min=duration_min,
            score=float(candidate.get("score", 0.0)),
            why_selected=candidate.get("why_selected", "релевантная точка"),
            previous_place=previous_place,
        )
        day_stops.append(stop_payload)
        return place, effective_start + duration_min, stop_order + 1

    # Сборка дневного плана
    def _build_day_plan(
        self,
        day_index: int,
        trip_request: dict[str, Any],
        start_date: datetime,
        variant_name: str,
        hotel_candidate: dict[str, Any] | None,
        activity_pool: list[dict[str, Any]],
        wine_pool: list[dict[str, Any]],
        food_pool: list[dict[str, Any]],
        used_place_ids: set[str],
        used_activity_types: set[str],
        trip_wine_count: int,
        trip_wine_limit: int,
    ) -> tuple[list[dict[str, Any]], int]:
        day_stops: list[dict[str, Any]] = []
        stop_order = 1
        day_wine_count = 0
        day_limit = self._get_daily_stop_limit(variant_name, trip_request)
        activity_limit = self._get_daily_activity_limit(variant_name, trip_request)
        current_minutes = self.routing_cfg.day_start_minutes
        hotel_place = hotel_candidate["place"] if hotel_candidate else None
        previous_place = hotel_place if hotel_place is not None and day_index > 1 else None

        if hotel_place is not None and day_index == 1:
            hotel_start = self._time_to_minutes(hotel_place.get("opening_time", ""), 12 * 60)
            current_minutes = max(current_minutes, hotel_start)
            if current_minutes + self.routing_cfg.arrival_block_duration_min <= self.routing_cfg.day_end_minutes:
                used_place_ids.add(hotel_place["place_id"])
                previous_place, current_minutes, stop_order = self._append_stop(
                    day_stops=day_stops,
                    day_index=day_index,
                    stop_order=stop_order,
                    candidate=hotel_candidate,
                    start_date=start_date,
                    start_minutes=current_minutes,
                    duration_min=self.routing_cfg.arrival_block_duration_min,
                    previous_place=None,
                )

        if len(day_stops) < day_limit and day_limit - len(day_stops) >= 2:
            lunch_candidate = self._pick_candidate(
                trip_request=trip_request,
                pool=food_pool,
                used_place_ids=used_place_ids,
                anchor_place=previous_place,
            )
            if lunch_candidate is not None:
                lunch_start = max(current_minutes, 13 * 60)
                if lunch_start + self.routing_cfg.meal_duration_min <= self.routing_cfg.day_end_minutes:
                    used_place_ids.add(lunch_candidate["place"]["place_id"])
                    previous_place, current_minutes, stop_order = self._append_stop(
                        day_stops=day_stops,
                        day_index=day_index,
                        stop_order=stop_order,
                        candidate=lunch_candidate,
                        start_date=start_date,
                        start_minutes=lunch_start,
                        duration_min=self.routing_cfg.meal_duration_min,
                        previous_place=previous_place,
                    )

        remaining_slots = max(day_limit - len(day_stops), 0)
        dinner_candidate = self._pick_candidate(
            trip_request=trip_request,
            pool=food_pool,
            used_place_ids=used_place_ids,
            anchor_place=previous_place,
        )
        reserve_dinner_slot = 1 if dinner_candidate is not None and variant_name != "relaxed" and remaining_slots > 1 else 0
        flex_slots = max(day_limit - len(day_stops) - reserve_dinner_slot, 0)

        can_add_wine = (
            trip_wine_limit > trip_wine_count
            and flex_slots >= 2
            and self.routing_cfg.max_wine_stops_per_day > day_wine_count
        )
        wine_slots = 1 if can_add_wine else 0
        activity_slots = min(activity_limit, max(flex_slots - wine_slots, 0))
        if flex_slots > 0 and activity_slots == 0:
            activity_slots = 1
            wine_slots = 0

        for _ in range(activity_slots):
            if len(day_stops) >= day_limit:
                break
            activity_candidate = self._pick_candidate(
                trip_request=trip_request,
                pool=activity_pool,
                used_place_ids=used_place_ids,
                anchor_place=previous_place or hotel_place,
                used_type_keys=used_activity_types,
            )
            if activity_candidate is None:
                break
            activity_start = current_minutes
            if activity_start + self.routing_cfg.activity_duration_min > self.routing_cfg.day_end_minutes:
                break
            used_place_ids.add(activity_candidate["place"]["place_id"])
            used_activity_types.add(self._place_type_key(activity_candidate["place"]))
            previous_place, current_minutes, stop_order = self._append_stop(
                day_stops=day_stops,
                day_index=day_index,
                stop_order=stop_order,
                candidate=activity_candidate,
                start_date=start_date,
                start_minutes=activity_start,
                duration_min=self.routing_cfg.activity_duration_min,
                previous_place=previous_place,
            )

        if wine_slots > 0 and len(day_stops) < day_limit:
            wine_candidate = self._pick_candidate(
                trip_request=trip_request,
                pool=wine_pool,
                used_place_ids=used_place_ids,
                anchor_place=previous_place or hotel_place,
            )
            if wine_candidate is not None and current_minutes + self.routing_cfg.wine_duration_min <= self.routing_cfg.day_end_minutes:
                used_place_ids.add(wine_candidate["place"]["place_id"])
                used_activity_types.add(self._place_type_key(wine_candidate["place"]))
                previous_place, current_minutes, stop_order = self._append_stop(
                    day_stops=day_stops,
                    day_index=day_index,
                    stop_order=stop_order,
                    candidate=wine_candidate,
                    start_date=start_date,
                    start_minutes=current_minutes,
                    duration_min=self.routing_cfg.wine_duration_min,
                    previous_place=previous_place,
                )
                day_wine_count += 1

        if len(day_stops) < day_limit:
            if dinner_candidate is None:
                dinner_candidate = self._pick_candidate(
                    trip_request=trip_request,
                    pool=food_pool,
                    used_place_ids=used_place_ids,
                    anchor_place=previous_place,
                )
            if dinner_candidate is not None:
                dinner_start = max(current_minutes, 19 * 60)
                if dinner_start + self.routing_cfg.meal_duration_min <= self.routing_cfg.day_end_minutes:
                    used_place_ids.add(dinner_candidate["place"]["place_id"])
                    previous_place, current_minutes, stop_order = self._append_stop(
                        day_stops=day_stops,
                        day_index=day_index,
                        stop_order=stop_order,
                        candidate=dinner_candidate,
                        start_date=start_date,
                        start_minutes=dinner_start,
                        duration_min=self.routing_cfg.meal_duration_min,
                        previous_place=previous_place,
                    )

        return day_stops, day_wine_count

    # Сборка нескольких вариантов маршрута
    def build_route_variants(
        self,
        trip_request: dict[str, Any],
        ranked_groups: dict[str, list[dict[str, Any]]],
    ) -> list[dict[str, Any]]:
        route_variants: list[dict[str, Any]] = []
        stay_candidates = ranked_groups.get("stay", [])
        food_candidates = ranked_groups.get("food", [])
        activity_candidates = ranked_groups.get("activity", [])
        wine_candidates = ranked_groups.get("wine", [])

        start_date = self._get_start_date(trip_request)
        days_count = int(trip_request.get("dates", {}).get("duration_days", 0) or 0)
        if days_count <= 0:
            days_count = self.routing_cfg.default_days_count
        trip_wine_limit = self._get_trip_wine_limit(trip_request, days_count)

        for variant_rank, variant_name in enumerate(self.routing_cfg.route_variants, start=1):
            hotel_candidate = self._select_hotel(stay_candidates, variant_rank - 1)
            used_place_ids: set[str] = set()
            used_activity_types: set[str] = set()
            trip_wine_count = 0
            route_id = f"route_{variant_name}_{uuid4().hex[:8]}"
            route_variant = {
                "route_id": route_id,
                "variant_rank": variant_rank,
                "variant_name": variant_name,
                "summary": "",
                "days": [],
                "stops": [],
            }

            shifted_activity_candidates = activity_candidates[variant_rank - 1 :] + activity_candidates[: variant_rank - 1]
            shifted_wine_candidates = wine_candidates[variant_rank - 1 :] + wine_candidates[: variant_rank - 1]
            shifted_food_candidates = food_candidates[variant_rank - 1 :] + food_candidates[: variant_rank - 1]

            for day_index in range(1, days_count + 1):
                day_stops, day_wine_count = self._build_day_plan(
                    day_index=day_index,
                    trip_request=trip_request,
                    start_date=start_date,
                    variant_name=variant_name,
                    hotel_candidate=hotel_candidate,
                    activity_pool=shifted_activity_candidates,
                    wine_pool=shifted_wine_candidates,
                    food_pool=shifted_food_candidates,
                    used_place_ids=used_place_ids,
                    used_activity_types=used_activity_types,
                    trip_wine_count=trip_wine_count,
                    trip_wine_limit=trip_wine_limit,
                )
                trip_wine_count += day_wine_count
                route_variant["days"].append(
                    {
                        "day": day_index,
                        "stops": day_stops,
                    }
                )
                route_variant["stops"].extend(day_stops)

            route_variant["summary"] = (
                f"{variant_name}: {len(route_variant['stops'])} остановок, "
                f"{days_count} дн., "
                f"без повторов, якорь {hotel_candidate['place']['name'] if hotel_candidate else 'без отеля'}"
            )
            route_variants.append(route_variant)

        return route_variants

from app.planner.route_optimizer import RouteOptimizer

# Запуск
if __name__ == "__main__":
    print(RouteOptimizer().__class__.__name__)
