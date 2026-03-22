from __future__ import annotations

import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.ml_core.asr import WhisperSpeechTranscriber


class TranscriptionService:
    """СЕРВИС ТРАНСКРИБАЦИИ"""

    # Инициализация сервиса транскрибации
    def __init__(self) -> None:
        self.transcriber = WhisperSpeechTranscriber()

    # Транскрибация с микрофона
    def transcribe_microphone(self) -> dict[str, Any]:
        return self.transcriber.record_and_transcribe_result()

    # Транскрибация аудиофайла
    def transcribe_file(self, audio_path: str | Path) -> dict[str, Any]:
        return self.transcriber.transcribe_file(audio_path)

    # Унифицированный вход сервиса
    def transcribe_input(
        self,
        input_type: str,
        text: str = "",
        audio_path: str | Path | None = None,
    ) -> dict[str, Any]:
        if input_type == "text":
            return {
                "transcript": text.strip(),
                "language": "ru",
                "language_probability": 1.0,
                "duration_seconds": 0.0,
                "segments": [],
                "word_timestamps": [],
                "confidence": 1.0,
            }

        if input_type == "audio" and audio_path is not None:
            return self.transcribe_file(audio_path)

        raise ValueError("Ожидается input_type 'text' или 'audio'.")

from app.services.transcription import TranscriptionService

# Запуск
if __name__ == "__main__":
    print(TranscriptionService().__class__.__name__)
