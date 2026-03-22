from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Any

import numpy as np
from sentence_transformers import SentenceTransformer


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import EmbeddingConfig, PathConfig


class PlaceEmbeddings:
    """ЭМБЕДДИНГИ МЕСТ И ЗАПРОСОВ"""

    # Инициализация эмбеддинг-сервиса
    def __init__(self) -> None:
        self.embedding_cfg = EmbeddingConfig()
        self.paths = PathConfig()
        self.paths.ensure_directories()
        self.model: SentenceTransformer | None = None
        self._configure_hf_paths()

    # Настройка локального HF cache
    def _configure_hf_paths(self) -> None:
        os.environ.setdefault("HF_HOME", str(self.paths.embeddings_hf_home_dir))
        os.environ.setdefault(
            "HUGGINGFACE_HUB_CACHE",
            str(self.paths.embeddings_hf_home_dir / "hub"),
        )
        os.environ.setdefault(
            "TRANSFORMERS_CACHE",
            str(self.paths.embeddings_hf_home_dir / "transformers"),
        )

    # Загрузка sentence-transformers модели
    def _get_model(self) -> SentenceTransformer:
        if self.model is None:
            device = "cuda" if self.embedding_cfg.device == "cuda" else "cpu"
            self.model = SentenceTransformer(
                self.embedding_cfg.model_name,
                cache_folder=str(self.paths.embeddings_hf_home_dir),
                device=device,
            )
        return self.model

    # Сборка текста места для эмбеддинга
    def _build_place_text(self, place: dict[str, Any]) -> str:
        parts = [
            str(place.get("category", "")),
            str(place.get("place_type", "")),
            str(place.get("name", "")),
            str(place.get("area", "")),
            " ".join(place.get("themes", [])),
            " ".join(place.get("tags", [])),
            str(place.get("description", "")),
        ]
        merged = " ".join(part for part in parts if part).strip()
        return f"{self.embedding_cfg.document_prefix}{merged}"

    # Сборка текста запроса для эмбеддинга
    def _build_query_text(self, trip_request: dict[str, Any]) -> str:
        client_context = trip_request.get("client_context", {})
        stay = trip_request.get("stay", {})
        preferences = trip_request.get("preferences", {})
        constraints = trip_request.get("constraints", {})
        parts = [
            str(trip_request.get("semantic_profile_text", "")),
            str(trip_request.get("query_text", "")),
            str(trip_request.get("travel_season", "")),
            str(client_context.get("destination_city", "")),
            " ".join(client_context.get("preferred_cities", [])),
            " ".join(preferences.get("themes", [])),
            " ".join(preferences.get("preferred_location_themes", [])),
            " ".join(preferences.get("preferred_location_types", [])),
            " ".join(preferences.get("food_preferences", [])),
            " ".join(preferences.get("preferred_food_place_types", [])),
            " ".join(preferences.get("preferred_cuisine_types", [])),
            " ".join(preferences.get("focus_categories", [])),
            " ".join(stay.get("accommodation_type", [])),
            " ".join(stay.get("preferred_tags", [])),
            " ".join(stay.get("preferred_zone", [])),
            str(preferences.get("pace", "")),
            str(preferences.get("crowd_tolerance", "")),
            str(preferences.get("trip_style", "")),
            str(constraints.get("budget_level", "")),
            " ".join(constraints.get("must_have", [])),
            " ".join(constraints.get("avoid", [])),
        ]
        merged = " ".join(part for part in parts if part).strip()
        return f"{self.embedding_cfg.query_prefix}{merged}"

    # Формирование cache key
    def _build_cache_key(self, places: list[dict[str, Any]]) -> str:
        payload = {
            "model_name": self.embedding_cfg.model_name,
            "places": [
                {
                    "place_id": place.get("place_id", ""),
                    "name": place.get("name", ""),
                    "description": place.get("description", ""),
                    "tags": place.get("tags", []),
                    "themes": place.get("themes", []),
                }
                for place in places
            ],
        }
        raw_payload = json.dumps(payload, ensure_ascii=False, sort_keys=True)
        return hashlib.sha1(raw_payload.encode("utf-8")).hexdigest()

    # Получение путей cache-файлов
    def _get_cache_paths(self, cache_key: str) -> tuple[Path, Path]:
        base_name = f"{cache_key}_place_embeddings"
        metadata_path = self.paths.embeddings_cache_dir / f"{base_name}.json"
        vectors_path = self.paths.embeddings_cache_dir / f"{base_name}.npy"
        return metadata_path, vectors_path

    # Загрузка кэша эмбеддингов
    def _load_cache(self, cache_key: str) -> np.ndarray | None:
        metadata_path, vectors_path = self._get_cache_paths(cache_key)
        if not metadata_path.exists() or not vectors_path.exists():
            return None

        try:
            with metadata_path.open("r", encoding="utf-8") as file:
                metadata = json.load(file)
            if metadata.get("cache_key") != cache_key:
                return None
            return np.load(vectors_path)
        except Exception:
            return None

    # Сохранение кэша эмбеддингов
    def _save_cache(self, cache_key: str, vectors: np.ndarray) -> None:
        metadata_path, vectors_path = self._get_cache_paths(cache_key)
        with metadata_path.open("w", encoding="utf-8") as file:
            json.dump({"cache_key": cache_key}, file, ensure_ascii=False, indent=2)
        np.save(vectors_path, vectors)

    # Кодирование мест
    def encode_places(self, places: list[dict[str, Any]]) -> np.ndarray:
        if not places:
            return np.zeros((0, 0), dtype=np.float32)

        cache_key = self._build_cache_key(places)
        cached_vectors = self._load_cache(cache_key)
        if cached_vectors is not None:
            return cached_vectors.astype(np.float32)

        model = self._get_model()
        texts = [self._build_place_text(place) for place in places]
        vectors = model.encode(
            texts,
            batch_size=self.embedding_cfg.batch_size,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True,
        ).astype(np.float32)
        self._save_cache(cache_key, vectors)
        return vectors

    # Кодирование пользовательского запроса
    def encode_query(self, trip_request: dict[str, Any]) -> np.ndarray:
        model = self._get_model()
        query_text = self._build_query_text(trip_request)
        return model.encode(
            [query_text],
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True,
        )[0].astype(np.float32)

    # Поиск похожих мест по косинусной близости
    def semantic_search(
        self,
        query_vector: np.ndarray,
        places: list[dict[str, Any]],
        top_k: int | None = None,
    ) -> list[dict[str, Any]]:
        if query_vector.size == 0 or not places:
            return []

        place_vectors = self.encode_places(places)
        if place_vectors.size == 0:
            return []

        scores = place_vectors @ query_vector
        limit = top_k or self.embedding_cfg.top_k
        ranked_indexes = np.argsort(scores)[::-1][:limit]
        return [
            {
                "place": places[index],
                "semantic_score": float(scores[index]),
            }
            for index in ranked_indexes
        ]

from app.ml_core.embeddings import PlaceEmbeddings

# Запуск
if __name__ == "__main__":
    print(PlaceEmbeddings().__class__.__name__)
