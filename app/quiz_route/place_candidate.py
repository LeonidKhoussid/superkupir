from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PlaceCandidate:
    """КАНДИДАТ МЕСТА ИЗ КАТАЛОГА"""

    place_id: int
    type_slug: str
    latitude: float | None
    longitude: float | None
    estimated_cost: float | None
    radius_group: str | None
    name: str
