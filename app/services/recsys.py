from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import EmbeddingConfig, ExtractionConfig, PathConfig, RecommenderConfig
from app.db_connector.models import CsvDataContract
from app.db_connector.repositories import CsvRepository
from app.db_connector.session import CsvSession
from app.planner.graph_builder import TripGraphBuilder
from app.planner.route_optimizer import RouteOptimizer
from app.services.backend_exporter import BackendCsvExporter
from app.services.parser import TripRequestParser
from app.services.search import TripSearchService
from app.services.transcription import TranscriptionService


class RecsysService:
    """ЕДИНЫЙ ПАЙПЛАЙН РЕКОМЕНДАЦИЙ"""

    # Инициализация рекомендательного пайплайна
    def __init__(self) -> None:
        self.paths = PathConfig()
        self.paths.ensure_directories()
        self.contract = CsvDataContract()
        self.repository = CsvRepository()
        self.session = CsvSession()
        self.parser = TripRequestParser()
        self.search_service = TripSearchService()
        self.optimizer = RouteOptimizer()
        self.transcription_service = TranscriptionService()
        self.graph_builder = TripGraphBuilder()
        self.backend_exporter = BackendCsvExporter()
        self.embedding_cfg = EmbeddingConfig()
        self.extract_cfg = ExtractionConfig()
        self.recommender_cfg = RecommenderConfig()
        self.llm_model_path = self.paths.extraction_llm_dir / self.extract_cfg.model_filename

    # Нормализация текста
    @staticmethod
    def _normalize_text(text: Any) -> str:
        return " ".join(str(text or "").replace("\n", " ").split()).strip()

    # Разделение значений по ;
    @staticmethod
    def _split_values(value: Any) -> list[str]:
        if value in ("", None):
            return []
        return [item.strip() for item in str(value).split(";") if item.strip()]

    # Нормализация bool-значения
    @staticmethod
    def _as_bool(value: Any) -> bool:
        if isinstance(value, bool):
            return value
        return str(value or "").strip().lower() in {"1", "true", "yes", "да"}

    # Нормализация int-значения
    @staticmethod
    def _as_int(value: Any) -> int:
        if value in ("", None):
            return 0
        try:
            return int(float(str(value).replace(",", ".")))
        except Exception:
            return 0

    # Проверка заполненности значения
    @staticmethod
    def _has_value(value: Any) -> bool:
        if value in ("", None, [], {}):
            return False
        if isinstance(value, bool):
            return value
        return True

    # Слияние списков без дублей
    def _merge_unique(self, *groups: list[str]) -> list[str]:
        merged: list[str] = []
        seen: set[str] = set()
        for group in groups:
            for item in group:
                normalized = self._normalize_text(item)
                if not normalized or normalized in seen:
                    continue
                seen.add(normalized)
                merged.append(normalized)
        return merged

    # Определение сезона по дате
    def _season_from_date(self, date_start: str) -> str:
        if not date_start:
            return ""
        try:
            month = datetime.strptime(date_start, "%Y-%m-%d").month
        except Exception:
            return ""
        if month in {12, 1, 2}:
            return "зима"
        if month in {3, 4, 5}:
            return "весна"
        if month in {6, 7, 8}:
            return "лето"
        return "осень"

    # Нормализация тем под реальные place-features
    def _canonicalize_theme_values(
        self,
        raw_values: list[str],
        season: str,
    ) -> list[str]:
        alias_map = {
            "wine": ["вино", "гастрономия", "романтика"],
            "food": ["еда", "гастрономия"],
            "nature": ["природа", "прогулка", "виды"],
            "family": ["семья", "отдых"],
            "quiet": ["тишина", "отдых"],
            "premium": ["премиум"],
            "authentic": ["локальное"],
            "festivals": ["события"],
            "pet-friendly": ["питомцы"],
            "local_food": ["локальное"],
            "sea_view": ["виды"],
            "лето": ["лето", "море", "природа"],
            "весна": ["весна", "природа", "прогулка"],
            "осень": ["осень", "природа", "виды"],
            "зима": ["зима", "культура", "история"],
        }
        canonical = self._merge_unique(raw_values, alias_map.get(season, []))
        expanded: list[str] = []
        for value in canonical:
            lowered = value.lower()
            expanded.extend(alias_map.get(lowered, [value]))
        return self._merge_unique(expanded)

    # Нормализация food-preferences под кухни и форматы
    def _canonicalize_food_values(self, raw_values: list[str]) -> list[str]:
        alias_map = {
            "local": ["локальная", "местная"],
            "fish_and_seafood": ["морепродукты", "рыба"],
            "kids_menu": ["детское меню"],
            "wine_pairing": ["вино", "авторская", "европейская"],
        }
        canonical = self._merge_unique(raw_values)
        expanded: list[str] = []
        for value in canonical:
            lowered = value.lower()
            expanded.extend(alias_map.get(lowered, [value]))
        return self._merge_unique(expanded)

    # Первичная база тем из user_01_base.csv
    def _seed_base_themes(self, user_row: dict[str, Any]) -> list[str]:
        raw_group = str(user_row.get("group", "") or "").strip()
        raw_activity = str(user_row.get("activity", "") or "").strip()
        raw_season = str(user_row.get("season", "") or "").strip()

        seeded: list[str] = []
        seeded.extend(self.recommender_cfg.group_themes.get(raw_group, {}).keys())
        seeded.extend(self.recommender_cfg.activity_themes.get(raw_activity, {}).keys())
        seeded.extend(self.recommender_cfg.season_themes.get(raw_season, {}).keys())
        return self._merge_unique(seeded)

    # Построение wants-флагов
    def _build_wants_flags(self, trip_request: dict[str, Any]) -> dict[str, bool]:
        preferences = trip_request.get("preferences", {})
        stay = trip_request.get("stay", {})
        party = trip_request.get("party", {})
        theme_tokens = {
            token.lower()
            for token in self._merge_unique(
                preferences.get("themes", []),
                preferences.get("food_preferences", []),
                preferences.get("preferred_location_themes", []),
                preferences.get("preferred_location_types", []),
                preferences.get("preferred_cuisine_types", []),
                stay.get("preferred_tags", []),
            )
        }
        crowd_tolerance = str(preferences.get("crowd_tolerance", "") or "").strip().lower()
        trip_style = str(preferences.get("trip_style", "") or "").strip().lower()
        group_type = str(party.get("group_type", "") or "").strip().lower()

        wants_quiet = crowd_tolerance == "хочу_тихо" or "тишина" in theme_tokens
        wants_family = group_type == "семья" or int(party.get("children", 0) or 0) > 0

        return {
            "wants_wine": bool({"вино", "гастрономия"} & theme_tokens),
            "wants_food": bool({"еда", "гастрономия", "морепродукты", "рыба"} & theme_tokens),
            "wants_nature": bool({"природа", "прогулка", "парк"} & theme_tokens),
            "wants_history": bool({"история", "культура", "музей"} & theme_tokens),
            "wants_city": bool({"город", "архитектура", "культура"} & theme_tokens)
            or "город" in trip_style,
            "wants_sea": bool({"море", "пляж"} & theme_tokens),
            "wants_views": bool({"виды", "панорама", "смотровая_площадка", "фото"} & theme_tokens),
            "wants_quiet": wants_quiet,
            "wants_family_focus": wants_family,
            "wants_spa": "спа" in theme_tokens,
            "wants_romantic": group_type == "пара" or "романтика" in theme_tokens,
        }

    # Вывод приоритетных категорий
    def _derive_focus_categories(
        self,
        trip_request: dict[str, Any],
        wants_flags: dict[str, bool],
    ) -> list[str]:
        scores = {
            "activity": 0.65,
            "food": 0.40,
            "wine": 0.0,
            "stay": 0.20 if trip_request.get("stay", {}).get("stay_needed") else 0.0,
        }
        if wants_flags["wants_wine"]:
            scores["wine"] += 0.75
        if wants_flags["wants_food"]:
            scores["food"] += 0.55
        if (
            wants_flags["wants_nature"]
            or wants_flags["wants_history"]
            or wants_flags["wants_city"]
            or wants_flags["wants_views"]
            or wants_flags["wants_sea"]
        ):
            scores["activity"] += 0.55
        if wants_flags["wants_family_focus"]:
            scores["activity"] += 0.15
            scores["food"] += 0.10
        if wants_flags["wants_romantic"] or wants_flags["wants_spa"] or wants_flags["wants_quiet"]:
            scores["stay"] += 0.30
        ordered = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        return [name for name, score in ordered if score >= 0.30]

    # Вывод предпочтительных городов
    def _derive_preferred_cities(
        self,
        destination_city: str,
        wants_flags: dict[str, bool],
    ) -> list[str]:
        cluster_map = {
            "Абрау-Дюрсо": [
                "Абрау-Дюрсо",
                "Новороссийск",
                "Мысхако",
                "Федотовка",
                "Южная Озереевка",
            ],
            "Новороссийск": [
                "Новороссийск",
                "Мысхако",
                "Абрау-Дюрсо",
                "Федотовка",
                "Южная Озереевка",
            ],
            "Мысхако": [
                "Мысхако",
                "Новороссийск",
                "Абрау-Дюрсо",
                "Федотовка",
                "Южная Озереевка",
            ],
        }
        cities = cluster_map.get(destination_city, [destination_city] if destination_city else [])
        if wants_flags["wants_wine"] and "Абрау-Дюрсо" not in cities:
            cities.append("Абрау-Дюрсо")
        if wants_flags["wants_sea"] and "Мысхако" not in cities:
            cities.append("Мысхако")
        return self._merge_unique(cities)

    # Вывод предпочтительных зон
    def _derive_preferred_areas(
        self,
        current_areas: list[str],
        wants_flags: dict[str, bool],
    ) -> list[str]:
        derived = list(current_areas)
        if wants_flags["wants_sea"]:
            derived.append("побережье")
        if wants_flags["wants_wine"]:
            derived.append("винный_кластер")
        if wants_flags["wants_city"] or wants_flags["wants_history"]:
            derived.append("центр")
        if not derived:
            derived.append("окрестности")
        return self._merge_unique(derived)

    # Вывод предпочтительных типов проживания
    def _derive_hotel_types(
        self,
        trip_request: dict[str, Any],
        wants_flags: dict[str, bool],
    ) -> list[str]:
        if not trip_request.get("stay", {}).get("stay_needed"):
            return []
        budget_level = str(trip_request.get("constraints", {}).get("budget_level", "") or "")
        derived = ["отель"]
        if budget_level == "высокий":
            derived.extend(["бутик-отель", "апарт-отель"])
        elif budget_level == "средний":
            derived.extend(["апарт-отель", "гостевой_дом"])
        else:
            derived.extend(["гостевой_дом", "гостиница"])
        if wants_flags["wants_family_focus"]:
            derived.append("апарт-отель")
        return self._merge_unique(
            trip_request.get("stay", {}).get("accommodation_type", []),
            derived,
        )

    # Вывод предпочтительных hotel-tags
    def _derive_hotel_tags(
        self,
        trip_request: dict[str, Any],
        wants_flags: dict[str, bool],
    ) -> list[str]:
        destination_city = str(
            trip_request.get("client_context", {}).get("destination_city", "") or ""
        )
        must_have = trip_request.get("constraints", {}).get("must_have", [])
        derived: list[str] = []
        if wants_flags["wants_views"]:
            if destination_city == "Абрау-Дюрсо":
                derived.append("вид_на_озеро")
            if wants_flags["wants_sea"]:
                derived.append("вид_на_море")
        if wants_flags["wants_spa"]:
            derived.append("спа")
        if "parking" in must_have or trip_request.get("transport", {}).get("has_car"):
            derived.append("парковка")
        if wants_flags["wants_quiet"]:
            derived.append("тихо")
        return self._merge_unique(
            trip_request.get("stay", {}).get("preferred_tags", []),
            derived,
        )

    # Вывод предпочтительных тем локаций
    def _derive_location_themes(self, wants_flags: dict[str, bool]) -> list[str]:
        derived: list[str] = []
        if wants_flags["wants_nature"]:
            derived.extend(["природа", "прогулка"])
        if wants_flags["wants_views"]:
            derived.append("виды")
        if wants_flags["wants_history"]:
            derived.extend(["история", "культура"])
        if wants_flags["wants_sea"]:
            derived.append("море")
        if wants_flags["wants_family_focus"]:
            derived.extend(["семья", "отдых"])
        if wants_flags["wants_romantic"]:
            derived.append("романтика")
        return self._merge_unique(derived)

    # Вывод предпочтительных типов локаций
    def _derive_location_types(self, wants_flags: dict[str, bool]) -> list[str]:
        derived: list[str] = []
        if wants_flags["wants_views"]:
            derived.append("смотровая_площадка")
        if wants_flags["wants_nature"] or wants_flags["wants_sea"]:
            derived.extend(["парк", "природная_локация"])
        if wants_flags["wants_history"] or wants_flags["wants_city"]:
            derived.extend(["музей", "культурная_точка"])
        return self._merge_unique(derived)

    # Вывод предпочтительных типов food-мест
    def _derive_food_place_types(
        self,
        trip_request: dict[str, Any],
        wants_flags: dict[str, bool],
    ) -> list[str]:
        budget_level = str(trip_request.get("constraints", {}).get("budget_level", "") or "")
        derived = ["ресторан", "кафе"]
        if budget_level == "низкий":
            derived = ["кафе", "столовая"]
        elif wants_flags["wants_wine"] or wants_flags["wants_romantic"]:
            derived = ["ресторан", "гастро_бар", "кафе"]
        return self._merge_unique(derived)

    # Вывод предпочтительных кухонь
    def _derive_cuisine_types(
        self,
        trip_request: dict[str, Any],
        wants_flags: dict[str, bool],
    ) -> list[str]:
        derived = list(trip_request.get("preferences", {}).get("food_preferences", []))
        if wants_flags["wants_sea"]:
            derived.extend(["морепродукты", "рыба"])
        if wants_flags["wants_wine"]:
            derived.extend(["авторская", "европейская"])
        if not derived:
            derived.append("европейская")
        return self._merge_unique(derived)

    # Вывод исключаемых типов мест
    def _derive_avoid_place_types(
        self,
        trip_request: dict[str, Any],
        wants_flags: dict[str, bool],
    ) -> list[str]:
        avoid_place_types = list(trip_request.get("constraints", {}).get("avoid_place_types", []))
        avoid = trip_request.get("constraints", {}).get("avoid", [])
        if "шумные_места" in avoid or wants_flags["wants_quiet"] or wants_flags["wants_family_focus"]:
            avoid_place_types.append("бар")
        return self._merge_unique(avoid_place_types)

    # Короткий query_text для поиска
    def _build_query_text(self, trip_request: dict[str, Any]) -> str:
        preferences = trip_request.get("preferences", {})
        client_context = trip_request.get("client_context", {})
        parts = [
            str(trip_request.get("party", {}).get("group_type", "") or ""),
            f"на {int(trip_request.get('dates', {}).get('duration_days', 0) or 0)} дня",
            str(client_context.get("destination_city", "") or ""),
            "темы: " + ", ".join(preferences.get("themes", [])),
            "еда: " + ", ".join(preferences.get("preferred_cuisine_types", [])),
            "фокус: " + ", ".join(preferences.get("focus_categories", [])),
            "темп: " + str(preferences.get("pace", "") or ""),
            "бюджет: " + str(trip_request.get("constraints", {}).get("budget_level", "") or ""),
        ]
        return self._normalize_text(" ".join(part for part in parts if part and not part.endswith(": ")))

    # Богатый semantic-profile для эмбеддинга
    def _build_semantic_profile_text(self, trip_request: dict[str, Any]) -> str:
        preferences = trip_request.get("preferences", {})
        stay = trip_request.get("stay", {})
        constraints = trip_request.get("constraints", {})
        transport = trip_request.get("transport", {})
        client_context = trip_request.get("client_context", {})
        parts = [
            f"сезон: {trip_request.get('travel_season', '')}",
            f"город: {client_context.get('destination_city', '')}",
            f"города: {', '.join(client_context.get('preferred_cities', []))}",
            f"группа: {trip_request.get('party', {}).get('group_type', '')}",
            f"темы: {', '.join(preferences.get('themes', []))}",
            f"темы локаций: {', '.join(preferences.get('preferred_location_themes', []))}",
            f"типы локаций: {', '.join(preferences.get('preferred_location_types', []))}",
            f"еда: {', '.join(preferences.get('food_preferences', []))}",
            f"типы еды: {', '.join(preferences.get('preferred_food_place_types', []))}",
            f"кухни: {', '.join(preferences.get('preferred_cuisine_types', []))}",
            f"отель: {', '.join(stay.get('accommodation_type', []))}",
            f"hotel tags: {', '.join(stay.get('preferred_tags', []))}",
            f"районы: {', '.join(stay.get('preferred_zone', []))}",
            f"фокус: {', '.join(preferences.get('focus_categories', []))}",
            f"темп: {preferences.get('pace', '')}",
            f"толпы: {preferences.get('crowd_tolerance', '')}",
            f"стиль: {preferences.get('trip_style', '')}",
            f"переезд до: {transport.get('max_transfer_minutes', 0)} минут",
            f"машина: {transport.get('has_car', False)}",
            f"must have: {', '.join(constraints.get('must_have', []))}",
            f"avoid: {', '.join(constraints.get('avoid', []))}",
            f"avoid types: {', '.join(constraints.get('avoid_place_types', []))}",
        ]
        return self._normalize_text(" | ".join(part for part in parts if part and not part.endswith(": ")))

    # Обогащение trip_request новыми полями
    def _enrich_trip_request(
        self,
        trip_request: dict[str, Any],
        user_row: dict[str, Any] | None,
    ) -> dict[str, Any]:
        season = str(trip_request.get("travel_season", "") or "").strip()
        if not season and user_row is not None:
            season = str(user_row.get("season", "") or "").strip()
        if not season:
            season = self._season_from_date(str(trip_request.get("dates", {}).get("start_date", "") or ""))
        trip_request["travel_season"] = season or "лето"

        if not trip_request.get("client_context", {}).get("destination_city"):
            trip_request["client_context"]["destination_city"] = "Абрау-Дюрсо"

        if not trip_request.get("stay", {}).get("room_capacity_needed"):
            trip_request["stay"]["room_capacity_needed"] = max(
                int(trip_request.get("party", {}).get("adults", 0) or 0)
                + int(trip_request.get("party", {}).get("children", 0) or 0),
                1,
            )
        if trip_request.get("stay", {}).get("stay_needed") and not trip_request.get("stay", {}).get("rooms_count"):
            trip_request["stay"]["rooms_count"] = 1

        if user_row is not None and not trip_request.get("preferences", {}).get("pace"):
            raw_activity = str(user_row.get("activity", "") or "").strip().lower()
            if "спокой" in raw_activity:
                trip_request["preferences"]["pace"] = "спокойный"
            elif "актив" in raw_activity:
                trip_request["preferences"]["pace"] = "активный"

        seeded_themes = self._seed_base_themes(user_row or {})
        trip_request["preferences"]["themes"] = self._canonicalize_theme_values(
            self._merge_unique(
                seeded_themes,
                trip_request.get("preferences", {}).get("themes", []),
            ),
            trip_request["travel_season"],
        )
        trip_request["preferences"]["food_preferences"] = self._canonicalize_food_values(
            trip_request.get("preferences", {}).get("food_preferences", []),
        )

        wants_flags = self._build_wants_flags(trip_request)
        trip_request["client_context"]["preferred_cities"] = self._derive_preferred_cities(
            str(trip_request.get("client_context", {}).get("destination_city", "") or ""),
            wants_flags,
        )
        trip_request["stay"]["preferred_zone"] = self._derive_preferred_areas(
            trip_request.get("stay", {}).get("preferred_zone", []),
            wants_flags,
        )
        trip_request["stay"]["accommodation_type"] = self._derive_hotel_types(
            trip_request,
            wants_flags,
        )
        trip_request["stay"]["preferred_tags"] = self._derive_hotel_tags(
            trip_request,
            wants_flags,
        )
        trip_request["preferences"]["preferred_location_themes"] = self._derive_location_themes(
            wants_flags,
        )
        trip_request["preferences"]["preferred_location_types"] = self._derive_location_types(
            wants_flags,
        )
        trip_request["preferences"]["preferred_food_place_types"] = self._derive_food_place_types(
            trip_request,
            wants_flags,
        )
        trip_request["preferences"]["preferred_cuisine_types"] = self._derive_cuisine_types(
            trip_request,
            wants_flags,
        )
        trip_request["constraints"]["avoid_place_types"] = self._derive_avoid_place_types(
            trip_request,
            wants_flags,
        )
        trip_request["preferences"]["focus_categories"] = self._derive_focus_categories(
            trip_request,
            wants_flags,
        )
        trip_request["query_text"] = self._build_query_text(trip_request)
        trip_request["semantic_profile_text"] = self._build_semantic_profile_text(trip_request)
        return trip_request

    # Подсчёт явно известных полей
    def _count_known_fields(
        self,
        trip_request: dict[str, Any],
        user_row: dict[str, Any] | None,
        refinement_raw_text: str,
    ) -> int:
        known = 0
        if user_row is not None:
            for key in ("season", "days", "group", "activity", "budget"):
                if self._normalize_text(user_row.get(key, "")):
                    known += 1
        if refinement_raw_text:
            known += 1
        parsed_slots = trip_request.get("parsed_slots", {})
        known += sum(
            1
            for slot_payload in parsed_slots.values()
            if self._has_value(slot_payload.get("value"))
        )
        return known

    # Подсчёт доинференсенных полей
    def _count_inferred_fields(self, profile_row: dict[str, Any], known_fields_count: int) -> int:
        ignored = {
            "user_id",
            "request_id",
            "session_id",
            "profile_stage",
            "raw_text",
            "refinement_raw_text",
            "known_fields_count",
            "inferred_fields_count",
            "query_text",
            "semantic_profile_text",
            "embedding_model",
            "embedding_dim",
            "embedding_key",
            "query_embedding_json",
        }
        filled = sum(
            1
            for key, value in profile_row.items()
            if key not in ignored and self._has_value(value)
        )
        return max(filled - known_fields_count, 0)

    # Вычисление и сохранение query-эмбеддинга
    def _attach_query_embedding(self, trip_request: dict[str, Any]) -> dict[str, Any]:
        vector = self.search_service.embeddings.encode_query(trip_request)
        trip_request["query_embedding"] = vector.tolist()
        return trip_request

    # Сборка строки user_02_detail.csv
    def _build_user_02_detail_row(
        self,
        trip_request: dict[str, Any],
        user_id: str,
        profile_stage: str,
        refinement_raw_text: str,
        user_row: dict[str, Any] | None,
    ) -> dict[str, Any]:
        preferences = trip_request.get("preferences", {})
        constraints = trip_request.get("constraints", {})
        stay = trip_request.get("stay", {})
        party = trip_request.get("party", {})
        dates = trip_request.get("dates", {})
        transport = trip_request.get("transport", {})
        client_context = trip_request.get("client_context", {})
        wants_flags = self._build_wants_flags(trip_request)
        budget_total = int(constraints.get("budget_total_rub", 0) or 0)
        days_count = max(int(dates.get("duration_days", 0) or 0), 1)
        embedding_values = trip_request.get("query_embedding", [])
        embedding_key = hashlib.sha1(
            (
                self.embedding_cfg.model_name
                + str(trip_request.get("query_text", ""))
                + str(trip_request.get("semantic_profile_text", ""))
            ).encode("utf-8")
        ).hexdigest()

        row = {
            "user_id": str(user_id).strip(),
            "request_id": str(trip_request.get("request_id", "") or ""),
            "session_id": str(trip_request.get("session_id", "") or ""),
            "profile_stage": profile_stage,
            "raw_text": str(trip_request.get("raw_text", "") or ""),
            "refinement_raw_text": refinement_raw_text,
            "travel_season": str(trip_request.get("travel_season", "") or ""),
            "city_from": str(client_context.get("start_city", "") or ""),
            "city_to": str(client_context.get("destination_city", "") or ""),
            "preferred_cities": ";".join(client_context.get("preferred_cities", [])),
            "area_to": ";".join(stay.get("preferred_zone", [])),
            "preferred_areas": ";".join(stay.get("preferred_zone", [])),
            "date_start": str(dates.get("start_date", "") or ""),
            "date_end": str(dates.get("end_date", "") or ""),
            "days_count": days_count,
            "nights_count": int(dates.get("nights_count", 0) or 0),
            "group_type": str(party.get("group_type", "") or ""),
            "adults_count": int(party.get("adults", 0) or 0),
            "children_count": int(party.get("children", 0) or 0),
            "child_ages": ";".join(str(value) for value in party.get("child_ages", [])),
            "stay_needed": bool(stay.get("stay_needed", False)),
            "stay_type": ";".join(stay.get("accommodation_type", [])),
            "preferred_hotel_types": ";".join(stay.get("accommodation_type", [])),
            "preferred_hotel_tags": ";".join(stay.get("preferred_tags", [])),
            "hotel_stars_min": int(stay.get("hotel_stars_min", 0) or 0),
            "rooms_count": int(stay.get("rooms_count", 0) or 0),
            "room_capacity_needed": int(stay.get("room_capacity_needed", 0) or 0),
            "budget_level": str(constraints.get("budget_level", "") or ""),
            "budget_total_rub": budget_total,
            "budget_per_day_rub": round(budget_total / max(days_count, 1), 2),
            "themes": ";".join(preferences.get("themes", [])),
            "preferred_location_themes": ";".join(preferences.get("preferred_location_themes", [])),
            "preferred_location_types": ";".join(preferences.get("preferred_location_types", [])),
            "food_preferences": ";".join(preferences.get("food_preferences", [])),
            "preferred_food_place_types": ";".join(preferences.get("preferred_food_place_types", [])),
            "preferred_cuisine_types": ";".join(preferences.get("preferred_cuisine_types", [])),
            "pace": str(preferences.get("pace", "") or ""),
            "crowd_tolerance": str(preferences.get("crowd_tolerance", "") or ""),
            "trip_style": str(preferences.get("trip_style", "") or ""),
            "focus_categories": ";".join(preferences.get("focus_categories", [])),
            "max_transfer_minutes": int(transport.get("max_transfer_minutes", 0) or 0),
            "with_car": bool(transport.get("has_car", False)),
            "kids_friendly_required": bool(constraints.get("kids_friendly_required", False)),
            "pet_friendly_required": bool(constraints.get("pet_friendly_required", False)),
            "mobility_constraints": ";".join(constraints.get("mobility_constraints", [])),
            "must_have": ";".join(constraints.get("must_have", [])),
            "avoid": ";".join(constraints.get("avoid", [])),
            "avoid_place_types": ";".join(constraints.get("avoid_place_types", [])),
            "wants_wine": wants_flags["wants_wine"],
            "wants_food": wants_flags["wants_food"],
            "wants_nature": wants_flags["wants_nature"],
            "wants_history": wants_flags["wants_history"],
            "wants_city": wants_flags["wants_city"],
            "wants_sea": wants_flags["wants_sea"],
            "wants_views": wants_flags["wants_views"],
            "wants_quiet": wants_flags["wants_quiet"],
            "wants_family_focus": wants_flags["wants_family_focus"],
            "wants_spa": wants_flags["wants_spa"],
            "wants_romantic": wants_flags["wants_romantic"],
            "known_fields_count": 0,
            "inferred_fields_count": 0,
            "query_text": str(trip_request.get("query_text", "") or ""),
            "semantic_profile_text": str(trip_request.get("semantic_profile_text", "") or ""),
            "embedding_model": self.embedding_cfg.model_name,
            "embedding_dim": len(embedding_values),
            "embedding_key": embedding_key,
            "query_embedding_json": json.dumps(embedding_values, ensure_ascii=False),
        }
        known_fields_count = self._count_known_fields(trip_request, user_row, refinement_raw_text)
        row["known_fields_count"] = known_fields_count
        row["inferred_fields_count"] = self._count_inferred_fields(row, known_fields_count)
        return row

    # Восстановление trip_request из user_02_detail.csv
    def _build_trip_request_from_detail_row(self, row: dict[str, Any]) -> dict[str, Any]:
        trip_request = self.contract.create_trip_request()
        trip_request["request_id"] = str(row.get("request_id", "") or "")
        trip_request["session_id"] = str(row.get("session_id", "") or "")
        trip_request["raw_text"] = str(row.get("raw_text", "") or "")
        trip_request["query_text"] = str(row.get("query_text", "") or "")
        trip_request["semantic_profile_text"] = str(row.get("semantic_profile_text", "") or "")
        trip_request["travel_season"] = str(row.get("travel_season", "") or "")
        trip_request["client_context"]["start_city"] = str(row.get("city_from", "") or "")
        trip_request["client_context"]["destination_city"] = str(row.get("city_to", "") or "")
        trip_request["client_context"]["preferred_cities"] = self._split_values(
            row.get("preferred_cities", ""),
        )
        trip_request["dates"]["start_date"] = str(row.get("date_start", "") or "")
        trip_request["dates"]["end_date"] = str(row.get("date_end", "") or "")
        trip_request["dates"]["duration_days"] = self._as_int(row.get("days_count", 0))
        trip_request["dates"]["nights_count"] = self._as_int(row.get("nights_count", 0))
        trip_request["party"]["group_type"] = str(row.get("group_type", "") or "")
        trip_request["party"]["adults"] = self._as_int(row.get("adults_count", 0))
        trip_request["party"]["children"] = self._as_int(row.get("children_count", 0))
        trip_request["party"]["child_ages"] = [
            self._as_int(value)
            for value in self._split_values(row.get("child_ages", ""))
            if self._as_int(value) > 0
        ]
        trip_request["transport"]["has_car"] = self._as_bool(row.get("with_car", False))
        trip_request["transport"]["max_transfer_minutes"] = self._as_int(
            row.get("max_transfer_minutes", 0),
        )
        trip_request["stay"]["stay_needed"] = self._as_bool(row.get("stay_needed", False))
        trip_request["stay"]["accommodation_type"] = self._split_values(
            row.get("preferred_hotel_types", "") or row.get("stay_type", ""),
        )
        trip_request["stay"]["preferred_tags"] = self._split_values(
            row.get("preferred_hotel_tags", ""),
        )
        trip_request["stay"]["hotel_stars_min"] = self._as_int(row.get("hotel_stars_min", 0))
        trip_request["stay"]["rooms_count"] = self._as_int(row.get("rooms_count", 0))
        trip_request["stay"]["room_capacity_needed"] = self._as_int(
            row.get("room_capacity_needed", 0),
        )
        trip_request["stay"]["preferred_zone"] = self._split_values(
            row.get("preferred_areas", "") or row.get("area_to", ""),
        )
        trip_request["preferences"]["themes"] = self._split_values(row.get("themes", ""))
        trip_request["preferences"]["preferred_location_themes"] = self._split_values(
            row.get("preferred_location_themes", ""),
        )
        trip_request["preferences"]["preferred_location_types"] = self._split_values(
            row.get("preferred_location_types", ""),
        )
        trip_request["preferences"]["food_preferences"] = self._split_values(
            row.get("food_preferences", ""),
        )
        trip_request["preferences"]["preferred_food_place_types"] = self._split_values(
            row.get("preferred_food_place_types", ""),
        )
        trip_request["preferences"]["preferred_cuisine_types"] = self._split_values(
            row.get("preferred_cuisine_types", ""),
        )
        trip_request["preferences"]["pace"] = str(row.get("pace", "") or "")
        trip_request["preferences"]["crowd_tolerance"] = str(row.get("crowd_tolerance", "") or "")
        trip_request["preferences"]["trip_style"] = str(row.get("trip_style", "") or "")
        trip_request["preferences"]["focus_categories"] = self._split_values(
            row.get("focus_categories", ""),
        )
        trip_request["constraints"]["budget_level"] = str(row.get("budget_level", "") or "")
        trip_request["constraints"]["budget_total_rub"] = self._as_int(
            row.get("budget_total_rub", 0),
        )
        trip_request["constraints"]["mobility_constraints"] = self._split_values(
            row.get("mobility_constraints", ""),
        )
        trip_request["constraints"]["must_have"] = self._split_values(row.get("must_have", ""))
        trip_request["constraints"]["avoid"] = self._split_values(row.get("avoid", ""))
        trip_request["constraints"]["avoid_place_types"] = self._split_values(
            row.get("avoid_place_types", ""),
        )
        trip_request["constraints"]["kids_friendly_required"] = self._as_bool(
            row.get("kids_friendly_required", False),
        )
        trip_request["constraints"]["pet_friendly_required"] = self._as_bool(
            row.get("pet_friendly_required", False),
        )
        try:
            embedding_values = json.loads(str(row.get("query_embedding_json", "") or "[]"))
        except Exception:
            embedding_values = []
        if isinstance(embedding_values, list) and embedding_values:
            trip_request["query_embedding"] = embedding_values
        return self._enrich_trip_request(trip_request, None)

    # Добавление строки в user_02_detail.csv
    def _append_user_02_detail_row(self, row: dict[str, Any]) -> Path:
        path = self.session.get_dataset_path("user_02_detail")
        existing_rows = self.session.read_rows(path)
        existing_rows.append(row)
        self.session.write_rows(path, self.contract.user_02_detail_columns, existing_rows)
        return path

    # Построение lookup по ранжированным точкам
    @staticmethod
    def _build_ranked_lookup(ranked_candidates: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        return {
            candidate.get("place", {}).get("place_id", ""): candidate
            for candidate in ranked_candidates
            if candidate.get("place", {}).get("place_id", "")
        }

    # Определение primary-варианта
    @staticmethod
    def _pick_primary_variant(route_variants: list[dict[str, Any]]) -> dict[str, Any] | None:
        for variant in route_variants:
            if str(variant.get("variant_name", "") or "") == "balanced":
                return variant
        if route_variants:
            return route_variants[0]
        return None

    # Извлечение отеля из варианта маршрута
    @staticmethod
    def _pick_hotel_place(route_variant: dict[str, Any]) -> dict[str, Any] | None:
        for stop in route_variant.get("stops", []):
            place = stop.get("place", {})
            if place.get("category") == "stay":
                return place
        return None

    # Тип остановки для recsys-строки
    @staticmethod
    def _stop_type_for_place(place: dict[str, Any]) -> str:
        category = str(place.get("category", "") or "")
        if category == "stay":
            return "hotel"
        if category == "food":
            return "food"
        if category == "wine":
            return "wine"
        return "activity"

    # Расчёт дистанции от отеля
    def _distance_from_hotel(
        self,
        hotel_place: dict[str, Any] | None,
        place: dict[str, Any],
    ) -> float:
        if hotel_place is None or place.get("place_id") == hotel_place.get("place_id"):
            return 0.0
        distance_km = self.graph_builder._distance_km(hotel_place, place)
        if distance_km == float("inf"):
            return 0.0
        return round(float(distance_km), 3)

    # Конвертация route_variants в recsys CSV-строки
    def _route_variants_to_rows(
        self,
        profile_row: dict[str, Any],
        route_variants: list[dict[str, Any]],
        ranked_lookup: dict[str, dict[str, Any]],
    ) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        profile_payload = {
            key: profile_row.get(key, "")
            for key in self.contract.user_02_detail_columns
            if key != "user_id"
        }
        for variant in route_variants:
            hotel_place = self._pick_hotel_place(variant)
            for stop in variant.get("stops", []):
                place = stop.get("place", {})
                ranked = ranked_lookup.get(place.get("place_id", ""), {})
                flat = self.contract.flatten_place_source_fields(place)
                rows.append(
                    {
                        "user_id": profile_row.get("user_id", ""),
                        "day": stop.get("day", 1),
                        "count": stop.get("stop_order", 0),
                        "route_variant": variant.get("variant_rank", 1),
                        "variant_name": variant.get("variant_name", ""),
                        **profile_payload,
                        "stop_type": self._stop_type_for_place(place),
                        "place_id": place.get("place_id", ""),
                        "source_table": place.get("source_table", ""),
                        "category": place.get("category", ""),
                        "place_type": place.get("place_type", ""),
                        "name": place.get("name", ""),
                        "lat": place.get("lat"),
                        "lon": place.get("lon"),
                        "address": place.get("address", ""),
                        "area": place.get("area", ""),
                        "place_city": place.get("city", ""),
                        "description": place.get("description", ""),
                        "rating": place.get("rating", 0.0),
                        "distance_from_prev_km": stop.get("distance_from_prev_km", 0.0),
                        "distance_from_hotel_km": self._distance_from_hotel(hotel_place, place),
                        "travel_estimate_min": stop.get("travel_estimate_min", 0),
                        "start_time": stop.get("start_time", ""),
                        "end_time": stop.get("end_time", ""),
                        "duration_min": stop.get("duration_min", 0),
                        "score_total": ranked.get("score", stop.get("score", 0.0)),
                        "score_semantic": ranked.get("semantic_score", 0.0),
                        "score_preference": ranked.get("preference_score", 0.0),
                        "score_logistics": ranked.get("logistics_score", 0.0),
                        "score_family": ranked.get("family_score", 0.0),
                        "score_trust": ranked.get("trust_score", 0.0),
                        "score_diversity": ranked.get("diversity_score", 0.0),
                        "why_selected": stop.get(
                            "why_selected",
                            ranked.get("why_selected", ""),
                        ),
                        **flat,
                    }
                )
        return rows

    # Запись backend-CSV по внутренним route-строкам
    def _write_backend_output(
        self,
        dataset_name: str,
        route_rows: list[dict[str, Any]],
    ) -> tuple[Path, list[dict[str, Any]]]:
        output_path = self.session.get_dataset_path(dataset_name)
        backend_rows = self.backend_exporter.write_rows(output_path, route_rows)
        return output_path, backend_rows

    # Поиск и построение вариантов маршрута
    def _search_and_route(
        self,
        trip_request: dict[str, Any],
    ) -> dict[str, Any]:
        search_payload = self.search_service.search(trip_request)
        route_variants = self.optimizer.build_route_variants(
            trip_request=trip_request,
            ranked_groups=search_payload.get("grouped_candidates", {}),
        )
        return {
            "search_payload": search_payload,
            "route_variants": route_variants,
            "ranked_lookup": self._build_ranked_lookup(
                search_payload.get("ranked_candidates", []),
            ),
        }

    # Подготовка base trip_request
    def _build_base_trip_request(self, user_row: dict[str, Any]) -> dict[str, Any]:
        trip_request = self.parser.build_prior_from_user_base_row(user_row)
        if trip_request is None:
            raise ValueError("Не удалось собрать base trip_request.")
        if not trip_request.get("session_id"):
            trip_request["session_id"] = f"base_{user_row.get('id', '')}"
        return self._enrich_trip_request(trip_request, user_row)

    # Подготовка detail trip_request
    def _build_detail_trip_request(
        self,
        user_id: str,
        refinement_text: str,
        session_id: str,
        client_context: dict[str, Any] | None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        user_row = self.repository.find_user_01_base_row(user_id) or self.repository.find_user_base_row(
            user_id,
        )
        if user_row is None:
            msg = f"user_01_base: не найден пользователь id={user_id}"
            raise ValueError(msg)
        prior_trip_request = self._build_base_trip_request(user_row)
        trip_request = self.parser.parse_refinement(
            refinement_text=refinement_text,
            prior_trip_request=prior_trip_request,
            session_id=session_id or f"detail_{user_id}",
            client_context=client_context or {},
        )
        trip_request = self._enrich_trip_request(trip_request, user_row)
        return trip_request, user_row

    # Сборка базового маршрута
    def build_base_for_user(self, user_id: str) -> dict[str, Any]:
        user_row = self.repository.find_user_01_base_row(user_id) or self.repository.find_user_base_row(
            user_id,
        )
        if user_row is None:
            msg = f"user_01_base: не найден пользователь id={user_id}"
            raise ValueError(msg)

        trip_request = self._attach_query_embedding(self._build_base_trip_request(user_row))
        profile_row = self._build_user_02_detail_row(
            trip_request=trip_request,
            user_id=user_id,
            profile_stage="base",
            refinement_raw_text="",
            user_row=user_row,
        )
        route_payload = self._search_and_route(trip_request)
        primary_variant = self._pick_primary_variant(route_payload["route_variants"])
        selected_variants = [primary_variant] if primary_variant is not None else []
        route_rows = self._route_variants_to_rows(
            profile_row=profile_row,
            route_variants=selected_variants,
            ranked_lookup=route_payload["ranked_lookup"],
        )
        output_path, backend_rows = self._write_backend_output("recsys_01_base", route_rows)
        return {
            "user_id": user_id,
            "profile_row": profile_row,
            "trip_request": trip_request,
            "route_variants": route_payload["route_variants"],
            "selected_variants": selected_variants,
            "rows": backend_rows,
            "route_rows": route_rows,
            "output_path": str(output_path),
        }

    # Сборка base-маршрутов для всех пользователей
    def build_base_for_all(self) -> dict[str, Any]:
        user_rows = self.repository.read_user_01_base_rows() or self.repository.read_user_base_rows()
        all_rows: list[dict[str, Any]] = []
        results: list[dict[str, Any]] = []
        for user_row in user_rows:
            user_id = str(user_row.get("id", "") or "").strip()
            if not user_id:
                continue
            result = self.build_base_for_user(user_id)
            results.append(result)
            all_rows.extend(result["rows"])
        output_path = self.session.get_dataset_path("recsys_01_base")
        self.session.write_rows(output_path, self.contract.backend_route_columns, all_rows)
        return {
            "results": results,
            "rows": all_rows,
            "output_path": str(output_path),
        }

    # Общая detail-сборка из transcript_result
    def _build_detail_from_transcript(
        self,
        user_id: str,
        transcript_result: dict[str, Any],
        session_id: str = "",
        client_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        refinement_text = str(transcript_result.get("transcript", "") or "").strip()
        if not refinement_text:
            raise ValueError("Пустой текст уточнения.")

        trip_request, user_row = self._build_detail_trip_request(
            user_id=user_id,
            refinement_text=refinement_text,
            session_id=session_id,
            client_context=client_context,
        )
        trip_request = self._attach_query_embedding(trip_request)
        profile_row = self._build_user_02_detail_row(
            trip_request=trip_request,
            user_id=user_id,
            profile_stage="detail",
            refinement_raw_text=refinement_text,
            user_row=user_row,
        )
        detail_profile_path = self._append_user_02_detail_row(profile_row)
        route_payload = self._search_and_route(trip_request)
        primary_variant = self._pick_primary_variant(route_payload["route_variants"])
        selected_variants = [primary_variant] if primary_variant is not None else []
        route_rows = self._route_variants_to_rows(
            profile_row=profile_row,
            route_variants=selected_variants,
            ranked_lookup=route_payload["ranked_lookup"],
        )
        output_path, backend_rows = self._write_backend_output("recsys_02_detail", route_rows)
        return {
            "user_id": user_id,
            "transcript_result": transcript_result,
            "profile_row": profile_row,
            "trip_request": trip_request,
            "route_variants": route_payload["route_variants"],
            "selected_variants": selected_variants,
            "rows": backend_rows,
            "route_rows": route_rows,
            "user_02_detail_path": str(detail_profile_path),
            "output_path": str(output_path),
        }

    # Сборка detail-маршрута из текста
    def build_detail_from_text(
        self,
        user_id: str,
        text: str,
        session_id: str = "",
        client_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        transcript_result = self.transcription_service.transcribe_input(
            input_type="text",
            text=text,
        )
        return self._build_detail_from_transcript(
            user_id=user_id,
            transcript_result=transcript_result,
            session_id=session_id,
            client_context=client_context,
        )

    # Сборка detail-маршрута из аудиофайла
    def build_detail_from_audio(
        self,
        user_id: str,
        audio_path: str | Path,
        session_id: str = "",
        client_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        transcript_result = self.transcription_service.transcribe_input(
            input_type="audio",
            audio_path=audio_path,
        )
        return self._build_detail_from_transcript(
            user_id=user_id,
            transcript_result=transcript_result,
            session_id=session_id,
            client_context=client_context,
        )

    # Сборка detail-маршрута с микрофона
    def build_detail_from_microphone(
        self,
        user_id: str,
        session_id: str = "",
        client_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        transcript_result = self.transcription_service.transcribe_microphone()
        return self._build_detail_from_transcript(
            user_id=user_id,
            transcript_result=transcript_result,
            session_id=session_id,
            client_context=client_context,
        )

    # Сборка альтернативных маршрутов из user_02_detail.csv
    def build_alternatives_from_user_detail(self, user_id: str) -> dict[str, Any]:
        detail_row = self.repository.find_latest_user_02_detail_row(user_id)
        if detail_row is None:
            msg = f"user_02_detail: не найдена строка user_id={user_id}"
            raise ValueError(msg)

        trip_request = self._build_trip_request_from_detail_row(detail_row)
        trip_request = self._attach_query_embedding(trip_request)
        profile_row = {
            key: detail_row.get(key, "")
            for key in self.contract.user_02_detail_columns
        }
        profile_row["query_text"] = trip_request.get("query_text", "")
        profile_row["semantic_profile_text"] = trip_request.get("semantic_profile_text", "")
        profile_row["embedding_model"] = self.embedding_cfg.model_name
        profile_row["embedding_dim"] = len(trip_request.get("query_embedding", []))
        profile_row["embedding_key"] = hashlib.sha1(
            (
                self.embedding_cfg.model_name
                + str(trip_request.get("query_text", ""))
                + str(trip_request.get("semantic_profile_text", ""))
            ).encode("utf-8")
        ).hexdigest()
        profile_row["query_embedding_json"] = json.dumps(
            trip_request.get("query_embedding", []),
            ensure_ascii=False,
        )
        route_payload = self._search_and_route(trip_request)
        primary_variant = self._pick_primary_variant(route_payload["route_variants"])
        primary_name = str(primary_variant.get("variant_name", "") or "") if primary_variant else ""
        alternative_variants = [
            variant
            for variant in route_payload["route_variants"]
            if str(variant.get("variant_name", "") or "") != primary_name
        ]
        selected_variants = alternative_variants[:1]
        route_rows = self._route_variants_to_rows(
            profile_row=profile_row,
            route_variants=selected_variants,
            ranked_lookup=route_payload["ranked_lookup"],
        )
        output_path, backend_rows = self._write_backend_output("recsys_02_detail", route_rows)
        return {
            "user_id": user_id,
            "profile_row": profile_row,
            "trip_request": trip_request,
            "route_variants": route_payload["route_variants"],
            "alternative_variants": alternative_variants,
            "selected_variants": selected_variants,
            "rows": backend_rows,
            "route_rows": route_rows,
            "output_path": str(output_path),
        }


from app.services.recsys import RecsysService

# Запуск
if __name__ == "__main__":
    service = RecsysService()
    result = service.build_base_for_user("001")
    print(result["output_path"])
