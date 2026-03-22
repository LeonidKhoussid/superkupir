from __future__ import annotations

from typing import Any


class CsvDataContract:
    """КОНТРАКТЫ CSV И DTO"""

    # Инициализация контрактов
    def __init__(self) -> None:
        self.users_columns = [
            "request_id",
            "session_id",
            "raw_text",
            "city_from",
            "city_to",
            "area_to",
            "date_start",
            "date_end",
            "days_count",
            "nights_count",
            "group_type",
            "adults_count",
            "children_count",
            "child_ages",
            "stay_needed",
            "stay_type",
            "hotel_stars_min",
            "rooms_count",
            "room_capacity_needed",
            "budget_level",
            "budget_total_rub",
            "themes",
            "food_preferences",
            "pace",
            "crowd_tolerance",
            "trip_style",
            "max_transfer_minutes",
            "with_car",
            "kids_friendly_required",
            "pet_friendly_required",
            "mobility_constraints",
            "must_have",
            "avoid",
        ]
        self.raw_users_columns = [
            "request_id",
            "session_id",
            "raw_text",
            "timestamp",
        ]
        self.user_detail_input_columns = [
            "user_id",
            "refinement_text",
            "session_id",
        ]
        self.dialog_columns = [
            "dialog_id",
            "session_id",
            "turn_id",
            "role",
            "text",
            "audio_path",
            "timestamp",
            "duration_seconds",
            "confidence",
        ]
        self.place_source_columns = [
            "source_place_id",
            "hotel_type",
            "stars",
            "avg_price_per_night_rub",
            "check_in_time",
            "check_out_time",
            "meal_options",
            "room_types",
            "place_tags",
            "food_place_type",
            "cuisine_types",
            "avg_bill_level",
            "avg_bill_rub",
            "location_type",
            "location_themes",
            "seasonality",
            "loc_price_level",
            "loc_price_rub",
            "working_days",
            "review_count",
        ]
        self.final_route_columns = [
            "route_id",
            "variant_rank",
            "variant_name",
            "day",
            "stop_order",
            "place_id",
            "source_table",
            "category",
            "place_type",
            "name",
            "lat",
            "lon",
            "address",
            "area",
            "description",
            "start_time",
            "end_time",
            "duration_min",
            "score",
            "distance_from_prev_km",
            "travel_estimate_min",
            "why_selected",
            *self.place_source_columns,
        ]
        self.nearby_columns = [
            "route_id",
            "variant_name",
            "anchor_place_id",
            "anchor_name",
            "nearby_rank",
            "nearby_place_id",
            "source_table",
            "category",
            "place_type",
            "name",
            "lat",
            "lon",
            "address",
            "area",
            "description",
            "distance_km",
            "travel_estimate_min",
            "score",
            "why_relevant",
            *self.place_source_columns,
        ]
        self.base_route_columns = [
            "user_id",
            "route_variant",
            "day",
            "stop_order",
            "stop_type",
            "place_id",
            "source_table",
            "category",
            "place_type",
            "name",
            "lat",
            "lon",
            "address",
            "area",
            "distance_from_hotel_km",
            "rating",
            "description",
            *self.place_source_columns,
        ]
        self.user_detailed_columns = [
            "user_id",
            "refinement_raw_text",
            "request_id",
            "session_id",
            "raw_text",
            "city_from",
            "city_to",
            "area_to",
            "date_start",
            "date_end",
            "days_count",
            "nights_count",
            "group_type",
            "adults_count",
            "children_count",
            "child_ages",
            "stay_needed",
            "stay_type",
            "hotel_stars_min",
            "rooms_count",
            "room_capacity_needed",
            "budget_level",
            "budget_total_rub",
            "themes",
            "food_preferences",
            "pace",
            "crowd_tolerance",
            "trip_style",
            "max_transfer_minutes",
            "with_car",
            "kids_friendly_required",
            "pet_friendly_required",
            "mobility_constraints",
            "must_have",
            "avoid",
            "query_text",
        ]
        self.user_02_detail_columns = [
            "user_id",
            "request_id",
            "session_id",
            "profile_stage",
            "raw_text",
            "refinement_raw_text",
            "travel_season",
            "city_from",
            "city_to",
            "preferred_cities",
            "area_to",
            "preferred_areas",
            "date_start",
            "date_end",
            "days_count",
            "nights_count",
            "group_type",
            "adults_count",
            "children_count",
            "child_ages",
            "stay_needed",
            "stay_type",
            "preferred_hotel_types",
            "preferred_hotel_tags",
            "hotel_stars_min",
            "rooms_count",
            "room_capacity_needed",
            "budget_level",
            "budget_total_rub",
            "budget_per_day_rub",
            "themes",
            "preferred_location_themes",
            "preferred_location_types",
            "food_preferences",
            "preferred_food_place_types",
            "preferred_cuisine_types",
            "pace",
            "crowd_tolerance",
            "trip_style",
            "focus_categories",
            "max_transfer_minutes",
            "with_car",
            "kids_friendly_required",
            "pet_friendly_required",
            "mobility_constraints",
            "must_have",
            "avoid",
            "avoid_place_types",
            "wants_wine",
            "wants_food",
            "wants_nature",
            "wants_history",
            "wants_city",
            "wants_sea",
            "wants_views",
            "wants_quiet",
            "wants_family_focus",
            "wants_spa",
            "wants_romantic",
            "known_fields_count",
            "inferred_fields_count",
            "query_text",
            "semantic_profile_text",
            "embedding_model",
            "embedding_dim",
            "embedding_key",
            "query_embedding_json",
        ]
        self.recsys_route_columns = [
            "user_id",
            "day",
            "count",
            "route_variant",
            "variant_name",
            *[column for column in self.user_02_detail_columns if column != "user_id"],
            "stop_type",
            "place_id",
            "source_table",
            "category",
            "place_type",
            "name",
            "lat",
            "lon",
            "address",
            "area",
            "place_city",
            "description",
            "rating",
            "distance_from_prev_km",
            "distance_from_hotel_km",
            "travel_estimate_min",
            "start_time",
            "end_time",
            "duration_min",
            "score_total",
            "score_semantic",
            "score_preference",
            "score_logistics",
            "score_family",
            "score_trust",
            "score_diversity",
            "why_selected",
            *self.place_source_columns,
        ]
        self.backend_route_columns = [
            "user_id",
            "day",
            "place_id",
            "name",
            "description",
            "type",
            "latitude",
            "longitude",
            "address",
            "estimated_duration",
            "estimated_cost",
            "image_url",
            "season",
        ]
        self.similar_places_columns = [
            "anchor_place_id",
            "similarity_score",
            "place_id",
            "source_table",
            "category",
            "place_type",
            "name",
            "lat",
            "lon",
            "area",
            "price_level",
            "price_rub",
            "rating",
            "themes",
            "tags",
            "description",
            *self.place_source_columns,
        ]

    # Поля из исходных CSV (hotels / food / locations / wines)
    def flatten_place_source_fields(self, place: dict[str, Any]) -> dict[str, Any]:
        raw: dict[str, Any] = dict(place.get("raw_record") or {})
        src = str(place.get("source_table", ""))
        out: dict[str, str] = {key: "" for key in self.place_source_columns}
        rc = raw.get("review_count", place.get("review_count", ""))
        out["review_count"] = str(rc) if rc not in ("", None) else ""

        if src == "hotels":
            out["source_place_id"] = str(raw.get("place_id", "") or "")
            out["hotel_type"] = str(raw.get("hotel_type", "") or place.get("place_type", "") or "")
            out["stars"] = str(raw.get("stars", "") or "")
            out["avg_price_per_night_rub"] = str(raw.get("avg_price_per_night_rub", "") or "")
            out["check_in_time"] = str(raw.get("check_in_time", "") or place.get("opening_time", "") or "")
            out["check_out_time"] = str(raw.get("check_out_time", "") or place.get("closing_time", "") or "")
            out["meal_options"] = str(raw.get("meal_options", "") or "")
            out["room_types"] = str(raw.get("room_types", "") or "")
            out["place_tags"] = str(raw.get("tags", "") or "")
        elif src == "food":
            out["source_place_id"] = str(raw.get("place_id", "") or "")
            out["food_place_type"] = str(raw.get("place_type", "") or place.get("place_type", "") or "")
            out["cuisine_types"] = str(raw.get("cuisine_types", "") or "")
            out["avg_bill_level"] = str(raw.get("avg_bill_level", "") or "")
            out["avg_bill_rub"] = str(raw.get("avg_bill_rub", "") or "")
            out["working_days"] = str(raw.get("working_days", "") or "")
            tags_list = place.get("tags")
            if isinstance(tags_list, list) and tags_list:
                out["place_tags"] = ";".join(str(t) for t in tags_list if t)
            else:
                out["place_tags"] = out["cuisine_types"]
        elif src == "locations":
            out["source_place_id"] = str(raw.get("place_id", "") or "")
            out["location_type"] = str(raw.get("location_type", "") or place.get("place_type", "") or "")
            out["location_themes"] = str(raw.get("themes", "") or "")
            out["seasonality"] = str(raw.get("seasonality", "") or "")
            out["loc_price_level"] = str(raw.get("price_level", "") or "")
            out["loc_price_rub"] = str(raw.get("price_rub", "") or "")
            out["working_days"] = str(raw.get("working_days", "") or "")
            out["place_tags"] = str(raw.get("tags", "") or "")
        elif src == "wines":
            out["source_place_id"] = str(raw.get("wines_id", "") or "")
            out["location_type"] = "винодельня"
            out["food_place_type"] = str(raw.get("size", "") or "")
            tgs = place.get("tags")
            if isinstance(tgs, list):
                out["place_tags"] = ";".join(str(t) for t in tgs if t)
        return out

    # Создание пустого слота
    @staticmethod
    def create_slot(
        value: Any = None,
        confidence: float = 0.0,
        source: str = "rule",
    ) -> dict[str, Any]:
        return {
            "value": value,
            "confidence": round(float(confidence), 4),
            "source": source,
        }

    # Создание шаблона результата ASR
    def create_transcript_result(self) -> dict[str, Any]:
        return {
            "transcript": "",
            "language": "",
            "language_probability": 0.0,
            "duration_seconds": 0.0,
            "segments": [],
            "word_timestamps": [],
            "confidence": 0.0,
        }

    # Создание шаблона нормализованного запроса
    def create_trip_request(self) -> dict[str, Any]:
        return {
            "request_id": "",
            "session_id": "",
            "raw_text": "",
            "query_text": "",
            "semantic_profile_text": "",
            "travel_season": "",
            "client_context": {
                "start_city": "",
                "destination_city": "",
                "preferred_cities": [],
            },
            "dates": {
                "start_date": "",
                "end_date": "",
                "duration_days": 0,
                "nights_count": 0,
            },
            "party": {
                "group_type": "",
                "adults": 0,
                "children": 0,
                "child_ages": [],
            },
            "transport": {
                "arrival_mode": "",
                "transport_mode": "",
                "has_car": False,
                "max_transfer_minutes": 0,
            },
            "stay": {
                "stay_needed": False,
                "accommodation_type": [],
                "hotel_stars_min": 0,
                "rooms_count": 0,
                "room_capacity_needed": 0,
                "preferred_zone": [],
                "preferred_tags": [],
            },
            "preferences": {
                "themes": [],
                "food_preferences": [],
                "preferred_location_themes": [],
                "preferred_location_types": [],
                "preferred_food_place_types": [],
                "preferred_cuisine_types": [],
                "crowd_tolerance": "",
                "pace": "",
                "trip_style": "",
                "focus_categories": [],
            },
            "constraints": {
                "budget_level": "",
                "budget_total_rub": 0,
                "mobility_constraints": [],
                "must_have": [],
                "avoid": [],
                "avoid_place_types": [],
                "kids_friendly_required": False,
                "pet_friendly_required": False,
            },
            "parsed_slots": {},
            "query_embedding": [],
        }

    # Создание шаблона записи места
    def create_place_record(self) -> dict[str, Any]:
        return {
            "place_id": "",
            "source_table": "",
            "category": "",
            "name": "",
            "address": "",
            "lat": None,
            "lon": None,
            "area": "",
            "city": "",
            "place_type": "",
            "opening_time": "",
            "closing_time": "",
            "working_days": [],
            "seasonality": "",
            "price_level": "",
            "price_rub": 0,
            "rating": 0.0,
            "review_count": 0,
            "description": "",
            "tags": [],
            "themes": [],
            "family_friendly": False,
            "kids_friendly": False,
            "romantic": False,
            "pet_friendly": False,
            "parking": False,
            "sea_view": False,
            "booking_required": False,
            "guided_experience": False,
            "availability_mode": "",
            "raw_record": {},
        }

    # Создание шаблона ранжированной точки
    def create_ranked_place(self) -> dict[str, Any]:
        return {
            "place": self.create_place_record(),
            "semantic_score": 0.0,
            "preference_score": 0.0,
            "logistics_score": 0.0,
            "family_score": 0.0,
            "trust_score": 0.0,
            "diversity_score": 0.0,
            "weather_score": 0.0,
            "score": 0.0,
            "why_selected": "",
        }

    # Создание шаблона варианта маршрута
    def create_route_variant(self) -> dict[str, Any]:
        return {
            "route_id": "",
            "variant_rank": 0,
            "variant_name": "",
            "summary": "",
            "days": [],
            "stops": [],
        }

    # Подготовка строки users.csv
    def build_user_row(self, trip_request: dict[str, Any]) -> dict[str, Any]:
        dates = trip_request.get("dates", {})
        party = trip_request.get("party", {})
        stay = trip_request.get("stay", {})
        preferences = trip_request.get("preferences", {})
        constraints = trip_request.get("constraints", {})
        transport = trip_request.get("transport", {})
        client_context = trip_request.get("client_context", {})

        preferred_zone = stay.get("preferred_zone") or []
        accommodation_type = stay.get("accommodation_type") or []
        child_ages = party.get("child_ages") or []
        mobility_constraints = constraints.get("mobility_constraints") or []
        must_have = constraints.get("must_have") or []
        avoid = constraints.get("avoid") or []

        return {
            "request_id": str(trip_request.get("request_id", "") or ""),
            "session_id": str(trip_request.get("session_id", "") or ""),
            "raw_text": str(trip_request.get("raw_text", "") or ""),
            "city_from": str(client_context.get("start_city", "") or ""),
            "city_to": str(client_context.get("destination_city", "") or ""),
            "area_to": ";".join(preferred_zone) if preferred_zone else "",
            "date_start": str(dates.get("start_date", "") or ""),
            "date_end": str(dates.get("end_date", "") or ""),
            "days_count": int(dates.get("duration_days", 0) or 0),
            "nights_count": int(dates.get("nights_count", 0) or 0),
            "group_type": str(party.get("group_type", "") or ""),
            "adults_count": int(party.get("adults", 0) or 0),
            "children_count": int(party.get("children", 0) or 0),
            "child_ages": ";".join(str(age) for age in child_ages) if child_ages else "",
            "stay_needed": bool(stay.get("stay_needed", False)),
            "stay_type": ";".join(accommodation_type) if accommodation_type else "",
            "hotel_stars_min": int(stay.get("hotel_stars_min", 0) or 0),
            "rooms_count": int(stay.get("rooms_count", 0) or 0),
            "room_capacity_needed": int(stay.get("room_capacity_needed", 0) or 0),
            "budget_level": str(constraints.get("budget_level", "") or ""),
            "budget_total_rub": int(constraints.get("budget_total_rub", 0) or 0),
            "themes": ";".join(preferences.get("themes", [])) if preferences.get("themes") else "",
            "food_preferences": ";".join(preferences.get("food_preferences", []))
            if preferences.get("food_preferences")
            else "",
            "pace": str(preferences.get("pace", "") or ""),
            "crowd_tolerance": str(preferences.get("crowd_tolerance", "") or ""),
            "trip_style": str(preferences.get("trip_style", "") or ""),
            "max_transfer_minutes": int(transport.get("max_transfer_minutes", 0) or 0),
            "with_car": bool(transport.get("has_car", False)),
            "kids_friendly_required": bool(constraints.get("kids_friendly_required", False)),
            "pet_friendly_required": bool(constraints.get("pet_friendly_required", False)),
            "mobility_constraints": ";".join(mobility_constraints) if mobility_constraints else "",
            "must_have": ";".join(must_have) if must_have else "",
            "avoid": ";".join(avoid) if avoid else "",
        }

    # Подготовка строки user_detailed.csv
    def build_user_detailed_row(
        self,
        trip_request: dict[str, Any],
        user_id: str,
        refinement_raw_text: str,
    ) -> dict[str, Any]:
        row = self.build_user_row(trip_request)
        return {
            "user_id": user_id,
            "refinement_raw_text": refinement_raw_text,
            **row,
            "query_text": trip_request.get("query_text", ""),
        }

    # Подготовка строки final_routes.csv
    def build_route_row(
        self,
        route_id: str,
        variant_rank: int,
        variant_name: str,
        stop: dict[str, Any],
    ) -> dict[str, Any]:
        place = stop.get("place", {})
        flat = self.flatten_place_source_fields(place)
        return {
            "route_id": route_id,
            "variant_rank": variant_rank,
            "variant_name": variant_name,
            "day": stop.get("day", 1),
            "stop_order": stop.get("stop_order", 0),
            "place_id": place.get("place_id", ""),
            "source_table": place.get("source_table", ""),
            "category": place.get("category", ""),
            "place_type": place.get("place_type", ""),
            "name": place.get("name", ""),
            "lat": place.get("lat"),
            "lon": place.get("lon"),
            "address": place.get("address", ""),
            "area": place.get("area", ""),
            "description": place.get("description", ""),
            "start_time": stop.get("start_time", ""),
            "end_time": stop.get("end_time", ""),
            "duration_min": stop.get("duration_min", 0),
            "score": stop.get("score", 0.0),
            "distance_from_prev_km": stop.get("distance_from_prev_km", 0.0),
            "travel_estimate_min": stop.get("travel_estimate_min", 0),
            "why_selected": stop.get("why_selected", ""),
            **flat,
        }

    # Подготовка строки nearby_places.csv
    def build_nearby_row(
        self,
        route_id: str,
        variant_name: str,
        anchor_place: dict[str, Any],
        nearby_rank: int,
        nearby_place: dict[str, Any],
        distance_km: float,
        travel_estimate_min: int,
        score: float,
        why_relevant: str,
    ) -> dict[str, Any]:
        flat = self.flatten_place_source_fields(nearby_place)
        return {
            "route_id": route_id,
            "variant_name": variant_name,
            "anchor_place_id": anchor_place.get("place_id", ""),
            "anchor_name": anchor_place.get("name", ""),
            "nearby_rank": nearby_rank,
            "nearby_place_id": nearby_place.get("place_id", ""),
            "source_table": nearby_place.get("source_table", ""),
            "category": nearby_place.get("category", ""),
            "place_type": nearby_place.get("place_type", ""),
            "name": nearby_place.get("name", ""),
            "lat": nearby_place.get("lat"),
            "lon": nearby_place.get("lon"),
            "address": nearby_place.get("address", ""),
            "area": nearby_place.get("area", ""),
            "description": nearby_place.get("description", ""),
            "distance_km": round(distance_km, 3),
            "travel_estimate_min": travel_estimate_min,
            "score": round(score, 4),
            "why_relevant": why_relevant,
            **flat,
        }


from app.db_connector.models import CsvDataContract

# Запуск
if __name__ == "__main__":
    print(CsvDataContract().users_columns)