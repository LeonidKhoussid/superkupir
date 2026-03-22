from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from ddgs import DDGS


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import WebSearchConfig


class PlaceResearcher:
    """ВЕБ-ПОИСК ИНФОРМАЦИИ О МЕСТАХ"""

    # Инициализация поисковика
    def __init__(self) -> None:
        self.cfg = WebSearchConfig()

    # Формирование поисковых запросов для места
    @staticmethod
    def _build_queries(place_name: str, place_type: str = "", city: str = "") -> list[str]:
        location_suffix = f" {city}" if city else " Краснодарский край"
        queries = [f"{place_name}{location_suffix} отзывы описание"]
        if place_type:
            queries.append(f"{place_name} {place_type}{location_suffix}")
        else:
            queries.append(f"{place_name}{location_suffix} что посмотреть впечатления")
        return queries

    # Поиск информации в интернете
    def _search_web(self, query: str) -> list[dict[str, Any]]:
        try:
            return DDGS().text(
                query,
                region=self.cfg.region,
                max_results=self.cfg.max_results,
            )
        except Exception as exc:
            print(f"[researcher] Ошибка поиска: {exc}")
            return []

    # Сборка контекста из результатов поиска
    @staticmethod
    def _compile_context(results: list[dict[str, Any]]) -> str:
        if not results:
            return ""

        seen_titles: set[str] = set()
        snippets: list[str] = []
        for item in results:
            title = item.get("title", "").strip()
            body = item.get("body", "").strip()
            if not body or title in seen_titles:
                continue
            seen_titles.add(title)
            snippets.append(f"— {title}: {body}")

        return "\n".join(snippets)

    # Полный поиск информации о месте
    def research_place(
        self,
        place_name: str,
        place_type: str = "",
        city: str = "",
    ) -> str:
        queries = self._build_queries(place_name, place_type, city)
        all_results: list[dict[str, Any]] = []

        for query in queries[: self.cfg.search_queries_per_place]:
            print(f"[researcher] Поиск: {query}")
            results = self._search_web(query)
            all_results.extend(results)

        context = self._compile_context(all_results)
        if not context:
            print(f"[researcher] Информация по '{place_name}' не найдена.")
        return context

    # Поиск по нескольким местам
    def research_places(
        self,
        places: list[dict[str, str]],
    ) -> dict[str, str]:
        results: dict[str, str] = {}
        for place in places:
            name = place.get("name", "")
            if not name:
                continue
            context = self.research_place(
                place_name=name,
                place_type=place.get("type", ""),
                city=place.get("city", ""),
            )
            if context:
                results[name] = context
        return results

from app.services.place_researcher import PlaceResearcher

# Запуск
if __name__ == "__main__":
    researcher = PlaceResearcher()
    info = researcher.research_place("Шато де Талю", "винодельня", "Геленджик")
    print(info[:500] if info else "Ничего не найдено")

