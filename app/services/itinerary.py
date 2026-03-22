from __future__ import annotations

import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import PathConfig, RoutingConfig
from app.db_connector.models import CsvDataContract
from app.db_connector.repositories import CsvRepository
from app.planner.graph_builder import TripGraphBuilder
from app.planner.route_optimizer import RouteOptimizer
from app.services.parser import TripRequestParser
from app.services.search import TripSearchService
from app.services.transcription import TranscriptionService


class ItineraryService:
    """СБОРКА ФИНАЛЬНОГО МАРШРУТА"""

    # Инициализация itinerary-сервиса
    def __init__(self) -> None:
        self.contract = CsvDataContract()
        self.paths = PathConfig()
        self.paths.ensure_directories()
        self.routing_cfg = RoutingConfig()
        self.repository = CsvRepository()
        self.graph_builder = TripGraphBuilder()
        self.optimizer = RouteOptimizer()
        self.parser = TripRequestParser()
        self.search_service = TripSearchService()
        self.transcription_service = TranscriptionService()

    # Построение карты рангов кандидатов
    @staticmethod
    def _build_ranked_lookup(
        ranked_candidates: list[dict[str, Any]],
    ) -> dict[str, dict[str, Any]]:
        return {
            candidate["place"]["place_id"]: candidate
            for candidate in ranked_candidates
        }

    # Сборка строк final_routes.csv
    def _build_route_rows(self, route_variants: list[dict[str, Any]]) -> list[dict[str, Any]]:
        route_rows: list[dict[str, Any]] = []
        for route_variant in route_variants:
            for stop in route_variant.get("stops", []):
                route_rows.append(
                    self.contract.build_route_row(
                        route_id=route_variant["route_id"],
                        variant_rank=route_variant["variant_rank"],
                        variant_name=route_variant["variant_name"],
                        stop=stop,
                    )
                )
        return route_rows

    # Сборка nearby-рекомендаций
    def _build_nearby_rows(
        self,
        route_variants: list[dict[str, Any]],
        candidate_places: list[dict[str, Any]],
        ranked_lookup: dict[str, dict[str, Any]],
    ) -> list[dict[str, Any]]:
        nearby_rows: list[dict[str, Any]] = []
        for route_variant in route_variants:
            route_place_ids = {stop["place"]["place_id"] for stop in route_variant.get("stops", [])}
            for stop in route_variant.get("stops", []):
                anchor_place = stop["place"]
                nearby_candidates = self.graph_builder.get_nearby_places(
                    anchor_place=anchor_place,
                    places=candidate_places,
                    limit=self.routing_cfg.max_nearby_candidates * 2,
                    allowed_categories={"food", "wine", "stay"},
                )

                nearby_rank = 1
                for nearby_candidate in nearby_candidates:
                    nearby_place = nearby_candidate["place"]
                    if nearby_place["place_id"] in route_place_ids:
                        continue

                    ranked_candidate = ranked_lookup.get(nearby_place["place_id"], {})
                    score = float(ranked_candidate.get("score", 0.45))
                    why_relevant = ranked_candidate.get(
                        "why_selected",
                        "рядом с маршрутом и подходит по контексту",
                    )
                    nearby_rows.append(
                        self.contract.build_nearby_row(
                            route_id=route_variant["route_id"],
                            variant_name=route_variant["variant_name"],
                            anchor_place=anchor_place,
                            nearby_rank=nearby_rank,
                            nearby_place=nearby_place,
                            distance_km=float(nearby_candidate["distance_km"]),
                            travel_estimate_min=int(nearby_candidate["travel_estimate_min"]),
                            score=score,
                            why_relevant=why_relevant,
                        )
                    )
                    nearby_rank += 1
                    if nearby_rank > self.routing_cfg.max_nearby_candidates:
                        break

        return nearby_rows

    # Приоритетный отель из остановок варианта
    @staticmethod
    def _pick_hotel_place(stops: list[dict[str, Any]]) -> dict[str, Any] | None:
        for stop in stops:
            place = stop.get("place", {})
            if place.get("category") == "stay":
                return place
        return None

    # Тип остановки для user_refined.csv
    @staticmethod
    def _stop_type_for_place(place: dict[str, Any]) -> str:
        category = place.get("category", "")
        if category == "stay":
            return "hotel"
        if category == "food":
            return "food"
        return "activity"

    # Маршруты в строки user_refined.csv
    def _route_variants_to_user_refined_rows(
        self,
        user_id: str,
        route_variants: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        uid = str(user_id).strip()
        for variant in route_variants:
            variant_rank = int(variant.get("variant_rank", 1))
            stops = variant.get("stops", [])
            hotel_place = self._pick_hotel_place(stops)
            for stop in stops:
                place = stop.get("place", {})
                stop_type = self._stop_type_for_place(place)
                distance_km = 0.0
                if hotel_place is not None and stop_type != "hotel":
                    dist = self.graph_builder._distance_km(hotel_place, place)
                    distance_km = 0.0 if dist == float("inf") else round(float(dist), 3)
                flat = self.contract.flatten_place_source_fields(place)
                row: dict[str, Any] = {
                    "user_id": uid,
                    "route_variant": variant_rank,
                    "day": stop.get("day", 1),
                    "stop_order": stop.get("stop_order", 0),
                    "stop_type": stop_type,
                    "place_id": place.get("place_id", ""),
                    "source_table": place.get("source_table", ""),
                    "category": place.get("category", ""),
                    "place_type": place.get("place_type", ""),
                    "name": place.get("name", ""),
                    "lat": place.get("lat"),
                    "lon": place.get("lon"),
                    "address": place.get("address", ""),
                    "area": place.get("area", ""),
                    "distance_from_hotel_km": distance_km,
                    "rating": place.get("rating", 0.0),
                    "description": place.get("description", ""),
                }
                row.update(flat)
                rows.append(row)
        return rows

    # Базовый TripRequest из user_base.csv
    def _load_prior_for_refinement(self, user_id: str) -> dict[str, Any] | None:
        row = self.repository.find_user_base_row(user_id)
        if row is None:
            return None
        return self.parser.build_prior_from_user_base_row(row)

    # Сборка refinement-пайплайна
    def _build_refinement_from_transcript(
        self,
        user_id: str,
        transcript_result: dict[str, Any],
        session_id: str,
        client_context: dict[str, Any] | None,
    ) -> dict[str, Any]:
        prior = self._load_prior_for_refinement(user_id)
        if prior is None:
            msg = f"user_base: не найден пользователь id={user_id}"
            raise ValueError(msg)

        refinement_text = str(transcript_result.get("transcript", "")).strip()
        trip_request = self.parser.parse_refinement(
            refinement_text=refinement_text,
            prior_trip_request=prior,
            session_id=session_id,
            client_context=client_context,
        )
        self.repository.append_user_request(trip_request)
        self.repository.append_user_detailed(
            trip_request,
            user_id=str(user_id).strip(),
            refinement_raw_text=str(trip_request.get("refinement_raw_text", refinement_text)),
        )

        search_payload = self.search_service.search(trip_request)
        trip_request["query_embedding"] = search_payload["query_embedding"]
        route_variants = self.optimizer.build_route_variants(
            trip_request=trip_request,
            ranked_groups=search_payload["grouped_candidates"],
        )

        ranked_lookup = self._build_ranked_lookup(search_payload["ranked_candidates"])
        route_rows = self._build_route_rows(route_variants)
        nearby_rows = self._build_nearby_rows(
            route_variants=route_variants,
            candidate_places=search_payload["filtered_places"],
            ranked_lookup=ranked_lookup,
        )

        self.repository.write_final_routes(route_rows)
        self.repository.write_nearby_places(nearby_rows)
        refined_rows = self._route_variants_to_user_refined_rows(user_id, route_variants)
        self.repository.append_extended_route_rows(refined_rows)

        return {
            "user_id": user_id,
            "transcript_result": transcript_result,
            "trip_request": trip_request,
            "route_variants": route_variants,
            "final_routes_csv": str(self.paths.final_routes_csv_path),
            "nearby_places_csv": str(self.paths.nearby_places_csv_path),
            "user_expanded_csv": str(self.paths.user_expanded_csv_path),
            "extended_route_csv": str(self.paths.extended_route_csv_path),
        }

    # Внутренняя сборка результата из transcript_result
    def _build_from_transcript_result(
        self,
        transcript_result: dict[str, Any],
        session_id: str,
        client_context: dict[str, Any] | None,
    ) -> dict[str, Any]:
        trip_request = self.parser.parse_text(
            text=transcript_result["transcript"],
            session_id=session_id,
            client_context=client_context,
        )
        self.repository.append_user_request(trip_request)

        search_payload = self.search_service.search(trip_request)
        trip_request["query_embedding"] = search_payload["query_embedding"]
        route_variants = self.optimizer.build_route_variants(
            trip_request=trip_request,
            ranked_groups=search_payload["grouped_candidates"],
        )

        ranked_lookup = self._build_ranked_lookup(search_payload["ranked_candidates"])
        route_rows = self._build_route_rows(route_variants)
        nearby_rows = self._build_nearby_rows(
            route_variants=route_variants,
            candidate_places=search_payload["filtered_places"],
            ranked_lookup=ranked_lookup,
        )

        self.repository.write_final_routes(route_rows)
        self.repository.write_nearby_places(nearby_rows)

        return {
            "transcript_result": transcript_result,
            "trip_request": trip_request,
            "route_variants": route_variants,
            "final_routes_csv": str(self.paths.final_routes_csv_path),
            "nearby_places_csv": str(self.paths.nearby_places_csv_path),
        }

    # Обработка текстового запроса
    def build_from_text(
        self,
        text: str,
        session_id: str = "",
        client_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        transcript_result = self.transcription_service.transcribe_input(
            input_type="text",
            text=text,
        )
        return self._build_from_transcript_result(
            transcript_result=transcript_result,
            session_id=session_id,
            client_context=client_context,
        )

    # Обработка аудиофайла
    def build_from_audio_file(
        self,
        audio_path: str | Path,
        session_id: str = "",
        client_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        transcript_result = self.transcription_service.transcribe_input(
            input_type="audio",
            audio_path=audio_path,
        )
        return self._build_from_transcript_result(
            transcript_result=transcript_result,
            session_id=session_id,
            client_context=client_context,
        )

    # Обработка запроса с микрофона
    def build_from_microphone(
        self,
        session_id: str = "",
        client_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        transcript_result = self.transcription_service.transcribe_microphone()
        return self._build_from_transcript_result(
            transcript_result=transcript_result,
            session_id=session_id,
            client_context=client_context,
        )

    # Уточнение маршрута по тексту (после user_base)
    def build_from_refinement_text(
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
        return self._build_refinement_from_transcript(
            user_id=user_id,
            transcript_result=transcript_result,
            session_id=session_id,
            client_context=client_context,
        )

    # Уточнение маршрута по аудиофайлу
    def build_from_refinement_audio(
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
        return self._build_refinement_from_transcript(
            user_id=user_id,
            transcript_result=transcript_result,
            session_id=session_id,
            client_context=client_context,
        )


from app.services.itinerary import ItineraryService

# Запуск
if __name__ == "__main__":
    result = ItineraryService().build_from_text(
        "Едем семьей на 3 дня, хотим винодельни, красивую природу, без длинных переездов, нужен семейный отель и хорошая еда.",
        session_id="demo_session",
        client_context={"start_city": "Краснодар"},
    )
    print(result["final_routes_csv"])
