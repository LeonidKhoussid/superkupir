from __future__ import annotations

import re


class CoordinateParser:
    """РАЗБОР КООРДИНАТ ИЗ latitude/longitude ИЛИ coordinates_raw"""

    # Нормализация пары широта/долгота
    @staticmethod
    def parse(
        latitude: object,
        longitude: object,
        coordinates_raw: object,
    ) -> tuple[float | None, float | None]:
        lat, lon = CoordinateParser._try_float_pair(latitude, longitude)
        if lat is not None and lon is not None:
            return lat, lon
        return CoordinateParser._from_raw(coordinates_raw)

    # Попытка привести поля БД к float
    @staticmethod
    def _try_float_pair(latitude: object, longitude: object) -> tuple[float | None, float | None]:
        try:
            if latitude is None or longitude is None:
                return None, None
            lat = float(latitude)
            lon = float(longitude)
            return lat, lon
        except (TypeError, ValueError):
            return None, None

    # Извлечение двух чисел из сырой строки
    @staticmethod
    def _from_raw(coordinates_raw: object) -> tuple[float | None, float | None]:
        if coordinates_raw is None:
            return None, None
        s = str(coordinates_raw).strip()
        if not s:
            return None, None
        parts = re.findall(r"-?\d+(?:\.\d+)?", s.replace(",", "."))
        floats: list[float] = []
        for p in parts:
            try:
                floats.append(float(p))
            except ValueError:
                continue
        if len(floats) < 2:
            return None, None
        a, b = floats[0], floats[1]
        if abs(a) <= 90 and abs(b) <= 180:
            return a, b
        if abs(b) <= 90 and abs(a) <= 180:
            return b, a
        return None, None
