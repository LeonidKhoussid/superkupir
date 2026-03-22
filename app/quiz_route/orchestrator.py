from __future__ import annotations

from typing import TYPE_CHECKING

from app.quiz_route.engine import QuizRouteEngine, QuizRouteInput
from app.quiz_route.errors import UnsatisfiableQuizRouteError
from app.quiz_route.place_candidate import PlaceCandidate
from app.quiz_route.repository import QuizRouteRepository

if TYPE_CHECKING:
    from psycopg import Connection


class QuizRouteOrchestrator:
    """СБОРКА SQL → ФИЛЬТР → ПОРЯДОК ОСТАНОВОК"""

    # Инициализация репозитория
    def __init__(self, repository: QuizRouteRepository | None = None) -> None:
        self.repository = repository or QuizRouteRepository()

    # Полный цикл: сезон в БД, бюджет, эвристика маршрута
    def build_route(
        self,
        conn: Connection,
        season_slug: str,
        inp: QuizRouteInput,
    ) -> tuple[list[int], str]:
        raw_places = self.repository.load_by_season(conn, season_slug)
        if not raw_places:
            raise UnsatisfiableQuizRouteError(
                "В каталоге нет активных мест для выбранного сезона.",
            )

        filtered = QuizRouteEngine.filter_by_budget(raw_places, inp)
        if len(filtered) < 4:
            raise UnsatisfiableQuizRouteError(
                "После фильтра по бюджету осталось меньше четырёх мест — ослабьте бюджет или смените сезон.",
            )

        ordered_ids = QuizRouteEngine.order_place_ids(filtered, inp)
        ordered_ids = self._ensure_min_stops(ordered_ids, filtered, inp)

        if len(ordered_ids) < 4:
            raise UnsatisfiableQuizRouteError(
                "Не удалось собрать маршрут из минимум четырёх уникальных точек.",
            )

        rationale = (
            f"сезон={season_slug}, стиль={inp.excursion_type}, "
            f"бюджет_на_чел≈{QuizRouteEngine.per_person_cap(inp.budget_to, inp.people_count):.0f}, "
            f"дней={inp.days_count}, остановок={len(ordered_ids)}"
        )
        return ordered_ids, rationale

    # Добор точек до минимума 4
    @staticmethod
    def _ensure_min_stops(
        ordered_ids: list[int],
        filtered: list[PlaceCandidate],
        inp: QuizRouteInput,
    ) -> list[int]:
        seen = set(ordered_ids)
        out = list(ordered_ids)
        if len(out) >= 4:
            return out
        rest = sorted(
            [p for p in filtered if p.place_id not in seen],
            key=lambda p: QuizRouteEngine.score(p, inp),
            reverse=True,
        )
        for p in rest:
            out.append(p.place_id)
            seen.add(p.place_id)
            if len(out) >= 4:
                break
        return out
