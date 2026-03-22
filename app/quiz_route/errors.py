from __future__ import annotations


class UnsatisfiableQuizRouteError(Exception):
    """НЕВОЗМОЖНО СОБРАТЬ МАРШРУТ ПО ОГРАНИЧЕНИЯМ"""

    # Инициализация текста для 422
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail
