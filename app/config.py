from __future__ import annotations

import os
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parents[1]


class CUDAConfig:
    """НАСТРОЙКИ CUDA"""

    # Инициализация CUDA-переменных
    def __init__(self) -> None:
        self.cuda_settings = {
            "CUDA_AUTO_BOOST": "1",
            "CUDA_MODULE_LOADING": "LAZY",
            "CUDA_DEVICE_MAX_CONNECTIONS": "32",
        }
        if os.name != "nt":
            self.cuda_settings["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

    # Применение CUDA-переменных
    def apply(self) -> None:
        for key, value in self.cuda_settings.items():
            os.environ.setdefault(key, value)

    # Определение доступного устройства
    @staticmethod
    def detect_device() -> str:
        try:
            import torch  # type: ignore

            if torch.cuda.is_available():
                return "cuda"
        except Exception:
            pass
        return "cpu"


class PathConfig:
    """ПУТИ ПРОЕКТА И МОДЕЛЕЙ"""

    # Инициализация путей проекта
    def __init__(
        self,
        whisper_model_name: str = "medium",
        tts_model_name: str = "v4_ru",
    ) -> None:
        self.base_dir = BASE_DIR
        self.models_dir = self.base_dir / "models"
        self.data_dir = self.base_dir / "data"
        self.users_dir = self.data_dir / "users"
        self.places_dir = self.data_dir / "places"
        self.recsys_dir = self.data_dir / "recsys"
        self.runtime_dir = self.base_dir / "runtime"
        self.uploads_dir = self.runtime_dir / "uploads"

        self.whisper_dir = self.models_dir / "whisper"
        self.whisper_assets_dir = self.whisper_dir / "assets"
        self.whisper_model_name = whisper_model_name
        self.whisper_model_path = self.whisper_dir / f"{whisper_model_name}.pt"
        self.whisper_download_root = self.whisper_dir

        self.extraction_dir = self.models_dir / "extraction"
        self.extraction_llm_dir = self.extraction_dir / "llm"

        self.embeddings_dir = self.models_dir / "embeddings"
        self.embeddings_cache_dir = self.embeddings_dir / "cache"
        self.embeddings_hf_home_dir = self.embeddings_dir / "hf_home"

        self.tts_dir = self.models_dir / "tts"
        self.tts_silero_dir = self.tts_dir / "silero"
        self.tts_qwen_dir = self.tts_dir / "qwen3_tts"
        self.tts_qwen_voice_design_dir = self.tts_qwen_dir / "voice_design_1_7b"
        self.tts_qwen_tokenizer_dir = self.tts_qwen_dir / "tokenizer_12hz"
        self.tts_hf_home_dir = self.tts_qwen_dir / "hf_home"
        self.tts_output_dir = self.tts_dir / "generated"
        self.tts_model_name = tts_model_name
        self.tts_model_path = self.tts_silero_dir / f"{tts_model_name}.pt"
        self.chromedriver_dir = self.models_dir / "chromedriver"
        self.chromedriver_path = self.chromedriver_dir / (
            "chromedriver.exe" if os.name == "nt" else "chromedriver"
        )

        self.food_csv_path = self.places_dir / "food.csv"
        self.hotels_csv_path = self.places_dir / "hotels.csv"
        self.locations_csv_path = self.places_dir / "locations.csv"
        self.weather_csv_path = self.places_dir / "weather.csv"
        self.wines_csv_path = self.places_dir / "wines_main.csv"
        self.scrapping_csv_path = self.places_dir / "scrapping.csv"
        self.scrapping_alt_csv_path = self.places_dir / "scrapping_alt.csv"

        self.user_01_base_csv_path = self.users_dir / "user_01_base.csv"
        self.user_02_detail_csv_path = self.users_dir / "user_02_detail.csv"
        self.user_base_csv_path = self.user_01_base_csv_path
        self.user_detail_csv_path = self.users_dir / "user_detail.csv"
        self.users_csv_path = self.users_dir / "users.csv"
        self.user_expanded_csv_path = self.users_dir / "user_expanded.csv"
        self.dialog_csv_path = self.users_dir / "dialog.csv"

        self.recsys_01_base_csv_path = self.recsys_dir / "recsys_01_base.csv"
        self.recsys_02_detail_csv_path = self.recsys_dir / "recsys_02_detail.csv"
        self.base_route_csv_path = self.recsys_dir / "base_route.csv"
        self.extended_route_csv_path = self.recsys_dir / "extended_route.csv"
        self.final_routes_csv_path = self.recsys_dir / "final_routes.csv"
        self.nearby_places_csv_path = self.recsys_dir / "nearby_places.csv"
        self.similar_places_csv_path = self.recsys_dir / "similar_places.csv"

    # Создание рабочих директорий
    def ensure_directories(self) -> None:
        self.users_dir.mkdir(parents=True, exist_ok=True)
        self.places_dir.mkdir(parents=True, exist_ok=True)
        self.recsys_dir.mkdir(parents=True, exist_ok=True)
        self.runtime_dir.mkdir(parents=True, exist_ok=True)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.whisper_dir.mkdir(parents=True, exist_ok=True)
        self.whisper_assets_dir.mkdir(parents=True, exist_ok=True)
        self.extraction_llm_dir.mkdir(parents=True, exist_ok=True)
        self.embeddings_cache_dir.mkdir(parents=True, exist_ok=True)
        self.embeddings_hf_home_dir.mkdir(parents=True, exist_ok=True)
        self.chromedriver_dir.mkdir(parents=True, exist_ok=True)
        self.tts_silero_dir.mkdir(parents=True, exist_ok=True)
        self.tts_qwen_voice_design_dir.mkdir(parents=True, exist_ok=True)
        self.tts_qwen_tokenizer_dir.mkdir(parents=True, exist_ok=True)
        self.tts_hf_home_dir.mkdir(parents=True, exist_ok=True)
        self.tts_output_dir.mkdir(parents=True, exist_ok=True)


class AudioConfig:
    """КОНФИГУРАЦИЯ ЗАПИСИ"""

    # Инициализация параметров записи
    def __init__(self) -> None:
        self.sample_rate = 48000
        self.channels = 1
        self.chunk_duration = 0.5
        self.chunk_samples = int(self.sample_rate * self.chunk_duration)
        self.silence_threshold = 0.01
        self.silence_limit = 1.5
        self.max_duration = 30
        self.pre_roll_duration = 0.5
        self.speech_confirm_chunks = 2
        self.min_speech_duration = 0.8


class FasterWhisperConfig:
    """КОНФИГУРАЦИЯ ASR"""

    # Инициализация параметров Faster-Whisper
    def __init__(self, model_name: str = "medium") -> None:
        self.model_name = model_name
        self.language = "ru"
        self.task = "transcribe"
        self.temperature = 0.0
        self.target_sample_rate = 16000
        self.beam_size = 5
        self.device = CUDAConfig.detect_device()
        self.compute_type = "float16" if self.device == "cuda" else "int8"
        self.cpu_threads = 4
        self.word_timestamps = True
        self.vad_filter = True
        self.no_speech_threshold = 0.45
        self.log_prob_threshold = -1.0
        self.compression_ratio_threshold = 2.4
        self.vad_threshold = 0.5
        self.vad_min_speech_duration_ms = 250
        self.vad_min_silence_duration_ms = 500
        self.vad_speech_pad_ms = 400


class WhisperConfig:
    """КОНФИГУРАЦИЯ WHISPER"""

    # Инициализация параметров OpenAI Whisper
    def __init__(self, model_name: str = "medium") -> None:
        self.model_name = model_name
        self.language = "ru"
        self.task = "transcribe"
        self.temperature = 0.0
        self.target_sample_rate = 16000
        self.beam_size = 5
        self.device = CUDAConfig.detect_device()
        self.fp16 = self.device == "cuda"
        self.live_update_interval = 3.0
        self.min_live_audio_seconds = 1.5


class ExtractionConfig:
    """КОНФИГУРАЦИЯ EXTRACTION"""

    # Инициализация параметров извлечения
    def __init__(self) -> None:
        self.enabled = True
        self.backend = "llama_cpp"
        self.device = CUDAConfig.detect_device()
        self.model_filename = "Qwen2.5-7B-Instruct-Q4_K_M.gguf"
        self.model_repo_id = "bartowski/Qwen2.5-7B-Instruct-GGUF"
        self.chat_format = "chatml"
        self.temperature = 0.0
        self.max_tokens = 768
        self.n_ctx = 8192
        self.n_gpu_layers = -1 if self.device == "cuda" else 0
        self.min_rule_confidence = 0.8


class WebSearchConfig:
    """КОНФИГУРАЦИЯ ВЕБ-ПОИСКА"""

    # Инициализация параметров веб-поиска
    def __init__(self) -> None:
        self.max_results = 5
        self.region = "ru-ru"
        self.timeout = 15
        self.search_queries_per_place = 2


class ScrapingConfig:
    """КОНФИГУРАЦИЯ СКРАПИНГА"""

    # Инициализация параметров скрапинга
    def __init__(self) -> None:
        self.source_url = "https://винодельни-россии.рф/krasnodar/"
        self.base_url = "https://винодельни-россии.рф"
        self.scrapping_alt_source_url = "https://tourist.wine/wineries/kuban"
        self.scrapping_alt_base_url = "https://tourist.wine"
        self.reverse_geocode_url = "https://nominatim.openstreetmap.org/reverse"
        self.user_agent = (
            "TurMurScraper/1.0 "
            "(+https://xn----ctbgencbaxrdig1aqa4p.xn--p1ai/krasnodar/)"
        )
        self.headless = False
        self.page_load_timeout = 30
        self.wait_timeout = 15
        self.scroll_pause_seconds = 0.6
        self.detail_pause_seconds = 0.3
        self.max_load_more_clicks = 10
        self.max_gallery_clicks = 30
        self.parallel_workers = 3
        self.geocode_enabled = True
        self.geocode_pause_seconds = 0.2


class EmbeddingConfig:
    """КОНФИГУРАЦИЯ ЭМБЕДДИНГОВ"""

    # Инициализация параметров эмбеддингов
    def __init__(self) -> None:
        self.model_name = "intfloat/multilingual-e5-base"
        self.device = CUDAConfig.detect_device()
        self.query_prefix = "query: "
        self.document_prefix = "passage: "
        self.top_k = 40
        self.nearby_top_k = 15
        self.batch_size = 16


class RankingConfig:
    """КОНФИГУРАЦИЯ РАНЖИРОВАНИЯ"""

    # Инициализация параметров ранжирования
    def __init__(self) -> None:
        self.semantic_weight = 0.30
        self.preference_weight = 0.20
        self.logistics_weight = 0.15
        self.family_weight = 0.10
        self.trust_weight = 0.10
        self.diversity_weight = 0.10
        self.weather_weight = 0.0


class RoutingConfig:
    """КОНФИГУРАЦИЯ МАРШРУТИЗАЦИИ"""

    # Инициализация параметров маршрута
    def __init__(self) -> None:
        self.route_variants = ("relaxed", "balanced", "dense")
        self.default_days_count = 2
        self.default_city_to = "Абрау-Дюрсо"
        self.default_budget_level = "средний"
        self.default_pace = "средний"
        self.default_trip_style = "город_плюс_окрестности"
        self.default_group_type = "пара"
        self.max_candidates_per_category = 10
        self.max_nearby_candidates = 5
        self.nearby_radius_km = 12.0
        self.average_speed_kmh = 35.0
        self.hotel_check_in_buffer_min = 60
        self.hotel_check_out_buffer_min = 45
        self.meal_duration_min = 90
        self.activity_duration_min = 120
        self.wine_duration_min = 120
        self.arrival_block_duration_min = 60
        self.departure_block_duration_min = 60
        self.day_start_minutes = 10 * 60
        self.day_end_minutes = 21 * 60 + 30
        self.relaxed_daily_activity_limit = 2
        self.balanced_daily_activity_limit = 3
        self.dense_daily_activity_limit = 4
        self.relaxed_daily_stop_limit = 3
        self.balanced_daily_stop_limit = 4
        self.dense_daily_stop_limit = 5
        self.max_daily_stops = 5
        self.max_food_stops_per_day = 2
        self.max_wine_stops_per_day = 1
        self.max_wine_stops_per_trip = 2
        self.max_daily_transition_candidates = 8
        self.default_transfer_minutes = 90
        self.use_or_tools = False


class CsvConfig:
    """КОНФИГУРАЦИЯ CSV"""

    # Инициализация параметров CSV
    def __init__(self) -> None:
        self.encoding = "utf-8-sig"
        self.delimiter = ","


class BackendCallbackConfig:
    """КОНФИГУРАЦИЯ CALLBACK В ОСНОВНОЙ БЕК"""

    # Инициализация callback-параметров
    def __init__(self) -> None:
        self.default_url = os.getenv("AVALIN_CALLBACK_URL", "").strip()
        self.timeout_seconds = int(os.getenv("AVALIN_CALLBACK_TIMEOUT", "30") or 30)
        self.file_field_name = os.getenv("AVALIN_CALLBACK_FILE_FIELD", "file").strip() or "file"
        self.user_id_field_name = os.getenv("AVALIN_CALLBACK_USER_ID_FIELD", "user_id").strip() or "user_id"
        self.stage_field_name = os.getenv("AVALIN_CALLBACK_STAGE_FIELD", "stage").strip() or "stage"
        self.session_id_field_name = os.getenv(
            "AVALIN_CALLBACK_SESSION_ID_FIELD",
            "session_id",
        ).strip() or "session_id"
        self.filename_field_name = os.getenv(
            "AVALIN_CALLBACK_FILENAME_FIELD",
            "filename",
        ).strip() or "filename"
        self.auth_header_name = os.getenv("AVALIN_CALLBACK_AUTH_HEADER", "").strip()
        self.auth_token = os.getenv("AVALIN_CALLBACK_AUTH_TOKEN", "").strip()


class DialogConfig:
    """КОНФИГУРАЦИЯ ДИАЛОГОВОГО МЕНЕДЖЕРА"""

    # Инициализация параметров диалога
    def __init__(self) -> None:
        self.max_history_turns = 10
        self.llm_max_tokens = 256
        self.llm_temperature = 0.7
        self.persona = "гид"
        self.add_time_context = True


class QwenTTSConfig:
    """КОНФИГУРАЦИЯ QWEN TTS"""

    # Инициализация параметров Qwen TTS
    def __init__(self) -> None:
        self.provider = "qwen3_tts"
        self.device = CUDAConfig.detect_device()
        self.model_repo_id = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
        self.tokenizer_repo_id = "Qwen/Qwen3-TTS-Tokenizer-12Hz"
        self.language = "Russian"
        self.output_filename = "tts_qwen_test.wav"
        self.test_text = "Винный камень - самый частый вид осадка в бутилированном вине. Выглядит как мелкие прозрачные или окрашенные кристаллы, похожие на сахар или песок. Это соли винной кислоты, которые выпадают в осадок при понижении температуры или длительном хранении. Он абсолютно безвреден и не портит вкус."
        self.voice_instruct = (
            "A mature adult Russian female voice, 30-35 years old, with an elegant 'onee-san' anime archetype feel. "
            "Sensual, alluring, self-assured, and calm. "
            "Soft low-to-mid register, velvety tone, subtle breathiness, smooth and intimate phrasing. "
            "Clear diction, controlled emotion, natural expressiveness, moderate pace. "
            "Refined, warm, slightly teasing delivery without sounding fake or overly theatrical. "
            "Never childish, never shrill, never robotic."
        )
        self.max_new_tokens = 2048
        self.temperature = 0.8
        self.do_sample = True
        self.playback_blocking = True


class RecommenderConfig:
    """КОНФИГУРАЦИЯ РЕКОМЕНДАТЕЛЬНОЙ СИСТЕМЫ"""

    # Инициализация параметров рекомендаций
    def __init__(self) -> None:
        self.nearby_radius_km = 25.0
        self.average_speed_kmh = 35.0

        self.days_mapping: dict[str, int] = {
            "1-2 дня (выходные)": 2,
            "3-4 дня": 4,
            "5-7 дней": 7,
        }

        self.budget_daily_thresholds: list[tuple[int, str]] = [
            (5000, "низкий"),
            (15000, "средний"),
        ]
        self.budget_default_level = "высокий"
        self.hotel_budget_share = 0.45
        self.food_budget_share = 0.15

        self.group_hard_filters: dict[str, dict[str, bool]] = {
            "один": {},
            "парой": {},
            "семьей": {"family_friendly": True, "kids_friendly": True},
            "компанией": {},
        }

        self.w_theme = 0.35
        self.w_dist = 0.25
        self.w_rate = 0.15
        self.w_div = 0.15
        self.w_budget = 0.10

        self.group_themes: dict[str, dict[str, float]] = {
            "один": {
                "тишина": 0.8, "природа": 0.7, "культура": 0.6,
                "эко": 0.5, "архитектура": 0.4,
            },
            "парой": {
                "романтика": 0.9, "виды": 0.8, "панорама": 0.7,
                "тишина": 0.5, "фото": 0.4,
            },
            "семьей": {
                "семья": 0.9, "пляж": 0.8, "парк": 0.7,
                "ферма": 0.6, "перезагрузка": 0.5,
            },
            "компанией": {
                "отдых": 0.7, "море": 0.7, "гастрономия": 0.6,
                "эко": 0.5, "пляж": 0.4,
            },
        }

        self.activity_themes: dict[str, dict[str, float]] = {
            "спокойный": {
                "прогулка": 0.8, "отдых": 0.7, "виды": 0.6,
                "тишина": 0.5, "природа": 0.4,
            },
            "активный": {
                "море": 0.8, "пляж": 0.7, "экскурсия": 0.6,
                "спорт": 0.5, "поход": 0.4,
            },
        }

        self.season_themes: dict[str, dict[str, float]] = {
            "лето": {"пляж": 0.9, "море": 0.8, "природа": 0.6, "эко": 0.4},
            "зима": {"культура": 0.8, "история": 0.7, "архитектура": 0.6, "экспозиция": 0.5},
            "весна": {"природа": 0.7, "парк": 0.6, "виды": 0.5, "прогулка": 0.4},
            "осень": {"природа": 0.7, "парк": 0.6, "виды": 0.5, "культура": 0.4},
        }

        self.season_to_seasonality: dict[str, set[str]] = {
            "зима": {"круглый_год", "зима"},
            "весна": {"круглый_год", "весна", "не_зимой"},
            "лето": {"круглый_год", "лето", "не_зимой"},
            "осень": {"круглый_год", "осень", "не_зимой"},
        }

        self.max_same_type_per_day = 1
        self.max_stops_per_day = 5
        self.max_stops_per_trip = 8

        self.day1_slots: list[dict[str, Any]] = [
            {
                "name": "outdoor",
                "stop_type": "activity",
                "allowed_sources": {"locations"},
                "allowed_types": {
                    "природная_локация", "парк", "смотровая_площадка",
                    "эко-локация",
                },
            },
            {
                "name": "culture",
                "stop_type": "activity",
                "allowed_sources": {"locations"},
                "allowed_types": {
                    "музей", "культурная_точка", "ферма",
                    "оздоровительный_объект",
                },
            },
            {
                "name": "lunch",
                "stop_type": "food",
                "allowed_sources": {"food"},
                "allowed_types": {
                    "кафе", "ресторан", "столовая", "кофейня", "гастро_бар",
                },
            },
            {
                "name": "closing",
                "stop_type": "evening",
                "allowed_sources": {"food", "wines", "locations"},
                "allowed_types": {
                    "ресторан", "гастро_бар", "бар", "кафе",
                    "винодельня",
                    "смотровая_площадка", "парк",
                },
                "optional": True,
            },
        ]

        self.day2_slots: list[dict[str, Any]] = [
            {
                "name": "culture_first",
                "stop_type": "activity",
                "allowed_sources": {"locations"},
                "allowed_types": {
                    "музей", "культурная_точка", "ферма",
                    "оздоровительный_объект", "парк",
                },
            },
            {
                "name": "outdoor",
                "stop_type": "activity",
                "allowed_sources": {"locations"},
                "allowed_types": {
                    "природная_локация", "эко-локация",
                    "смотровая_площадка", "парк",
                },
            },
            {
                "name": "lunch",
                "stop_type": "food",
                "allowed_sources": {"food"},
                "allowed_types": {
                    "кафе", "ресторан", "столовая", "кофейня",
                },
            },
            {
                "name": "afternoon",
                "stop_type": "activity",
                "allowed_sources": {"locations"},
                "allowed_types": {
                    "парк", "природная_локация", "эко-локация",
                    "культурная_точка", "ферма",
                },
            },
            {
                "name": "closing",
                "stop_type": "evening",
                "allowed_sources": {"food", "wines", "locations"},
                "allowed_types": {
                    "ресторан", "гастро_бар", "бар",
                    "винодельня", "смотровая_площадка",
                },
                "optional": True,
            },
        ]


class QuizRouteServiceConfig:
    """КОНФИГУРАЦИЯ QUIZ ROUTE API (POSTGRES)"""

    # Инициализация DSN и опционального Bearer
    def __init__(self) -> None:
        self.database_url = os.getenv("DATABASE_URL", "").strip()
        self.api_bearer_token = os.getenv("QUIZ_ROUTE_API_TOKEN", "").strip()
        self.target_p95_seconds = int(os.getenv("QUIZ_ROUTE_P95_TARGET_SEC", "10") or 10)
