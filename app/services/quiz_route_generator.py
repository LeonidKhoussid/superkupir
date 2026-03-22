"""Генерация минимального маршрута по ответам квиза и датасету мест."""

from __future__ import annotations

import math
import re
from typing import Iterable

from app.schemas.quiz_route import (
    PlaceDatasetItem,
    QuizAnswerItem,
    QuizRouteGenerateRequest,
    QuizRouteResponse,
    RoutePlaceStop,
    SeasonMappingEntry,
)

_RAD = math.pi / 180.0
_EARTH_KM = 6371.0

# TODO(quiz-route): временные константы-заглушки для контракта бэкенда. Заменить на реальную
# оценку стоимости и длительности маршрута, когда появятся надёжные источники данных.
PLACEHOLDER_TOTAL_ESTIMATED_COST: float = 12000.0
PLACEHOLDER_TOTAL_DURATION_MINUTES: int = 480


def _norm(s: str) -> str:
    t = s.strip().upper().replace("Ё", "Е")
    return re.sub(r"\s+", " ", t)


def _haversine_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    dlat = (lat2 - lat1) * _RAD
    dlon = (lon2 - lon1) * _RAD
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1 * _RAD) * math.cos(lat2 * _RAD) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.asin(min(1.0, math.sqrt(a)))
    return _EARTH_KM * c


def _answer_map(answers: Iterable[QuizAnswerItem]) -> dict[int, str]:
    out: dict[int, str] = {}
    for a in answers:
        out[a.step_id] = a.option
    return out


def _resolve_season_id(
    season_option: str | None,
    mapping: list[SeasonMappingEntry],
) -> int:
    if not mapping:
        raise ValueError("season_mapping пуст")
    if season_option is None:
        return mapping[0].id
    opt = _norm(season_option)
    for entry in mapping:
        if entry.label and _norm(entry.label) == opt:
            return entry.id
    for entry in mapping:
        if entry.label and _norm(entry.label) in opt:
            return entry.id
    for entry in mapping:
        if entry.label and opt in _norm(entry.label):
            return entry.id
    m = re.search(r"-?\d+", season_option)
    if m:
        guess = int(m.group(0))
        ids = {e.id for e in mapping}
        if guess in ids:
            return guess
    return mapping[0].id


def _infer_route_stop_count(answers: dict[int, str]) -> int:
    blob = " ".join(_norm(a) for a in answers.values())
    if re.search(r"МЕСЯЦ", blob):
        return 10
    if re.search(r"НЕДЕЛ", blob):
        return 8
    if re.search(r"4[-\s]?5\s*ДН", blob) or re.search(r"4\s*5\s*ДН", blob):
        return 6
    if re.search(r"2[-\s]?3\s*ДН", blob) or re.search(r"2\s*3\s*ДН", blob):
        return 4
    return 4


def _budget_tier(step4: str | None) -> str:
    if not step4:
        return "mid"
    s = _norm(step4)
    if any(x in s for x in ("ЭКОНОМ", "НИЗК", "ДЕШЕВ", "БЮДЖЕТ")):
        return "low"
    if any(x in s for x in ("ПРЕМИУМ", "ВЫСОК", "БЕЗЛИМИТ", "РОСКОШ")):
        return "high"
    return "mid"


def _tourism_profile(step2: str | None) -> str:
    if not step2:
        return "mixed"
    s = _norm(step2)
    if "ВИНН" in s:
        return "wine"
    if "ГАСТР" in s or "ЕДА" in s:
        return "gastro"
    if "ЭКО" in s or "ПРИРОД" in s:
        return "eco"
    if "АГРО" in s:
        return "agro"
    return "mixed"


def _companion_profile(step1: str | None) -> str:
    if not step1:
        return "pair"
    s = _norm(step1)
    if "СЕМЬ" in s or "ДЕТ" in s:
        return "family"
    if "КАМПАН" in s or "9+" in s or "ДРУЗ" in s:
        return "group"
    if "ОДИН" in s:
        return "solo"
    return "pair"


