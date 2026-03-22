from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from llama_cpp import Llama


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import DialogConfig, ExtractionConfig, PathConfig
from app.db_connector.models import CsvDataContract
from app.db_connector.session import CsvSession
from app.ml_core.asr import WhisperSpeechTranscriber
from app.ml_core.tss import QwenSpeechSynthesizer
from app.services.promting import PromptRouting


class DialogManager:
    """ДИАЛОГОВЫЙ МЕНЕДЖЕР ГОЛОСОВОГО ГИДА"""

    # Инициализация менеджера
    def __init__(self, session_id: str = "") -> None:
        self.dialog_cfg = DialogConfig()
        self.extract_cfg = ExtractionConfig()
        self.paths = PathConfig()
        self.paths.ensure_directories()
        self.local_llm_path = (
            self.paths.extraction_llm_dir / "Qwen2.5-7B-Instruct-Q4_K_M.gguf"
        )

        self.contract = CsvDataContract()
        self.csv_session = CsvSession()
        self.prompt_routing = PromptRouting()

        self.session_id = session_id or f"sess_{uuid4().hex[:12]}"
        self.dialog_id = f"dlg_{uuid4().hex[:12]}"
        self.history: list[tuple[str, str]] = []
        self.turn_counter = 0

        self._asr: WhisperSpeechTranscriber | None = None
        self._tts: QwenSpeechSynthesizer | None = None
        self._llm: Llama | None = None

    # Ленивая загрузка ASR
    def _get_asr(self) -> WhisperSpeechTranscriber:
        if self._asr is None:
            self._asr = WhisperSpeechTranscriber()
        return self._asr

    # Ленивая загрузка TTS
    def _get_tts(self) -> QwenSpeechSynthesizer:
        if self._tts is None:
            self._tts = QwenSpeechSynthesizer()
        return self._tts

    # Проверка локальной GGUF-модели
    def _ensure_llm_model(self) -> Path:
        if self.local_llm_path.exists():
            return self.local_llm_path

        raise FileNotFoundError(
            "Локальная модель не найдена: "
            f"{self.local_llm_path}. Сервис не использует интернет для загрузки."
        )

    # Ленивая загрузка LLM
    def _get_llm(self) -> Llama:
        if self._llm is not None:
            return self._llm

        model_path = self._ensure_llm_model()
        self._llm = Llama(
            model_path=str(model_path),
            chat_format=self.extract_cfg.chat_format,
            n_ctx=self.extract_cfg.n_ctx,
            n_gpu_layers=self.extract_cfg.n_gpu_layers,
            verbose=False,
        )
        return self._llm

    # Определение названия места из текста пользователя
    def _detect_place_name(self, user_text: str) -> str:
        place_keywords = (
            "расскажи про", "расскажи о", "что такое",
            "а что там в", "что за место", "покажи",
            "хочу узнать про", "расскажи подробнее про",
        )
        lower = user_text.lower().strip()
        for keyword in place_keywords:
            if keyword in lower:
                idx = lower.index(keyword) + len(keyword)
                candidate = user_text[idx:].strip().strip("?.,!«»\"'")
                if len(candidate) >= 3:
                    return candidate
        return ""

    # Веб-поиск отключен
    def _fetch_web_context(self, user_text: str) -> str:
        return ""

    # Генерация ответа через LLM
    def _generate_response(self, user_text: str, use_web: bool = False) -> str:
        trimmed_history = self.history[-self.dialog_cfg.max_history_turns :]

        web_context = ""
        if use_web:
            web_context = self._fetch_web_context(user_text)

        if web_context:
            messages = self.prompt_routing.build_messages_with_context(
                user_input=user_text,
                web_context=web_context,
                history=trimmed_history,
                persona=self.dialog_cfg.persona,
                add_time_context=self.dialog_cfg.add_time_context,
            )
        else:
            messages = self.prompt_routing.build_messages(
                user_input=user_text,
                history=trimmed_history,
                persona=self.dialog_cfg.persona,
                add_time_context=self.dialog_cfg.add_time_context,
            )

        llm = self._get_llm()
        result = llm.create_chat_completion(
            messages=messages,
            temperature=self.dialog_cfg.llm_temperature,
            max_tokens=self.dialog_cfg.llm_max_tokens,
        )

        content = result["choices"][0]["message"]["content"]
        return content.strip() if content else ""

    # Генерация продающего рассказа о месте
    def present_place(
        self,
        place_name: str,
        place_type: str = "",
        city: str = "",
        user_preferences: str = "",
    ) -> str:
        print(f"[dialog] Подготовка презентации: {place_name}")
        place_context = [
            f"Расскажи про место: {place_name}.",
        ]
        if place_type:
            place_context.append(f"Тип места: {place_type}.")
        if city:
            place_context.append(f"Город: {city}.")
        if user_preferences:
            place_context.append(f"Предпочтения путешественника: {user_preferences}.")
        place_context.append(
            "Не используй интернет и не выдумывай факты. "
            "Если информации недостаточно, честно скажи об этом."
        )
        messages = self.prompt_routing.build_messages(
            user_input=" ".join(place_context),
            history=None,
            persona=self.dialog_cfg.persona,
            add_time_context=self.dialog_cfg.add_time_context,
        )

        llm = self._get_llm()
        result = llm.create_chat_completion(
            messages=messages,
            temperature=self.dialog_cfg.llm_temperature,
            max_tokens=self.dialog_cfg.llm_max_tokens,
        )

        content = result["choices"][0]["message"]["content"]
        return content.strip() if content else ""

    # Сохранение реплики в dialog.csv
    def _save_turn(
        self,
        role: str,
        text: str,
        audio_path: str = "",
        duration_seconds: float = 0.0,
        confidence: float = 0.0,
    ) -> None:
        self.turn_counter += 1
        row = {
            "dialog_id": self.dialog_id,
            "session_id": self.session_id,
            "turn_id": self.turn_counter,
            "role": role,
            "text": text,
            "audio_path": audio_path,
            "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            "duration_seconds": round(duration_seconds, 3),
            "confidence": round(confidence, 4),
        }
        self.csv_session.append_rows(
            self.paths.dialog_csv_path,
            self.contract.dialog_columns,
            [row],
        )

    # Сохранение сырого текста в raw/users.csv
    def _save_raw_text(self, raw_text: str) -> None:
        row = {
            "request_id": f"req_{uuid4().hex[:12]}",
            "session_id": self.session_id,
            "raw_text": raw_text,
            "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        }
        self.csv_session.append_rows(
            self.paths.users_csv_path,
            self.contract.raw_users_columns,
            [row],
        )

    # Озвучка текста через TTS
    def _speak(self, text: str) -> Path:
        tts = self._get_tts()
        tts.tts_cfg.test_text = text
        return tts.synthesize_and_play()

    # Один полный ход диалога: голос → текст → LLM → ответ → озвучка
    def process_voice_turn(self) -> dict[str, Any]:
        asr = self._get_asr()
        asr_result = asr.record_and_transcribe_result()
        user_text = asr_result.get("transcript", "")
        confidence = asr_result.get("confidence", 0.0)
        duration = asr_result.get("duration_seconds", 0.0)

        if not user_text or user_text == "(речь не распознана)":
            print("[dialog] Речь не распознана, повторите.")
            return {"user_text": "", "assistant_text": "", "status": "no_speech"}

        print(f"[dialog] Пользователь: {user_text}")
        self._save_raw_text(user_text)
        self._save_turn("user", user_text, duration_seconds=duration, confidence=confidence)

        print("[dialog] Генерация ответа...")
        assistant_text = self._generate_response(user_text)
        print(f"[dialog] Гид: {assistant_text}")
        self._save_turn("assistant", assistant_text)

        self.history.append((user_text, assistant_text))

        print("[dialog] Озвучивание...")
        audio_path = self._speak(assistant_text)
        print(f"[dialog] Аудио: {audio_path}")

        return {
            "user_text": user_text,
            "assistant_text": assistant_text,
            "audio_path": str(audio_path),
            "status": "ok",
        }

    # Текстовый ход диалога без голоса (для тестирования)
    def process_text_turn(self, user_text: str) -> dict[str, Any]:
        print(f"[dialog] Пользователь: {user_text}")
        self._save_raw_text(user_text)
        self._save_turn("user", user_text)

        print("[dialog] Генерация ответа...")
        assistant_text = self._generate_response(user_text)
        print(f"[dialog] Гид: {assistant_text}")
        self._save_turn("assistant", assistant_text)

        self.history.append((user_text, assistant_text))

        return {
            "user_text": user_text,
            "assistant_text": assistant_text,
            "status": "ok",
        }

    # Текстовый ход + озвучка
    def process_text_turn_with_voice(self, user_text: str) -> dict[str, Any]:
        result = self.process_text_turn(user_text)
        if result["status"] == "ok":
            print("[dialog] Озвучивание...")
            audio_path = self._speak(result["assistant_text"])
            result["audio_path"] = str(audio_path)
            print(f"[dialog] Аудио: {audio_path}")
        return result

    # Интерактивный голосовой цикл диалога
    def run_voice_loop(self, max_turns: int = 20) -> None:
        print(f"[dialog] Сессия: {self.session_id}")
        print(f"[dialog] Диалог: {self.dialog_id}")
        print("[dialog] Начинаю голосовой диалог. Скажите 'стоп' или 'выход' для завершения.\n")

        for _ in range(max_turns):
            result = self.process_voice_turn()
            if result["status"] == "no_speech":
                continue

            user_lower = result["user_text"].lower().strip()
            if user_lower in ("стоп", "выход", "хватит", "пока", "до свидания"):
                print("[dialog] Завершение диалога.")
                break

            print()

    # Интерактивный текстовый цикл (для тестирования без микрофона)
    def run_text_loop(self, with_voice: bool = False) -> None:
        print(f"[dialog] Сессия: {self.session_id}")
        print(f"[dialog] Диалог: {self.dialog_id}")
        print("[dialog] Текстовый режим. Введите 'выход' для завершения.\n")

        while True:
            user_input = input("[вы] > ").strip()
            if not user_input:
                continue
            if user_input.lower() in ("стоп", "выход", "хватит", "пока", "до свидания"):
                print("[dialog] Завершение диалога.")
                break

            if with_voice:
                self.process_text_turn_with_voice(user_input)
            else:
                self.process_text_turn(user_input)
            print()


from app.services.dialog_manager import DialogManager

# Запуск
if __name__ == "__main__":
    dm = DialogManager()
    dm.run_text_loop(with_voice=False)
