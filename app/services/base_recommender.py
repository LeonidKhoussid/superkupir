from __future__ import annotations

import math
import sys
from collections import Counter
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import PathConfig, RecommenderConfig
from app.db_connector.models import CsvDataContract
from app.db_connector.repositories import CsvRepository
from app.db_connector.session import CsvSession


class BaseRecommender:
    """РЕКОМЕНДАТЕЛЬНАЯ СИСТЕМА НА ОСНОВЕ CONTENT-BASED SCORING"""

    # Инициализация рекомендательной системы
    def __init__(self) -> None:
        self.cfg = RecommenderConfig()
        self.paths = PathConfig()
        self.paths.ensure_directories()
        self.repository = CsvRepository()
        self.contract = CsvDataContract()
        self.csv_session = CsvSession()

    # Лимиты остановок по дням и темпу из анкеты
    def _trip_stop_budget(self, days_count: int, activity: str) -> tuple[int, int]:
        act_l = str(activity or "").strip().lower()
        if "спокой" in act_l or act_l in {"низкий", "slow", "relaxed"}:
            per_day = 4
            trip_cap = 1 + days_count * 3
        elif "актив" in act_l or act_l in {"интенсив", "intense"}:
            per_day = 7
            trip_cap = 2 + days_count * 5
        else:
            per_day = 5
            trip_cap = 2 + days_count * 4
        per_day = min(per_day, self.cfg.max_stops_per_day)
        trip_cap = min(trip_cap, days_count * per_day + 2)
        trip_cap = max(trip_cap, days_count + 1)
        trip_cap = min(trip_cap, 18)
        return trip_cap, per_day

    # Haversine-расстояние между двумя точками (км)
    @staticmethod
    def _distance_km(a: dict[str, Any], b: dict[str, Any]) -> float:
        if (
            a.get("lat") is None or a.get("lon") is None
            or b.get("lat") is None or b.get("lon") is None
        ):
            return float("inf")
        r = 6371.0
        lat1, lon1 = math.radians(float(a["lat"])), math.radians(float(a["lon"]))
        lat2, lon2 = math.radians(float(b["lat"])), math.radians(float(b["lon"]))
        dlat, dlon = lat2 - lat1, lon2 - lon1
        h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        return r * 2 * math.asin(math.sqrt(h))

    # Наличие координат
    @staticmethod
    def _has_coords(place: dict[str, Any]) -> bool:
        return place.get("lat") is not None and place.get("lon") is not None

    # Парсинг количества дней
    def _parse_days(self, days_raw: str) -> int:
        days_raw = str(days_raw).strip()
        if days_raw in self.cfg.days_mapping:
            return self.cfg.days_mapping[days_raw]
        try:
            return max(1, int(days_raw))
        except (ValueError, TypeError):
            return 2

    # Маппинг бюджета в уровень
    def _budget_to_level(self, budget: int, days_count: int) -> str:
        daily = budget / max(days_count, 1)
        for threshold, level in self.cfg.budget_daily_thresholds:
            if daily < threshold:
                return level
        return self.cfg.budget_default_level

    # Построение тематического профиля пользователя
    def _build_profile(self, request: dict[str, Any]) -> dict[str, float]:
        group = str(request.get("group", "один")).strip()
        activity = str(request.get("activity", "спокойный")).strip()
        season = str(request.get("season", "лето")).strip()

        profile: dict[str, float] = {}
        for source in (
            self.cfg.group_themes.get(group, {}),
            self.cfg.activity_themes.get(activity, {}),
            self.cfg.season_themes.get(season, {}),
        ):
            for theme, weight in source.items():
                profile[theme] = max(profile.get(theme, 0.0), weight)
        return profile

    # Совместимость бюджета (0..1)
    @staticmethod
    def _budget_fit(place: dict[str, Any], budget_level: str) -> float:
        pl = place.get("price_level", "")
        if not pl or not budget_level:
            return 0.7
        hierarchy = {"бесплатно": 0, "низкий": 1, "средний": 2, "высокий": 3}
        p_rank = hierarchy.get(pl, 2)
        u_rank = hierarchy.get(budget_level, 2)
        if p_rank <= u_rank:
            return 1.0
        return max(0.0, 1.0 - (p_rank - u_rank) * 0.35)

    # Тематическое совпадение (0..1)
    @staticmethod
    def _theme_match(place: dict[str, Any], profile: dict[str, float]) -> float:
        if not profile:
            return 0.5
        place_themes = set(place.get("themes", [])) | set(place.get("tags", []))
        matched_weight = sum(profile[t] for t in place_themes if t in profile)
        total_weight = sum(profile.values())
        if total_weight <= 0:
            return 0.5
        return min(matched_weight / total_weight, 1.0)

    # Дистанционный score (0..1, ближе = лучше)
    def _distance_score(self, place: dict[str, Any], anchor: dict[str, Any]) -> float:
        dist = self._distance_km(anchor, place)
        if dist == float("inf"):
            return 0.0
        return max(0.0, 1.0 - dist / self.cfg.nearby_radius_km)

    # Нормализованный рейтинг (0..1), неизвестный рейтинг = 0.5
    @staticmethod
    def _rating_norm(place: dict[str, Any]) -> float:
        rating = float(place.get("rating", 0) or 0)
        if rating <= 0:
            return 0.5
        return min(rating / 5.0, 1.0)

    # Diversity-бонус (штраф за повторение типа в дне)
    @staticmethod
    def _diversity_score(place: dict[str, Any], used_types: Counter) -> float:
        ptype = place.get("place_type", "")
        count = used_types.get(ptype, 0)
        if count == 0:
            return 1.0
        if count == 1:
            return 0.35
        return 0.1

    # Composite score одного места
    def _score_place(
        self,
        place: dict[str, Any],
        profile: dict[str, float],
        anchor: dict[str, Any],
        used_types: Counter,
        budget_level: str,
        wine_boost: bool = False,
        last_area: str = "",
        prev_day_types: set[str] | None = None,
    ) -> float:
        prev_day_types = prev_day_types or set()
        ptype = place.get("place_type", "")
        area = str(place.get("area", "") or "")
        cross_penalty = 0.12 if ptype and ptype in prev_day_types else 0.0
        area_penalty = 0.1 if last_area and area and area == last_area else 0.0
        score = (
            self.cfg.w_theme * self._theme_match(place, profile)
            + self.cfg.w_dist * self._distance_score(place, anchor)
            + self.cfg.w_rate * self._rating_norm(place)
            + self.cfg.w_div * self._diversity_score(place, used_types)
            + self.cfg.w_budget * self._budget_fit(place, budget_level)
            - cross_penalty
            - area_penalty
        )
        if wine_boost and place.get("place_type") == "винодельня":
            score += 0.15
        return score

    # Жесткие group-фильтры (только семья)
    def _passes_hard_filters(self, place: dict[str, Any], group: str) -> bool:
        filters = self.cfg.group_hard_filters.get(group, {})
        for key, required in filters.items():
            if required and not place.get(key):
                return False
        return True

    # Проверка сезонности
    def _matches_season(self, place: dict[str, Any], season: str) -> bool:
        seasonality = place.get("seasonality", "")
        if not seasonality:
            return True
        allowed = self.cfg.season_to_seasonality.get(season, {"круглый_год"})
        return seasonality in allowed

    # Определение: нужны ли винодельни этому пользователю
    @staticmethod
    def _wants_wine(profile: dict[str, float], budget_level: str) -> bool:
        wine_themes = {"романтика", "гастрономия", "виды"}
        wine_signal = sum(profile.get(t, 0) for t in wine_themes)
        if budget_level == "низкий":
            return False
        return wine_signal >= 0.8

    # Выбор отеля по composite score
    def _pick_hotel(
        self,
        hotels: list[dict[str, Any]],
        profile: dict[str, float],
        budget_level: str,
        daily_budget: float,
        group: str,
    ) -> dict[str, Any] | None:
        max_price = daily_budget * self.cfg.hotel_budget_share
        candidates: list[tuple[float, dict[str, Any]]] = []
        for h in hotels:
            if not self._has_coords(h):
                continue
            if not self._passes_hard_filters(h, group):
                continue
            price = h.get("price_rub", 0) or 0
            price_ok = price <= 0 or price <= max_price
            theme_sc = self._theme_match(h, profile)
            rating_sc = self._rating_norm(h)
            budget_sc = 1.0 if price_ok else max(0.0, 1.0 - (price - max_price) / max_price)
            score = 0.35 * theme_sc + 0.30 * rating_sc + 0.35 * budget_sc
            candidates.append((score, h))
        if not candidates:
            valid = [h for h in hotels if self._has_coords(h)]
            if valid:
                return max(valid, key=lambda h: float(h.get("rating", 0) or 0))
            return None
        candidates.sort(key=lambda x: x[0], reverse=True)
        return candidates[0][1]

    # Подбор лучшего места для слота
    def _fill_slot(
        self,
        slot: dict[str, Any],
        candidates: list[dict[str, Any]],
        profile: dict[str, float],
        anchor: dict[str, Any],
        used_ids: set[str],
        used_types: Counter,
        budget_level: str,
        group: str,
        season: str,
        include_wine: bool,
        wine_already_placed: bool,
        last_area: str,
        prev_day_types: set[str],
    ) -> dict[str, Any] | None:
        allowed_sources = slot.get("allowed_sources", set())
        allowed_types = slot.get("allowed_types", set())
        slot_name = slot.get("name", "")
        is_closing = slot_name == "closing"

        scored: list[tuple[float, dict[str, Any]]] = []
        for place in candidates:
            pid = place.get("place_id", "")
            if pid in used_ids:
                continue
            if place.get("source_table", "") not in allowed_sources:
                continue

            ptype = place.get("place_type", "")
            if ptype and allowed_types and ptype not in allowed_types:
                continue

            if ptype == "винодельня":
                if not include_wine or wine_already_placed:
                    continue

            if not self._passes_hard_filters(place, group):
                continue
            if not self._matches_season(place, season):
                continue

            if used_types.get(ptype, 0) >= self.cfg.max_same_type_per_day:
                continue

            wine_boost = include_wine and is_closing and not wine_already_placed
            score = self._score_place(
                place,
                profile,
                anchor,
                used_types,
                budget_level,
                wine_boost=wine_boost,
                last_area=last_area,
                prev_day_types=prev_day_types,
            )
            scored.append((score, place))

        if not scored:
            return None
        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]

    # Кандидаты в радиусе от отеля и/или второго якоря (день 2)
    def _gather_candidates(
        self,
        hotel: dict[str, Any],
        secondary: dict[str, Any] | None,
        all_places: list[dict[str, Any]],
        used_ids: set[str],
    ) -> list[dict[str, Any]]:
        r = self.cfg.nearby_radius_km
        out: list[dict[str, Any]] = []
        for p in all_places:
            if not self._has_coords(p):
                continue
            if p.get("place_id", "") in used_ids:
                continue
            d_h = self._distance_km(hotel, p)
            if secondary and secondary.get("lat") is not None:
                d_s = self._distance_km(secondary, p)
                if min(d_h, d_s) > r:
                    continue
            elif d_h > r:
                continue
            out.append(p)
        return out

    # Гео-центроид по строкам предыдущего дня (без отеля)
    @staticmethod
    def _day_secondary_anchor(
        hotel: dict[str, Any],
        prev_rows: list[dict[str, Any]],
    ) -> dict[str, Any]:
        lats: list[float] = []
        lons: list[float] = []
        for row in prev_rows:
            if row.get("stop_type") == "hotel":
                continue
            lat, lon = row.get("lat"), row.get("lon")
            if lat is None or lon is None:
                continue
            lats.append(float(lat))
            lons.append(float(lon))
        if not lats:
            return hotel
        return {
            "lat": sum(lats) / len(lats),
            "lon": sum(lons) / len(lons),
            "place_id": "_centroid",
            "name": "",
        }

    # Сборка одного дня
    def _build_day(
        self,
        day_idx: int,
        hotel: dict[str, Any],
        all_places: list[dict[str, Any]],
        profile: dict[str, float],
        budget_level: str,
        group: str,
        season: str,
        include_wine: bool,
        used_ids: set[str],
        user_id: str,
        prev_day_types: set[str],
        prev_day_rows: list[dict[str, Any]],
        wine_state: list[bool],
        max_stops_today: int,
    ) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        used_types: Counter = Counter()
        stop_order = 1
        last_area = ""

        if day_idx == 1:
            rows.append(self._make_row(user_id, day_idx, stop_order, "hotel", hotel, hotel))
            stop_order += 1

        secondary: dict[str, Any] | None = None
        if day_idx > 1:
            secondary = self._day_secondary_anchor(hotel, prev_day_rows)

        nearby = self._gather_candidates(hotel, secondary, all_places, used_ids)

        slots = self.cfg.day1_slots if day_idx == 1 else self.cfg.day2_slots
        chain_anchor = hotel
        wine_placed = wine_state[0]

        for slot in slots:
            if len(rows) >= max_stops_today:
                break

            slot_local = slot
            if slot.get("optional") and slot.get("name") == "closing" and not include_wine:
                types_f = set(slot["allowed_types"]) - {"винодельня"}
                if not types_f:
                    continue
                slot_local = {**slot, "allowed_types": types_f}

            best = self._fill_slot(
                slot=slot_local,
                candidates=nearby,
                profile=profile,
                anchor=chain_anchor,
                used_ids=used_ids,
                used_types=used_types,
                budget_level=budget_level,
                group=group,
                season=season,
                include_wine=include_wine,
                wine_already_placed=wine_placed,
                last_area=last_area,
                prev_day_types=prev_day_types,
            )
            if best is None:
                if slot.get("optional"):
                    continue
                best = self._fill_slot(
                    slot={**slot_local, "allowed_types": set()},
                    candidates=nearby,
                    profile=profile,
                    anchor=chain_anchor,
                    used_ids=used_ids,
                    used_types=used_types,
                    budget_level=budget_level,
                    group=group,
                    season=season,
                    include_wine=include_wine,
                    wine_already_placed=wine_placed,
                    last_area=last_area,
                    prev_day_types=prev_day_types,
                )
                if best is None:
                    continue

            used_ids.add(best["place_id"])
            used_types[best.get("place_type", "")] += 1
            last_area = str(best.get("area", "") or "")
            if best.get("place_type") == "винодельня":
                wine_placed = True
                wine_state[0] = True

            rows.append(self._make_row(
                user_id, day_idx, stop_order, slot_local["stop_type"], best, hotel,
            ))
            stop_order += 1
            if self._has_coords(best):
                chain_anchor = best

        return rows

    # Формирование строки результата
    def _make_row(
        self,
        user_id: str,
        day: int,
        stop_order: int,
        stop_type: str,
        place: dict[str, Any],
        hotel: dict[str, Any],
    ) -> dict[str, Any]:
        dist = self._distance_km(hotel, place) if stop_type != "hotel" else 0.0
        if dist == float("inf"):
            dist = 0.0
        flat = self.contract.flatten_place_source_fields(place)
        row: dict[str, Any] = {
            "user_id": user_id,
            "route_variant": 1,
            "day": day,
            "stop_order": stop_order,
            "stop_type": stop_type,
            "place_id": place.get("place_id", ""),
            "source_table": place.get("source_table", ""),
            "category": place.get("category", ""),
            "place_type": place.get("place_type", ""),
            "name": place.get("name", ""),
            "lat": place.get("lat"),
            "lon": place.get("lon"),
            "address": place.get("address", ""),
            "area": place.get("area", ""),
            "distance_from_hotel_km": round(dist, 3),
            "rating": place.get("rating", 0.0),
            "description": place.get("description", ""),
        }
        row.update(flat)
        return row

    # Рекомендация маршрута для одного пользователя
    def recommend(self, request: dict[str, Any]) -> list[dict[str, Any]]:
        user_id = str(request.get("id", ""))
        season = str(request.get("season", "лето")).strip()
        days_count = self._parse_days(request.get("days", ""))
        group = str(request.get("group", "один")).strip()
        activity = str(request.get("activity", "спокойный")).strip()
        budget = int(float(request.get("budget", 0) or 0))

        budget_level = self._budget_to_level(budget, days_count)
        daily_budget = budget / max(days_count, 1)

        profile = self._build_profile(request)
        include_wine = self._wants_wine(profile, budget_level)

        all_hotels = self.repository.read_hotel_places()
        all_food = self.repository.read_food_places()
        all_locations = self.repository.read_location_places()
        all_wines = self.repository.read_wine_places()

        all_places: list[dict[str, Any]] = []
        all_places.extend(all_food)
        all_places.extend(all_locations)
        all_places.extend(all_wines)

        hotel = self._pick_hotel(all_hotels, profile, budget_level, daily_budget, group)
        if hotel is None:
            print(f"[recommender] Нет подходящих отелей для user={user_id}")
            return []

        used_ids: set[str] = {hotel["place_id"]}
        all_rows: list[dict[str, Any]] = []
        wine_state = [False]
        prev_day_rows: list[dict[str, Any]] = []
        prev_day_types: set[str] = set()
        max_stops_trip, max_stops_day = self._trip_stop_budget(days_count, activity)

        for day in range(1, days_count + 1):
            trip_left = max_stops_trip - len(all_rows)
            if trip_left <= 0:
                break
            max_today = min(max_stops_day, trip_left)

            day_rows = self._build_day(
                day_idx=day,
                hotel=hotel,
                all_places=all_places,
                profile=profile,
                budget_level=budget_level,
                group=group,
                season=season,
                include_wine=include_wine,
                used_ids=used_ids,
                user_id=user_id,
                prev_day_types=prev_day_types,
                prev_day_rows=prev_day_rows,
                wine_state=wine_state,
                max_stops_today=max_today,
            )
            all_rows.extend(day_rows)
            prev_day_rows = day_rows
            prev_day_types = {
                str(r.get("place_type", ""))
                for r in day_rows
                if r.get("stop_type") != "hotel" and r.get("place_type")
            }

        return all_rows

    # Чтение входного CSV и рекомендация для всех пользователей
    def recommend_all(self) -> list[dict[str, Any]]:
        rows = self.csv_session.read_rows(self.paths.user_base_csv_path)
        if not rows:
            print("[recommender] user_base.csv пуст или не найден")
            return []

        all_results: list[dict[str, Any]] = []
        for request in rows:
            user_routes = self.recommend(request)
            all_results.extend(user_routes)
            uid = request.get("id", "?")
            print(f"[recommender] user={uid}: {len(user_routes)} остановок")

        return all_results

    # Сохранение результатов
    def save_results(self, results: list[dict[str, Any]]) -> Path:
        output_path = self.paths.base_route_csv_path
        self.csv_session.write_rows(
            output_path,
            self.contract.base_route_columns,
            results,
        )
        print(f"[recommender] Сохранено {len(results)} строк в {output_path}")
        return output_path

    # Полный цикл
    def run(self) -> Path:
        results = self.recommend_all()
        return self.save_results(results)


from app.services.base_recommender import BaseRecommender

# Запуск
if __name__ == "__main__":
    recommender = BaseRecommender()
    output = recommender.run()
    print(f"Результат: {output}")