def _place_text(p: PlaceDatasetItem) -> str:
    parts = [p.category or "", p.description or "", p.city_hint or ""]
    return _norm(" ".join(parts))


def _default_stay_minutes(category: str | None) -> int:
    if not category:
        return 75
    c = _norm(category)
    if any(k in c for k in ("РЕСТОРАН", "КАФЕ", "БАР", "ГАСТР", "FOOD")):
        return 90
    if any(k in c for k in ("ВИН", "WINERY", "ДЕГУСТ", "ШАХТ")):
        return 120
    if any(k in c for k in ("ОТЕЛЬ", "HOTEL", "ГОСТИН")):
        return 60
    if any(k in c for k in ("МУЗЕЙ", "ПАРК", "СМОТР", "ХРАМ", "ПЛЯЖ")):
        return 75
    return 75


def _score_place(
    p: PlaceDatasetItem,
    profile: str,
    season_id: int,
    budget: str,
    companion: str,
    city_needle: str | None,
) -> float:
    text = _place_text(p)
    score = 0.0

    if profile == "wine":
        for kw in (
            "ВИН",
            "WINERY",
            "ДЕГУСТ",
            "ШАХТ",
            "ВИНОДЕЛ",
            "АБРАУ",
        ):
            if kw in text:
                score += 2.4
    elif profile == "gastro":
        for kw in ("РЕСТОРАН", "КАФЕ", "КУХН", "ГАСТР", "БИСТРО", "БАР"):
            if kw in text:
                score += 2.2
    elif profile == "eco":
        for kw in (
            "ПАРК",
            "ЗАПОВЕД",
            "ТРОПА",
            "ВОДОПАД",
            "ЛЕС",
            "МОРЕ",
            "ПЛЯЖ",
            "ЭКО",
        ):
            if kw in text:
                score += 2.0
    elif profile == "agro":
        for kw in ("ФЕРМ", "АГРО", "ХОЗЯЙСТ", "САД", "ФЕРМЕР"):
            if kw in text:
                score += 2.3
    else:
        score += 0.8

    if p.season_ids is not None and season_id not in p.season_ids:
        score -= 4.0

    cost = p.cost_hint
    if cost is not None and budget == "low" and cost > 3500:
        score -= 1.5
    if cost is not None and budget == "high" and cost < 500:
        score -= 0.3

    if companion == "family" and p.family_friendly is False:
        score -= 2.0
    if companion == "family" and p.family_friendly is True:
        score += 1.0

    if city_needle:
        cn = _norm(city_needle)
        ch = _norm(p.city_hint or "")
        if cn and (cn in ch or ch in cn or cn in text):
            score += 1.8

    if p.lat is not None and p.lon is not None:
        score += 0.35

    return score


def _order_greedy_geo(places: list[PlaceDatasetItem]) -> list[PlaceDatasetItem]:
    if len(places) <= 1:
        return places
    with_geo = [p for p in places if p.lat is not None and p.lon is not None]
    without = [p for p in places if p.lat is None or p.lon is None]
    if len(with_geo) <= 1:
        return places
    rest = with_geo[1:]
    ordered = [with_geo[0]]
    while rest:
        last = ordered[-1]
        assert last.lat is not None and last.lon is not None
        best_i = min(
            range(len(rest)),
            key=lambda i: _haversine_km(last.lat, last.lon, rest[i].lat, rest[i].lon),  # type: ignore[arg-type]
        )
        ordered.append(rest.pop(best_i))
    return ordered + without


