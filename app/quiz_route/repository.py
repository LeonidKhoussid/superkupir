from __future__ import annotations

from typing import TYPE_CHECKING

from app.quiz_route.coordinates import CoordinateParser
from app.quiz_route.place_candidate import PlaceCandidate

if TYPE_CHECKING:
    from psycopg import Connection


class QuizRouteRepository:
    """ВЫБОРКА КАНДИДАТОВ ИЗ POSTGRES ПО СЕЗОНУ"""

    # Загрузка активных мест с привязкой к сезону
    def load_by_season(self, conn: Connection, season_slug: str) -> list[PlaceCandidate]:
        sql = """
            SELECT
                p.id,
                pt.slug AS type_slug,
                p.latitude,
                p.longitude,
                p.coordinates_raw,
                p.estimated_cost,
                p.radius_group,
                p.name
            FROM places p
            INNER JOIN place_types pt ON pt.id = p.type_id
            INNER JOIN place_seasons ps ON ps.place_id = p.id
            INNER JOIN seasons s ON s.id = ps.season_id
            WHERE p.is_active = TRUE
              AND s.slug = %(season_slug)s
        """
        rows: list[PlaceCandidate] = []
        with conn.cursor() as cur:
            cur.execute(sql, {"season_slug": season_slug})
            for rec in cur.fetchall():
                (
                    pid,
                    type_slug,
                    lat,
                    lon,
                    raw,
                    est_cost,
                    radius_g,
                    name,
                ) = rec
                plat, plon = CoordinateParser.parse(lat, lon, raw)
                slug = str(type_slug).strip().lower() if type_slug else "unknown"
                rows.append(
                    PlaceCandidate(
                        place_id=int(pid),
                        type_slug=slug,
                        latitude=plat,
                        longitude=plon,
                        estimated_cost=float(est_cost) if est_cost is not None else None,
                        radius_group=str(radius_g) if radius_g is not None else None,
                        name=str(name or "")[:500],
                    ),
                )
        return rows
