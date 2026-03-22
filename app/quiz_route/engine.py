from __future__ import annotations

import math
from dataclasses import dataclass

from app.quiz_route.place_candidate import PlaceCandidate


@dataclass(frozen=True)
class QuizRouteInput:
    """НОРМАЛИЗОВАННЫЙ ВВОД КВИЗА ДЛЯ ДВИЖКА"""

    people_count: int
    budget_from: float
    budget_to: float
    excursion_type: str
    days_count: int


class QuizRouteEngine:
    """ФИЛЬТР ПО БЮДЖЕТУ, СКОРИНГ И GREEDY NN"""

    LODGING = frozenset({"hotel", "guest_house", "recreation_base"})
    FOOD = frozenset({"restaurant", "gastro"})

    # Целевое число остановок 4–15 от days_count
    @staticmethod
    def target_stop_count(days_count: int) -> int:
        raw = days_count + 2
        return max(4, min(15, raw))

    # Бюджет на человека (верхняя граница поездки)
    @staticmethod
    def per_person_cap(budget_to: float, people_count: int) -> float:
        return float(budget_to) / max(people_count, 1)

    # Отбор по estimated_cost согласованный с per_person_cap
    @classmethod
    def filter_by_budget(cls, places: list[PlaceCandidate], inp: QuizRouteInput) -> list[PlaceCandidate]:
        cap = cls.per_person_cap(inp.budget_to, inp.people_count)
        total = float(inp.budget_to)
        out: list[PlaceCandidate] = []
        for p in places:
            if p.estimated_cost is None:
                out.append(p)
                continue
            c = float(p.estimated_cost)
            if p.type_slug in cls.LODGING:
                if c <= max(cap * 3.5, total * 0.5):
                    out.append(p)
                continue
            if p.type_slug in cls.FOOD:
                if c <= max(cap * 2.8, total * 0.12):
                    out.append(p)
                continue
            if c <= cap * 2.2:
                out.append(p)
        return out

    # Вес типа от стиля экскурсии
    @classmethod
    def _type_weight(cls, excursion: str, slug: str) -> float:
        active = {
            "park": 1.45,
            "museum": 1.28,
            "farm": 1.22,
            "winery": 0.92,
            "hotel": 0.95,
            "guest_house": 0.9,
            "recreation_base": 1.05,
            "restaurant": 1.12,
            "gastro": 1.18,
        }
        calm = {
            "winery": 1.32,
            "hotel": 1.18,
            "guest_house": 1.12,
            "museum": 1.22,
            "park": 0.88,
            "farm": 0.95,
            "restaurant": 1.08,
            "gastro": 1.05,
            "recreation_base": 1.0,
        }
        moderate = {k: 1.0 for k in set(active) | set(calm)}
        tables = {
            "активный": active,
            "умеренный": moderate,
            "спокойный": calm,
        }
        table = tables.get(excursion, moderate)
        return float(table.get(slug, 1.0))

    # Скоринг кандидата
    @classmethod
    def score(cls, p: PlaceCandidate, inp: QuizRouteInput) -> float:
        w = cls._type_weight(inp.excursion_type, p.type_slug)
        if p.latitude is not None and p.longitude is not None:
            w *= 1.05
        if p.radius_group:
            w *= 1.02
        return w

    # Расстояние по сфере (км)
    @staticmethod
    def haversine_km(
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float,
    ) -> float:
        rlat1 = math.radians(lat1)
        rlat2 = math.radians(lat2)
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        h = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
        c = 2 * math.asin(min(1.0, math.sqrt(h)))
        return 6371.0 * c

    # Порядок посещений: старт из лодгинга или лучшего скора, затем NN + разнообразие типов
    @classmethod
    def order_place_ids(cls, places: list[PlaceCandidate], inp: QuizRouteInput) -> list[int]:
        target = cls.target_stop_count(inp.days_count)
        if len(places) <= target:
            pool = list(places)
        else:
            scored = sorted(
                places,
                key=lambda x: cls.score(x, inp),
                reverse=True,
            )
            pool = scored[: max(target * 4, 40)]

        keyed = [(cls.score(p, inp), p) for p in pool]
        keyed.sort(key=lambda t: t[0], reverse=True)

        with_coords = [p for _, p in keyed if p.latitude is not None and p.longitude is not None]
        no_coords = [p for _, p in keyed if p.latitude is None or p.longitude is None]

        if not with_coords and not no_coords:
            return []

        ordered: list[PlaceCandidate] = []
        remaining = list(with_coords)
        if not remaining:
            return [p.place_id for p in no_coords[:target]]

        lodging_first = [p for p in remaining if p.type_slug in cls.LODGING]
        if lodging_first:
            start = max(lodging_first, key=lambda p: cls.score(p, inp))
        else:
            start = max(remaining, key=lambda p: cls.score(p, inp))

        ordered.append(start)
        remaining.remove(start)
        last_types: list[str] = [start.type_slug]

        while len(ordered) < target and remaining:
            last = ordered[-1]
            assert last.latitude is not None and last.longitude is not None
            best_i = -1
            best_cost = float("inf")
            for i, cand in enumerate(remaining):
                assert cand.latitude is not None and cand.longitude is not None
                dist = cls.haversine_km(last.latitude, last.longitude, cand.latitude, cand.longitude)
                diversity = 0.15 if cand.type_slug in last_types[-2:] else 0.0
                adjusted = dist * (1.0 + diversity) - 0.08 * cls.score(cand, inp)
                if adjusted < best_cost:
                    best_cost = adjusted
                    best_i = i
            if best_i < 0:
                break
            nxt = remaining.pop(best_i)
            ordered.append(nxt)
            last_types.append(nxt.type_slug)
            if len(last_types) > 3:
                last_types.pop(0)

        for p in sorted(no_coords, key=lambda x: cls.score(x, inp), reverse=True):
            if len(ordered) >= target:
                break
            if p.place_id not in {x.place_id for x in ordered}:
                ordered.append(p)

        cls._inject_missing_categories(ordered, pool, inp, target)
        ordered = ordered[:target]
        seen: set[int] = set()
        unique: list[int] = []
        for p in ordered:
            if p.place_id not in seen:
                seen.add(p.place_id)
                unique.append(p.place_id)
        return unique

    # Подмешивание отеля и еды при наличии в пуле
    @classmethod
    def _inject_missing_categories(
        cls,
        ordered: list[PlaceCandidate],
        pool: list[PlaceCandidate],
        inp: QuizRouteInput,
        target: int,
    ) -> None:
        ids = {p.place_id for p in ordered}
        lodging_pool = [p for p in pool if p.type_slug in cls.LODGING and p.place_id not in ids]
        food_pool = [p for p in pool if p.type_slug in cls.FOOD and p.place_id not in ids]

        if lodging_pool and not any(p.type_slug in cls.LODGING for p in ordered):
            best = max(lodging_pool, key=lambda p: cls.score(p, inp))
            if len(ordered) >= target:
                ordered.pop()
            ordered.insert(0, best)
            ids.add(best.place_id)

        if food_pool and not any(p.type_slug in cls.FOOD for p in ordered):
            best = max(food_pool, key=lambda p: cls.score(p, inp))
            if len(ordered) >= target:
                ordered.pop()
            insert_at = min(2, len(ordered))
            ordered.insert(insert_at, best)
