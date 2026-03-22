from __future__ import annotations

from app.quiz_route.engine import QuizRouteEngine, QuizRouteInput
from app.quiz_route.place_candidate import PlaceCandidate


# Бюджетный фильтр не выкидывает все точки при мягком cap
def test_filter_by_budget_keeps_null_cost() -> None:
    places = [
        PlaceCandidate(1, "winery", 45.0, 37.0, None, "a", "w"),
        PlaceCandidate(2, "hotel", 45.1, 37.1, 500000.0, "a", "h"),
    ]
    inp = QuizRouteInput(
        people_count=2,
        budget_from=1000,
        budget_to=20000,
        excursion_type="умеренный",
        days_count=2,
    )
    out = QuizRouteEngine.filter_by_budget(places, inp)
    assert any(p.place_id == 1 for p in out)


# Greedy порядок: уникальные id и длина не больше target
def test_order_respects_target_cap() -> None:
    inp = QuizRouteInput(
        people_count=2,
        budget_from=1000,
        budget_to=50000,
        excursion_type="умеренный",
        days_count=3,
    )
    target = QuizRouteEngine.target_stop_count(3)
    pool = [
        PlaceCandidate(i, "park" if i % 2 else "museum", 45.0 + i * 0.01, 37.0 + i * 0.01, 100.0, None, f"p{i}")
        for i in range(1, 25)
    ]
    ids = QuizRouteEngine.order_place_ids(pool, inp)
    assert len(ids) == target
    assert len(set(ids)) == len(ids)
