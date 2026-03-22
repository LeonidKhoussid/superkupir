from __future__ import annotations

import math
from typing import Any


class CsvNormalize:
    """НОРМАЛИЗАЦИЯ ЯЧЕЕК CSV"""

    _EMPTY_TOKENS = frozenset(
        {
            "",
            "nan",
            "na",
            "none",
            "null",
            "#n/a",
            "n/a",
        },
    )

    # Пустое ли значение после нормализации строки
    @classmethod
    def _is_empty_token(cls, text: str) -> bool:
        return text.strip().lower() in cls._EMPTY_TOKENS

    # Нормализация одной ячейки при чтении
    @classmethod
    def normalize_cell(cls, value: Any) -> Any:
        if value is None:
            return ""
        if isinstance(value, float) and math.isnan(value):
            return ""
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        if cls._is_empty_token(stripped):
            return ""
        return stripped

    # Нормализация строки CSV
    @classmethod
    def normalize_row(cls, row: dict[str, Any]) -> dict[str, Any]:
        return {key: cls.normalize_cell(val) for key, val in row.items()}

    # Подготовка значения к записи в CSV
    @classmethod
    def sanitize_for_write(cls, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, float) and math.isnan(value):
            return ""
        if isinstance(value, bool):
            return "true" if value else "false"
        text = str(value).strip()
        if cls._is_empty_token(text):
            return ""
        lowered = text.lower()
        if lowered in cls._EMPTY_TOKENS:
            return ""
        return text

    # Подготовка строки к записи
    @classmethod
    def sanitize_row_for_write(
        cls,
        row: dict[str, Any],
        fieldnames: list[str],
    ) -> dict[str, str]:
        out: dict[str, str] = {}
        for name in fieldnames:
            out[name] = cls.sanitize_for_write(row.get(name, ""))
        return out


# Запуск
if __name__ == "__main__":
    print(CsvNormalize.normalize_cell(" NaN "))