def _title_description(
    profile: str,
    companion: str,
    n_stops: int,
) -> tuple[str, str]:
    comp_ru = {
        "solo": "спокойный маршрут в одиночку",
        "pair": "романтичный маршрут на двоих",
        "family": "семейный маршрут с комфортным темпом",
        "group": "маршрут для компании с удобной логистикой",
    }.get(companion, "сбалансированный маршрут")

    theme = {
        "wine": "винный акцент и дегустационные остановки",
        "gastro": "гастрономические точки и вкусные паузы",
        "eco": "природа и неспешные прогулки",
        "agro": "агротуризм и локальные продукты",
        "mixed": "сочетание активностей края",
    }.get(profile, "разнообразные остановки")

    title = f"Маршрут по Краснодарскому краю: {n_stops} точек"
    desc = (
        f"{comp_ru.capitalize()} с {theme}. "
        f"Последовательность подобрана с учётом сезона и логики перемещений; "
        f"оценки времени и бюджета ориентировочные."
    )
    return title, desc


def validate_route_response(
    payload: QuizRouteResponse,
    valid_place_ids: set[int],
    valid_season_ids: set[int],
) -> None:
    if payload.season_id not in valid_season_ids:
        raise ValueError("season_id вне допустимого season_mapping")
    if not payload.places:
        raise ValueError("places не должен быть пустым")
    seen_p: set[int] = set()
    for item in payload.places:
        if item.place_id not in valid_place_ids:
            raise ValueError(f"неизвестный place_id={item.place_id}")
        if item.place_id in seen_p:
            raise ValueError("дубликат place_id")
        seen_p.add(item.place_id)
    orders = [p.sort_order for p in payload.places]
    expected = list(range(1, len(payload.places) + 1))
    if sorted(orders) != expected:
        raise ValueError("sort_order должен быть уникальным и последовательным 1..n")


def _dedupe_places(places: list[PlaceDatasetItem]) -> list[PlaceDatasetItem]:
    seen: set[int] = set()
    out: list[PlaceDatasetItem] = []
    for p in places:
        if p.place_id in seen:
            continue
        seen.add(p.place_id)
        out.append(p)
    return out


def generate_quiz_route(req: QuizRouteGenerateRequest) -> QuizRouteResponse:
    am = _answer_map(req.answers)
    places = _dedupe_places(list(req.places))
    valid_place_ids = {p.place_id for p in places}
    valid_season_ids = {s.id for s in req.season_mapping}
    if not valid_place_ids:
        raise ValueError("нет мест в датасете")

    season_id = _resolve_season_id(am.get(3), req.season_mapping)
    if season_id not in valid_season_ids:
        season_id = next(iter(sorted(valid_season_ids)))

    profile = _tourism_profile(am.get(2))
    companion = _companion_profile(am.get(1))
    budget = _budget_tier(am.get(4))
    city_needle = am.get(5)

    k = max(1, min(_infer_route_stop_count(am), len(places)))

    scored = [
        (
            _score_place(
                p,
                profile,
                season_id,
                budget,
                companion,
                city_needle,
            ),
            p,
        )
        for p in places
    ]
    scored.sort(key=lambda x: x[0], reverse=True)
    picked = [p for _, p in scored[:k]]
    ordered = _order_greedy_geo(picked)

    stops: list[RoutePlaceStop] = []

    for i, p in enumerate(ordered, start=1):
        stay = p.duration_hint_minutes
        if stay is None or stay < 1:
            stay = _default_stay_minutes(p.category)
        stay = max(30, min(stay, 360))
        stops.append(
            RoutePlaceStop(
                place_id=p.place_id,
                sort_order=i,
                stay_duration_minutes=stay,
            )
        )

    title, description = _title_description(profile, companion, len(stops))

    payload = QuizRouteResponse(
        title=title,
        description=description,
        season_id=season_id,
        total_estimated_cost=PLACEHOLDER_TOTAL_ESTIMATED_COST,
        total_estimated_duration_minutes=PLACEHOLDER_TOTAL_DURATION_MINUTES,
        places=stops,
    )
    validate_route_response(payload, valid_place_ids, valid_season_ids)
    return payload
