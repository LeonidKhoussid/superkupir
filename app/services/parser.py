from __future__ import annotations

import copy
import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import ExtractionConfig, PathConfig, RecommenderConfig, RoutingConfig
from app.db_connector.models import CsvDataContract


class TripRequestParser:
    """ПАРСИНГ TRIP REQUEST"""

    # Инициализация парсера
    def __init__(self) -> None:
        self.contract = CsvDataContract()
        self.extract_cfg = ExtractionConfig()
        self.paths = PathConfig()
        self.routing_cfg = RoutingConfig()
        self.paths.ensure_directories()
        self._llm = None

    # Нормализация текста
    @staticmethod
    def _normalize_text(text: str) -> str:
        return " ".join(str(text).replace("\n", " ").split()).strip()

    # Регистрация найденного слота
    def _register_slot(
        self,
        parsed_slots: dict[str, Any],
        slot_name: str,
        value: Any,
        confidence: float,
        source: str,
    ) -> None:
        if value in ("", None, [], {}):
            return
        parsed_slots[slot_name] = self.contract.create_slot(
            value=value,
            confidence=confidence,
            source=source,
        )

    # Получение локальной LLM-модели
    def _get_llm(self):
        if self._llm is not None:
            return self._llm

        model_path = self.paths.extraction_llm_dir / self.extract_cfg.model_filename
        if not model_path.exists():
            return None

        try:
            from llama_cpp import Llama
        except Exception:
            return None

        self._llm = Llama(
            model_path=str(model_path),
            chat_format=self.extract_cfg.chat_format,
            n_ctx=self.extract_cfg.n_ctx,
            n_gpu_layers=self.extract_cfg.n_gpu_layers,
            verbose=False,
        )
        return self._llm

    # Формирование JSON-schema для extraction
    @staticmethod
    def _build_llm_schema() -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "city_to": {"type": "string"},
                "area_to": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "duration_days": {"type": "integer"},
                "nights_count": {"type": "integer"},
                "adults_count": {"type": "integer"},
                "children_count": {"type": "integer"},
                "child_ages": {
                    "type": "array",
                    "items": {"type": "integer"},
                },
                "stay_needed": {"type": "boolean"},
                "stay_type": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "hotel_stars_min": {"type": "integer"},
                "rooms_count": {"type": "integer"},
                "budget_level": {"type": "string"},
                "budget_total_rub": {"type": "integer"},
                "themes": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "food_preferences": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "pace": {"type": "string"},
                "crowd_tolerance": {"type": "string"},
                "trip_style": {"type": "string"},
                "arrival_mode": {"type": "string"},
                "transport_mode": {"type": "string"},
                "with_car": {"type": "boolean"},
                "max_transfer_minutes": {"type": "integer"},
                "mobility_constraints": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "avoid": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "must_have": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "favorite_cuisines": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "dietary_restrictions": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "family_notes": {"type": "string"},
                "date_start": {"type": "string"},
                "date_end": {"type": "string"},
                "group_type": {"type": "string"},
                "kids_friendly_required": {"type": "boolean"},
                "pet_friendly_required": {"type": "boolean"},
                "room_capacity_needed": {"type": "integer"},
                "city_from": {"type": "string"},
            },
        }

    # Извлечение слотов через локальную LLM
    def _extract_with_llm(self, text: str) -> dict[str, Any]:
        if not self.extract_cfg.enabled:
            return {}

        llm = self._get_llm()
        if llm is None:
            return {}

        response = llm.create_chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Ты извлекаешь только структурированные слоты поездки из "
                        "русского туристического запроса. Возвращай только JSON."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        "Извлеки travel slots из текста. "
                        f"Текст: {text}"
                    ),
                },
            ],
            response_format={
                "type": "json_object",
                "schema": self._build_llm_schema(),
            },
            temperature=self.extract_cfg.temperature,
            max_tokens=self.extract_cfg.max_tokens,
        )
        content = response["choices"][0]["message"]["content"]
        if not content:
            return {}

        try:
            return json.loads(content)
        except Exception:
            return {}

    # Извлечение города и зоны
    def _extract_destination(
        self,
        text: str,
        trip_request: dict[str, Any],
        parsed_slots: dict[str, Any],
    ) -> None:
        city_candidates = [
            "Абрау-Дюрсо",
            "Новороссийск",
            "Геленджик",
            "Анапа",
            "Мысхако",
            "Дюрсо",
            "Федотовка",
        ]
        area_candidates = [
            "центр",
            "пригород",
            "город",
            "побережье",
            "горы",
            "у моря",
            "винный кластер",
            "винный_кластер",
        ]

        for city in city_candidates:
            if city.lower() in text.lower():
                trip_request["client_context"]["destination_city"] = city
                self._register_slot(parsed_slots, "city_to", city, 0.95, "rule")
                break

        preferred_zone: list[str] = []
        lowered_text = text.lower()
        for area in area_candidates:
            if area in lowered_text:
                preferred_zone.append(area.replace(" ", "_"))

        if preferred_zone:
            trip_request["stay"]["preferred_zone"] = sorted(set(preferred_zone))
            self._register_slot(
                parsed_slots,
                "area_to",
                trip_request["stay"]["preferred_zone"],
                0.85,
                "rule",
            )

    # Извлечение дат и длительности
    def _extract_dates(
        self,
        text: str,
        trip_request: dict[str, Any],
        parsed_slots: dict[str, Any],
    ) -> None:
        normalized = text.lower()
        duration_match = re.search(r"на\s+(\d+)\s*(дн|дня|дней|сут)", normalized)
        if duration_match:
            duration_days = int(duration_match.group(1))
            trip_request["dates"]["duration_days"] = duration_days
            trip_request["dates"]["nights_count"] = max(duration_days - 1, 0)
            self._register_slot(parsed_slots, "duration_days", duration_days, 0.97, "rule")
            self._register_slot(
                parsed_slots,
                "nights_count",
                trip_request["dates"]["nights_count"],
                0.95,
                "rule",
            )
            return

        if "на выходные" in normalized:
            trip_request["dates"]["duration_days"] = 2
            trip_request["dates"]["nights_count"] = 1
            self._register_slot(parsed_slots, "duration_days", 2, 0.9, "rule")
            self._register_slot(parsed_slots, "nights_count", 1, 0.9, "rule")

        date_matches = re.findall(r"(\d{2}\.\d{2}(?:\.\d{4})?)", text)
        if len(date_matches) >= 2:
            try:
                start_date = datetime.strptime(
                    self._ensure_year(date_matches[0]),
                    "%d.%m.%Y",
                )
                end_date = datetime.strptime(
                    self._ensure_year(date_matches[1]),
                    "%d.%m.%Y",
                )
                duration_days = max((end_date - start_date).days, 1)
                trip_request["dates"]["start_date"] = start_date.strftime("%Y-%m-%d")
                trip_request["dates"]["end_date"] = end_date.strftime("%Y-%m-%d")
                trip_request["dates"]["duration_days"] = duration_days
                trip_request["dates"]["nights_count"] = max(duration_days - 1, 0)
                self._register_slot(
                    parsed_slots,
                    "date_start",
                    trip_request["dates"]["start_date"],
                    0.93,
                    "rule",
                )
                self._register_slot(
                    parsed_slots,
                    "date_end",
                    trip_request["dates"]["end_date"],
                    0.93,
                    "rule",
                )
            except Exception:
                return

    # Добавление года в дату dd.mm
    @staticmethod
    def _ensure_year(date_text: str) -> str:
        if len(date_text.split(".")) == 3:
            return date_text
        return f"{date_text}.{datetime.now().year}"

    # Извлечение состава группы
    def _extract_party(
        self,
        text: str,
        trip_request: dict[str, Any],
        parsed_slots: dict[str, Any],
    ) -> None:
        normalized = text.lower()
        group_type = self.routing_cfg.default_group_type
        adults_count = 2
        children_count = 0
        child_ages: list[int] = []

        if "семь" in normalized or "с ребен" in normalized or "с детьми" in normalized:
            group_type = "семья"
        elif "друз" in normalized:
            group_type = "друзья"
        elif "делов" in normalized:
            group_type = "деловая_поездка"
        elif "один" in normalized or "одна" in normalized:
            group_type = "один"
            adults_count = 1
        elif "вдво" in normalized or "пар" in normalized:
            group_type = "пара"
            adults_count = 2

        adults_match = re.search(r"(\d+)\s*взрос", normalized)
        if adults_match:
            adults_count = int(adults_match.group(1))

        children_match = re.search(r"(\d+)\s*дет", normalized)
        if children_match:
            children_count = int(children_match.group(1))
        elif "с ребенком" in normalized:
            children_count = 1
        elif "с детьми" in normalized:
            children_count = 1

        for age in re.findall(r"(\d+)\s*лет", normalized):
            parsed_age = int(age)
            if parsed_age <= 17:
                child_ages.append(parsed_age)

        if group_type == "семья" and adults_match is None and adults_count == 2:
            adults_count = 2

        trip_request["party"]["group_type"] = group_type
        trip_request["party"]["adults"] = adults_count
        trip_request["party"]["children"] = children_count
        trip_request["party"]["child_ages"] = child_ages
        trip_request["stay"]["room_capacity_needed"] = max(adults_count + children_count, 1)

        self._register_slot(parsed_slots, "group_type", group_type, 0.85, "rule")
        self._register_slot(parsed_slots, "adults_count", adults_count, 0.92, "rule")
        self._register_slot(parsed_slots, "children_count", children_count, 0.9, "rule")
        self._register_slot(parsed_slots, "child_ages", child_ages, 0.85, "rule")

    # Извлечение транспорта
    def _extract_transport(
        self,
        text: str,
        trip_request: dict[str, Any],
        parsed_slots: dict[str, Any],
    ) -> None:
        normalized = text.lower()
        arrival_mode = ""
        transport_mode = ""
        has_car = False

        if any(token in normalized for token in ("машин", "авто", "на своем")):
            arrival_mode = "car"
            transport_mode = "car"
            has_car = True
        elif "поезд" in normalized:
            arrival_mode = "train"
            transport_mode = "train"
        elif "самолет" in normalized:
            arrival_mode = "plane"
            transport_mode = "plane"
        elif "автобус" in normalized:
            arrival_mode = "bus"
            transport_mode = "bus"

        transfer_match = re.search(
            r"(\d+)\s*(минут|мин|час|часа|часов).{0,20}(переезд|дорог|трансфер)",
            normalized,
        )
        max_transfer_minutes = 0
        if transfer_match:
            max_transfer_minutes = int(transfer_match.group(1))
            if "час" in transfer_match.group(2):
                max_transfer_minutes *= 60
        elif "без длинных переездов" in normalized or "без долгих переездов" in normalized:
            max_transfer_minutes = 90

        trip_request["transport"]["arrival_mode"] = arrival_mode
        trip_request["transport"]["transport_mode"] = transport_mode
        trip_request["transport"]["has_car"] = has_car
        trip_request["transport"]["max_transfer_minutes"] = max_transfer_minutes

        self._register_slot(parsed_slots, "arrival_mode", arrival_mode, 0.9, "rule")
        self._register_slot(parsed_slots, "transport_mode", transport_mode, 0.9, "rule")
        self._register_slot(parsed_slots, "with_car", has_car, 0.95, "rule")
        self._register_slot(
            parsed_slots,
            "max_transfer_minutes",
            max_transfer_minutes,
            0.85,
            "rule",
        )

    # Извлечение проживания
    def _extract_stay(
        self,
        text: str,
        trip_request: dict[str, Any],
        parsed_slots: dict[str, Any],
    ) -> None:
        normalized = text.lower()
        stay_type: list[str] = []
        stay_needed = trip_request["dates"]["duration_days"] > 1

        stay_map = {
            "отель": "отель",
            "гостевой дом": "гостевой_дом",
            "гостиниц": "гостиница",
            "апартамент": "апартаменты",
            "апарт": "апартаменты",
            "бутик": "бутик-отель",
        }
        for source_text, normalized_value in stay_map.items():
            if source_text in normalized:
                stay_type.append(normalized_value)
                stay_needed = True

        if any(token in normalized for token in ("ночев", "ночь", "переноч")):
            stay_needed = True

        rooms_match = re.search(r"(\d+)\s*(номер|номера|номеров|комнат)", normalized)
        if rooms_match:
            trip_request["stay"]["rooms_count"] = int(rooms_match.group(1))
        elif trip_request["party"]["group_type"] == "семья":
            trip_request["stay"]["rooms_count"] = 1

        stars_match = re.search(r"(\d)\s*\*|\b(\d)\s*зв", normalized)
        if stars_match:
            stars_value = stars_match.group(1) or stars_match.group(2)
            trip_request["stay"]["hotel_stars_min"] = int(stars_value)

        trip_request["stay"]["stay_needed"] = stay_needed
        trip_request["stay"]["accommodation_type"] = sorted(set(stay_type))

        self._register_slot(parsed_slots, "stay_needed", stay_needed, 0.85, "rule")
        self._register_slot(parsed_slots, "stay_type", stay_type, 0.85, "rule")
        self._register_slot(
            parsed_slots,
            "rooms_count",
            trip_request["stay"]["rooms_count"],
            0.8,
            "rule",
        )
        self._register_slot(
            parsed_slots,
            "hotel_stars_min",
            trip_request["stay"]["hotel_stars_min"],
            0.8,
            "rule",
        )

    # Извлечение бюджета
    def _extract_budget(
        self,
        text: str,
        trip_request: dict[str, Any],
        parsed_slots: dict[str, Any],
    ) -> None:
        normalized = text.lower()
        budget_level = self.routing_cfg.default_budget_level
        if any(token in normalized for token in ("дешев", "бюджет", "эконом")):
            budget_level = "низкий"
        elif any(token in normalized for token in ("премиум", "люкс", "дорог")):
            budget_level = "высокий"

        budget_total_rub = 0
        budget_match = re.search(r"(\d+)\s*(тыс|руб)", normalized)
        if budget_match:
            budget_total_rub = int(budget_match.group(1))
            if budget_match.group(2) == "тыс":
                budget_total_rub *= 1000

        trip_request["constraints"]["budget_level"] = budget_level
        trip_request["constraints"]["budget_total_rub"] = budget_total_rub

        self._register_slot(parsed_slots, "budget_level", budget_level, 0.85, "rule")
        self._register_slot(parsed_slots, "budget_total_rub", budget_total_rub, 0.8, "rule")

    # Извлечение предпочтений
    def _extract_preferences(
        self,
        text: str,
        trip_request: dict[str, Any],
        parsed_slots: dict[str, Any],
    ) -> None:
        normalized = text.lower()
        themes: set[str] = set()
        food_preferences: set[str] = set()

        theme_map = {
            "wine": ("вино", "вин", "винодель", "дегустац", "энотур"),
            "food": ("еда", "гастро", "ресторан", "вкусно", "кухн"),
            "nature": ("природ", "вид", "озер", "море", "горы", "набереж"),
            "family": ("семь", "ребен", "дет"),
            "quiet": ("тихо", "без толп", "не людно", "спокойно"),
            "premium": ("премиум", "люкс", "дорого"),
            "authentic": ("аутент", "локальн", "местн"),
            "festivals": ("фестивал", "событ"),
            "pet-friendly": ("с собак", "с питомц", "с животн"),
        }
        for theme_name, keywords in theme_map.items():
            if any(keyword in normalized for keyword in keywords):
                themes.add(theme_name)

        food_map = {
            "local": ("локальн", "местн"),
            "fish_and_seafood": ("рыба", "морепродукт"),
            "kids_menu": ("детское меню", "для детей"),
            "wine_pairing": ("вино", "вин", "винная карта"),
        }
        for preference_name, keywords in food_map.items():
            if any(keyword in normalized for keyword in keywords):
                food_preferences.add(preference_name)

        pace = self.routing_cfg.default_pace
        if any(token in normalized for token in ("спокойн", "нетороп", "релакс")):
            pace = "спокойный"
        elif any(token in normalized for token in ("насыщ", "плотн", "много")):
            pace = "насыщенный"

        crowd_tolerance = "нейтрально"
        if any(token in normalized for token in ("без толп", "тихо", "не людно")):
            crowd_tolerance = "хочу_тихо"
        elif any(token in normalized for token in ("оживлен", "активно", "движуха")):
            crowd_tolerance = "люблю_оживленные_места"

        trip_style = self.routing_cfg.default_trip_style
        if any(token in normalized for token in ("из одного отеля", "одна база", "без смены отеля")):
            trip_style = "радиальные_выезды_из_одного_отеля"
        elif any(token in normalized for token in ("цепочка", "по кругу", "маршрут с переездами")):
            trip_style = "цепочка_локаций"
        elif "одноднев" in normalized:
            trip_style = "однодневные_маршруты"

        trip_request["preferences"]["themes"] = sorted(themes)
        trip_request["preferences"]["food_preferences"] = sorted(food_preferences)
        trip_request["preferences"]["pace"] = pace
        trip_request["preferences"]["crowd_tolerance"] = crowd_tolerance
        trip_request["preferences"]["trip_style"] = trip_style

        self._register_slot(parsed_slots, "themes", sorted(themes), 0.82, "rule")
        self._register_slot(
            parsed_slots,
            "food_preferences",
            sorted(food_preferences),
            0.82,
            "rule",
        )
        self._register_slot(parsed_slots, "pace", pace, 0.85, "rule")
        self._register_slot(parsed_slots, "crowd_tolerance", crowd_tolerance, 0.8, "rule")
        self._register_slot(parsed_slots, "trip_style", trip_style, 0.8, "rule")

    # Извлечение ограничений
    def _extract_constraints(
        self,
        text: str,
        trip_request: dict[str, Any],
        parsed_slots: dict[str, Any],
    ) -> None:
        normalized = text.lower()
        mobility_constraints: list[str] = []
        avoid: list[str] = []
        must_have: list[str] = []

        if "без лестниц" in normalized:
            mobility_constraints.append("без_лестниц")
        if "минимум ходьбы" in normalized:
            mobility_constraints.append("минимум_ходьбы")
        if "легкий доступ" in normalized:
            mobility_constraints.append("легкий_доступ")

        if "без длинных переездов" in normalized or "без долгих переездов" in normalized:
            avoid.append("длинные_переезды")
        if "без толп" in normalized or "не людно" in normalized:
            avoid.append("шумные_места")
        if "недорого" in normalized or "дешево" in normalized:
            avoid.append("дорого")

        explicit_family_request = any(
            token in normalized
            for token in (
                "семейный отель",
                "семейное место",
                "family friendly",
            )
        )
        explicit_kids_request = any(
            token in normalized
            for token in (
                "для детей",
                "детское меню",
                "детская зона",
                "kids friendly",
            )
        )

        if "парков" in normalized:
            must_have.append("parking")
        if explicit_family_request:
            must_have.append("family_friendly")
        if explicit_kids_request:
            trip_request["constraints"]["kids_friendly_required"] = True
        if "с питомц" in normalized or "с собак" in normalized:
            must_have.append("pet_friendly")
            trip_request["constraints"]["pet_friendly_required"] = True

        trip_request["constraints"]["mobility_constraints"] = sorted(set(mobility_constraints))
        trip_request["constraints"]["must_have"] = sorted(set(must_have))
        trip_request["constraints"]["avoid"] = sorted(set(avoid))

        self._register_slot(
            parsed_slots,
            "mobility_constraints",
            trip_request["constraints"]["mobility_constraints"],
            0.82,
            "rule",
        )
        self._register_slot(
            parsed_slots,
            "avoid",
            trip_request["constraints"]["avoid"],
            0.84,
            "rule",
        )
        self._register_slot(
            parsed_slots,
            "must_have",
            trip_request["constraints"]["must_have"],
            0.84,
            "rule",
        )

    # Применение значений от LLM
    def _merge_llm_extraction(
        self,
        llm_payload: dict[str, Any],
        trip_request: dict[str, Any],
        parsed_slots: dict[str, Any],
    ) -> None:
        if not llm_payload:
            return

        llm_confidence = 0.72
        slot_map = {
            "city_to": ("client_context", "destination_city"),
            "duration_days": ("dates", "duration_days"),
            "nights_count": ("dates", "nights_count"),
            "adults_count": ("party", "adults"),
            "children_count": ("party", "children"),
            "child_ages": ("party", "child_ages"),
            "stay_needed": ("stay", "stay_needed"),
            "hotel_stars_min": ("stay", "hotel_stars_min"),
            "rooms_count": ("stay", "rooms_count"),
            "budget_level": ("constraints", "budget_level"),
            "budget_total_rub": ("constraints", "budget_total_rub"),
            "themes": ("preferences", "themes"),
            "food_preferences": ("preferences", "food_preferences"),
            "pace": ("preferences", "pace"),
            "crowd_tolerance": ("preferences", "crowd_tolerance"),
            "trip_style": ("preferences", "trip_style"),
            "arrival_mode": ("transport", "arrival_mode"),
            "transport_mode": ("transport", "transport_mode"),
            "with_car": ("transport", "has_car"),
            "max_transfer_minutes": ("transport", "max_transfer_minutes"),
            "mobility_constraints": ("constraints", "mobility_constraints"),
            "avoid": ("constraints", "avoid"),
            "must_have": ("constraints", "must_have"),
        }

        for slot_name, value in llm_payload.items():
            if value in ("", None, [], {}):
                continue

            if slot_name == "area_to":
                current_value = trip_request["stay"]["preferred_zone"]
                if not current_value:
                    trip_request["stay"]["preferred_zone"] = list(value)
                    self._register_slot(parsed_slots, slot_name, value, llm_confidence, "llm")
                continue

            if slot_name == "stay_type":
                current_value = trip_request["stay"]["accommodation_type"]
                if not current_value:
                    trip_request["stay"]["accommodation_type"] = list(value)
                    self._register_slot(parsed_slots, slot_name, value, llm_confidence, "llm")
                continue

            target = slot_map.get(slot_name)
            if target is None:
                continue

            section_name, field_name = target
            current_value = trip_request[section_name].get(field_name)
            if current_value in ("", None, [], {}, 0, False):
                trip_request[section_name][field_name] = value
                self._register_slot(parsed_slots, slot_name, value, llm_confidence, "llm")

    # Применение дефолтов
    def _apply_defaults(
        self,
        trip_request: dict[str, Any],
        client_context: dict[str, Any],
    ) -> None:
        if not trip_request["session_id"]:
            trip_request["session_id"] = str(uuid4())

        if not trip_request["request_id"]:
            trip_request["request_id"] = f"req_{uuid4().hex[:12]}"

        if "start_city" not in trip_request["client_context"]:
            trip_request["client_context"]["start_city"] = client_context.get("start_city", "")

        if not trip_request["client_context"].get("destination_city"):
            trip_request["client_context"]["destination_city"] = self.routing_cfg.default_city_to

        if not trip_request["dates"]["duration_days"]:
            trip_request["dates"]["duration_days"] = self.routing_cfg.default_days_count
            trip_request["dates"]["nights_count"] = max(
                self.routing_cfg.default_days_count - 1,
                0,
            )

        if not trip_request["preferences"]["pace"]:
            trip_request["preferences"]["pace"] = self.routing_cfg.default_pace

        if not trip_request["preferences"]["trip_style"]:
            trip_request["preferences"]["trip_style"] = self.routing_cfg.default_trip_style

        if not trip_request["constraints"]["budget_level"]:
            trip_request["constraints"]["budget_level"] = self.routing_cfg.default_budget_level

        if not trip_request["party"]["group_type"]:
            trip_request["party"]["group_type"] = self.routing_cfg.default_group_type

        if not trip_request["stay"]["rooms_count"]:
            trip_request["stay"]["rooms_count"] = 1

    # Упоминание состава группы в уточнении
    @staticmethod
    def _refinement_mentions_party(text: str) -> bool:
        normalized = text.lower()
        keys = (
            "семь",
            "семей",
            "ребен",
            "ребён",
            "с дет",
            "для дет",
            "детей",
            "детьми",
            "взрос",
            "вдвоём",
            "вдвоем",
            "парой",
            "один ",
            "одна ",
            "одни ",
            "друз",
            "делов",
            "компан",
        )
        return any(key in normalized for key in keys)

    # Упоминание длительности в уточнении
    @staticmethod
    def _refinement_mentions_duration(text: str) -> bool:
        normalized = text.lower()
        if re.search(r"на\s+\d+\s*(дн|дня|дней|сут)", normalized):
            return True
        if "на выходные" in normalized:
            return True
        if re.search(r"\d{2}\.\d{2}", normalized):
            return True
        return False

    # Упоминание проживания в уточнении
    @staticmethod
    def _refinement_mentions_stay(text: str) -> bool:
        normalized = text.lower()
        keys = (
            "отель",
            "гостиниц",
            "апарт",
            "ночев",
            "номер",
            "звезд",
            "звёзд",
        )
        return any(key in normalized for key in keys)

    # Упоминание бюджета в уточнении
    @staticmethod
    def _refinement_mentions_budget(text: str) -> bool:
        normalized = text.lower()
        if re.search(r"\d+\s*(тыс|руб)", normalized):
            return True
        keys = ("бюджет", "дешев", "эконом", "премиум", "люкс", "дорог")
        return any(key in normalized for key in keys)

    # Упоминание транспорта в уточнении
    @staticmethod
    def _refinement_mentions_transport(text: str) -> bool:
        normalized = text.lower()
        keys = (
            "машин",
            "авто",
            "поезд",
            "самолет",
            "автобус",
            "переезд",
            "трансфер",
            "без длинных переездов",
        )
        return any(key in normalized for key in keys)

    # Слияние LLM при уточнении (объединение списков)
    def _merge_llm_refinement(
        self,
        llm_payload: dict[str, Any],
        trip_request: dict[str, Any],
        parsed_slots: dict[str, Any],
    ) -> None:
        if not llm_payload:
            return

        llm_confidence = 0.72
        trip_request.setdefault("refinement_extras", {})

        if themes := llm_payload.get("themes"):
            trip_request["preferences"]["themes"] = sorted(
                set(trip_request["preferences"]["themes"]) | set(themes),
            )
            self._register_slot(parsed_slots, "themes", themes, llm_confidence, "llm-refine")

        if food_llm := llm_payload.get("food_preferences"):
            trip_request["preferences"]["food_preferences"] = sorted(
                set(trip_request["preferences"]["food_preferences"]) | set(food_llm),
            )
            self._register_slot(
                parsed_slots,
                "food_preferences",
                food_llm,
                llm_confidence,
                "llm-refine",
            )

        if cuisines := llm_payload.get("favorite_cuisines"):
            trip_request["preferences"]["food_preferences"] = sorted(
                set(trip_request["preferences"]["food_preferences"]) | set(cuisines),
            )
            trip_request["refinement_extras"]["favorite_cuisines"] = list(cuisines)

        if dietary := llm_payload.get("dietary_restrictions"):
            trip_request["preferences"]["food_preferences"] = sorted(
                set(trip_request["preferences"]["food_preferences"]) | set(dietary),
            )
            trip_request["refinement_extras"]["dietary_restrictions"] = list(dietary)

        if family_notes := llm_payload.get("family_notes"):
            if str(family_notes).strip():
                trip_request["refinement_extras"]["family_notes"] = str(family_notes).strip()

        for slot_name, section, field in (
            ("avoid", "constraints", "avoid"),
            ("must_have", "constraints", "must_have"),
            ("mobility_constraints", "constraints", "mobility_constraints"),
        ):
            if vals := llm_payload.get(slot_name):
                current = list(trip_request[section][field])
                trip_request[section][field] = sorted(set(current) | set(vals))

        scalar_map = {
            "pace": ("preferences", "pace"),
            "crowd_tolerance": ("preferences", "crowd_tolerance"),
            "trip_style": ("preferences", "trip_style"),
            "budget_level": ("constraints", "budget_level"),
            "city_to": ("client_context", "destination_city"),
            "arrival_mode": ("transport", "arrival_mode"),
            "transport_mode": ("transport", "transport_mode"),
            "max_transfer_minutes": ("transport", "max_transfer_minutes"),
        }
        for slot_name, (section, field) in scalar_map.items():
            value = llm_payload.get(slot_name)
            if value in ("", None, [], {}):
                continue
            trip_request[section][field] = value
            self._register_slot(parsed_slots, slot_name, value, llm_confidence, "llm-refine")

        if "with_car" in llm_payload and llm_payload["with_car"] is not None:
            trip_request["transport"]["has_car"] = bool(llm_payload["with_car"])

        if "budget_total_rub" in llm_payload and llm_payload["budget_total_rub"]:
            trip_request["constraints"]["budget_total_rub"] = int(llm_payload["budget_total_rub"])

        if "duration_days" in llm_payload and llm_payload["duration_days"]:
            days = int(llm_payload["duration_days"])
            trip_request["dates"]["duration_days"] = days
            trip_request["dates"]["nights_count"] = max(days - 1, 0)

        if ds := llm_payload.get("date_start"):
            if str(ds).strip():
                trip_request["dates"]["start_date"] = str(ds).strip()
        if de := llm_payload.get("date_end"):
            if str(de).strip():
                trip_request["dates"]["end_date"] = str(de).strip()

        if gt := llm_payload.get("group_type"):
            if str(gt).strip():
                trip_request["party"]["group_type"] = str(gt).strip()

        if llm_payload.get("kids_friendly_required") is True:
            trip_request["constraints"]["kids_friendly_required"] = True
        if llm_payload.get("pet_friendly_required") is True:
            trip_request["constraints"]["pet_friendly_required"] = True

        if "stay_needed" in llm_payload and llm_payload["stay_needed"] is not None:
            trip_request["stay"]["stay_needed"] = bool(llm_payload["stay_needed"])

        if hstars := llm_payload.get("hotel_stars_min"):
            trip_request["stay"]["hotel_stars_min"] = int(hstars)

        if rc := llm_payload.get("rooms_count"):
            trip_request["stay"]["rooms_count"] = int(rc)

        if rcap := llm_payload.get("room_capacity_needed"):
            trip_request["stay"]["room_capacity_needed"] = int(rcap)

        if st := llm_payload.get("stay_type"):
            if isinstance(st, list) and st:
                cur = list(trip_request["stay"]["accommodation_type"])
                trip_request["stay"]["accommodation_type"] = sorted(set(cur) | set(st))

        if at := llm_payload.get("area_to"):
            if isinstance(at, list) and at:
                cur = list(trip_request["stay"]["preferred_zone"])
                trip_request["stay"]["preferred_zone"] = sorted(set(cur) | set(at))

        if cf := llm_payload.get("city_from"):
            if str(cf).strip():
                trip_request["client_context"]["start_city"] = str(cf).strip()

    # Шаблон TripRequest из строки user_base.csv
    def build_prior_from_user_base_row(self, row: dict[str, Any]) -> dict[str, Any] | None:
        if not row:
            return None

        cfg = RecommenderConfig()
        trip_request = self.contract.create_trip_request()
        raw_group = str(row.get("group", "")).strip()
        group_map = {
            "парой": "пара",
            "семьей": "семья",
            "один": "один",
            "компанией": "компания",
        }
        trip_request["party"]["group_type"] = group_map.get(
            raw_group,
            raw_group or self.routing_cfg.default_group_type,
        )

        days_raw = str(row.get("days", "")).strip()
        duration = cfg.days_mapping.get(days_raw, 0)
        if duration == 0:
            try:
                duration = max(1, int(days_raw))
            except (ValueError, TypeError):
                duration = self.routing_cfg.default_days_count
        trip_request["dates"]["duration_days"] = duration
        trip_request["dates"]["nights_count"] = max(duration - 1, 0)

        budget_raw = row.get("budget", 0)
        try:
            budget_total = int(float(str(budget_raw).replace(",", ".")))
        except (ValueError, TypeError):
            budget_total = 0
        trip_request["constraints"]["budget_total_rub"] = budget_total
        daily = budget_total / max(duration, 1)
        budget_level = cfg.budget_default_level
        for threshold, level_name in cfg.budget_daily_thresholds:
            if daily < threshold:
                budget_level = level_name
                break
        trip_request["constraints"]["budget_level"] = budget_level

        season = str(row.get("season", "")).strip()
        if season:
            trip_request["preferences"]["themes"] = [season]

        trip_request["raw_text"] = self._normalize_text(
            f"Группа {trip_request['party']['group_type']}, {days_raw}, "
            f"сезон {season}, бюджет {budget_total}",
        )
        trip_request["client_context"]["destination_city"] = self.routing_cfg.default_city_to

        adults_default = 2 if trip_request["party"]["group_type"] in {"пара", "семья"} else 1
        trip_request["party"]["adults"] = adults_default
        trip_request["party"]["children"] = 1 if trip_request["party"]["group_type"] == "семья" else 0
        trip_request["stay"]["room_capacity_needed"] = max(
            trip_request["party"]["adults"] + trip_request["party"]["children"],
            1,
        )
        trip_request["stay"]["stay_needed"] = duration > 1
        trip_request["stay"]["rooms_count"] = 1

        self._apply_defaults(trip_request, {})
        trip_request["query_text"] = self._build_query_text(trip_request)
        return trip_request

    # Сборка нормализованного query_text
    def _build_query_text(self, trip_request: dict[str, Any]) -> str:
        extras = trip_request.get("refinement_extras") or {}
        parts = [
            trip_request["party"]["group_type"],
            f"на {trip_request['dates']['duration_days']} дня",
            trip_request["client_context"].get("destination_city", ""),
            ", ".join(trip_request["preferences"]["themes"]),
            ", ".join(trip_request["preferences"]["food_preferences"]),
        ]
        if extras.get("family_notes"):
            parts.append(str(extras["family_notes"]))
        if extras.get("favorite_cuisines"):
            parts.append("кухни: " + ", ".join(extras["favorite_cuisines"]))
        if extras.get("dietary_restrictions"):
            parts.append("ограничения: " + ", ".join(extras["dietary_restrictions"]))
        return self._normalize_text(" ".join(part for part in parts if part))

    # Парсинг уточнения поверх базового TripRequest
    def parse_refinement(
        self,
        refinement_text: str,
        prior_trip_request: dict[str, Any],
        session_id: str = "",
        client_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        trip_request = copy.deepcopy(prior_trip_request)
        refinement_norm = self._normalize_text(refinement_text)
        client_context = client_context or {}

        trip_request["client_context"] = {
            **trip_request.get("client_context", {}),
            **client_context,
        }
        trip_request["session_id"] = session_id or trip_request.get("session_id", "")
        trip_request["request_id"] = f"req_{uuid4().hex[:12]}"
        trip_request["refinement_raw_text"] = refinement_norm
        trip_request["raw_text"] = self._normalize_text(
            f"{prior_trip_request.get('raw_text', '')} | {refinement_norm}",
        )

        parsed_slots: dict[str, Any] = {}
        backup_party = copy.deepcopy(trip_request["party"])
        backup_dates = copy.deepcopy(trip_request["dates"])
        backup_stay = copy.deepcopy(trip_request["stay"])
        backup_transport = copy.deepcopy(trip_request["transport"])

        self._extract_destination(refinement_norm, trip_request, parsed_slots)

        if self._refinement_mentions_duration(refinement_norm):
            self._extract_dates(refinement_norm, trip_request, parsed_slots)
        else:
            trip_request["dates"] = backup_dates

        party_updated = False
        if self._refinement_mentions_party(refinement_norm):
            self._extract_party(refinement_norm, trip_request, parsed_slots)
            party_updated = True
        else:
            trip_request["party"] = backup_party
            trip_request["stay"]["room_capacity_needed"] = max(
                backup_party.get("adults", 2) + backup_party.get("children", 0),
                1,
            )

        if self._refinement_mentions_stay(refinement_norm):
            self._extract_stay(refinement_norm, trip_request, parsed_slots)
        else:
            trip_request["stay"] = copy.deepcopy(backup_stay)
            if party_updated:
                trip_request["stay"]["room_capacity_needed"] = max(
                    trip_request["party"]["adults"] + trip_request["party"]["children"],
                    1,
                )

        if self._refinement_mentions_transport(refinement_norm):
            self._extract_transport(refinement_norm, trip_request, parsed_slots)
        else:
            trip_request["transport"] = backup_transport

        if self._refinement_mentions_budget(refinement_norm):
            self._extract_budget(refinement_norm, trip_request, parsed_slots)

        prior_themes = list(trip_request["preferences"]["themes"])
        prior_food = list(trip_request["preferences"]["food_preferences"])
        self._extract_preferences(refinement_norm, trip_request, parsed_slots)
        trip_request["preferences"]["themes"] = sorted(
            set(prior_themes) | set(trip_request["preferences"]["themes"]),
        )
        trip_request["preferences"]["food_preferences"] = sorted(
            set(prior_food) | set(trip_request["preferences"]["food_preferences"]),
        )

        prior_avoid = list(trip_request["constraints"]["avoid"])
        prior_must = list(trip_request["constraints"]["must_have"])
        prior_mobility = list(trip_request["constraints"]["mobility_constraints"])
        self._extract_constraints(refinement_norm, trip_request, parsed_slots)
        trip_request["constraints"]["avoid"] = sorted(
            set(prior_avoid) | set(trip_request["constraints"]["avoid"]),
        )
        trip_request["constraints"]["must_have"] = sorted(
            set(prior_must) | set(trip_request["constraints"]["must_have"]),
        )
        trip_request["constraints"]["mobility_constraints"] = sorted(
            set(prior_mobility) | set(trip_request["constraints"]["mobility_constraints"]),
        )

        self._merge_llm_refinement(
            self._extract_with_llm(refinement_norm),
            trip_request,
            parsed_slots,
        )

        self._apply_defaults(trip_request, client_context)
        trip_request["query_text"] = self._build_query_text(trip_request)
        trip_request["parsed_slots"] = parsed_slots
        return trip_request

    # Парсинг текста в TripRequest
    def parse_text(
        self,
        text: str,
        session_id: str = "",
        client_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        normalized_text = self._normalize_text(text)
        client_context = client_context or {}
        trip_request = self.contract.create_trip_request()
        trip_request["session_id"] = session_id
        trip_request["raw_text"] = normalized_text
        trip_request["client_context"] = dict(client_context)

        parsed_slots: dict[str, Any] = {}
        self._extract_destination(normalized_text, trip_request, parsed_slots)
        self._extract_dates(normalized_text, trip_request, parsed_slots)
        self._extract_party(normalized_text, trip_request, parsed_slots)
        self._extract_transport(normalized_text, trip_request, parsed_slots)
        self._extract_stay(normalized_text, trip_request, parsed_slots)
        self._extract_budget(normalized_text, trip_request, parsed_slots)
        self._extract_preferences(normalized_text, trip_request, parsed_slots)
        self._extract_constraints(normalized_text, trip_request, parsed_slots)
        self._merge_llm_extraction(
            self._extract_with_llm(normalized_text),
            trip_request,
            parsed_slots,
        )
        self._apply_defaults(trip_request, client_context)

        trip_request["query_text"] = self._build_query_text(trip_request)
        trip_request["parsed_slots"] = parsed_slots
        return trip_request


# Запуск
if __name__ == "__main__":
    import pprint

    test_text = (
        "Едем семьей на 3 дня, хотим винодельни, красивую природу, "
        "без длинных переездов, нужен семейный отель и хорошая аутентичная еда"
    )
    result = TripRequestParser().parse_text(test_text)
    pprint.pprint(result, width=120, sort_dicts=False)
