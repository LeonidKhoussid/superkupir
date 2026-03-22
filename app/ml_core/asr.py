from __future__ import annotations

import sys
import time
import threading
import numpy as np
import sounddevice as sd
import whisper

from collections import deque
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import AudioConfig, CUDAConfig, PathConfig, WhisperConfig
from app.db_connector.models import CsvDataContract


class WhisperSpeechTranscriber:
    """ТРАНСКРИБАЦИЯ РЕЧИ WHISPER"""

    # Инициализация конфигурации и модели
    def __init__(self) -> None:
        self.cuda_cfg = CUDAConfig()
        self.cuda_cfg.apply()

        self.audio_cfg = AudioConfig()
        self.asr_cfg = WhisperConfig()
        self.paths = PathConfig(whisper_model_name=self.asr_cfg.model_name)
        self.paths.ensure_directories()
        self.contract = CsvDataContract()

        self.model_source = self._resolve_model_source()
        self.model = self._load_model()

        self._live_text = ""
        self._live_lock = threading.Lock()

    # Расчет RMS громкости
    @staticmethod
    def _rms(chunk: np.ndarray) -> float:
        return float(np.sqrt(np.mean(np.square(chunk), dtype=np.float64)))

    # Ресемплинг аудио без внешних зависимостей
    @staticmethod
    def _resample_audio(
        audio: np.ndarray,
        source_rate: int,
        target_rate: int,
    ) -> np.ndarray:
        if source_rate == target_rate:
            return audio.astype(np.float32, copy=False)

        if audio.size == 0:
            return np.zeros(0, dtype=np.float32)

        source_positions = np.arange(audio.shape[0], dtype=np.float64)
        target_length = max(1, int(round(audio.shape[0] * target_rate / source_rate)))
        target_positions = np.linspace(
            0,
            audio.shape[0] - 1,
            num=target_length,
            dtype=np.float64,
        )
        return np.interp(target_positions, source_positions, audio).astype(np.float32)

    # Определение пикового значения сигнала
    @staticmethod
    def _peak(chunk: np.ndarray) -> float:
        if chunk.size == 0:
            return 0.0
        return float(np.max(np.abs(chunk)))

    # Нормализация амплитуды аудио
    @classmethod
    def _normalize_audio(cls, audio: np.ndarray) -> np.ndarray:
        if audio.size == 0:
            return np.zeros(0, dtype=np.float32)

        centered = audio.astype(np.float32, copy=False) - float(
            np.mean(audio, dtype=np.float64)
        )
        peak = cls._peak(centered)
        if peak <= 1e-6:
            return centered.astype(np.float32, copy=False)

        normalized = centered / peak
        return np.clip(normalized * 0.95, -1.0, 1.0).astype(np.float32)

    # Нормализация текста
    @staticmethod
    def _normalize_text(text: str) -> str:
        return " ".join(text.split())

    # Определение локального источника модели
    def _resolve_model_source(self) -> str:
        if self.paths.whisper_model_path.exists():
            return str(self.paths.whisper_model_path)
        legacy_path = self.paths.whisper_dir / f"{self.asr_cfg.model_name}.pt"
        if legacy_path.exists():
            return str(legacy_path)
        return self.asr_cfg.model_name

    # Загрузка Whisper модели
    def _load_model(self) -> whisper.Whisper:
        print(f"ASR device: {self.asr_cfg.device}")
        print(f"ASR source: {self.model_source}")
        return whisper.load_model(
            self.model_source,
            device=self.asr_cfg.device,
            download_root=str(self.paths.whisper_download_root),
        )

    # Копия аудиочанков
    @staticmethod
    def _copy_audio(chunks: list[np.ndarray]) -> np.ndarray:
        if not chunks:
            return np.zeros(0, dtype=np.float32)
        return np.concatenate(chunks).astype(np.float32, copy=False)

    # Обрезка тишины по краям записи
    def _trim_silence(self, audio_48khz: np.ndarray) -> np.ndarray:
        if audio_48khz.size == 0:
            return audio_48khz

        window_samples = max(1, int(self.audio_cfg.sample_rate * 0.05))
        threshold = max(self.audio_cfg.silence_threshold * 0.5, 0.003)
        energies: list[float] = []
        for start in range(0, audio_48khz.shape[0], window_samples):
            frame = audio_48khz[start : start + window_samples]
            energies.append(self._rms(frame))

        active_indices = [index for index, energy in enumerate(energies) if energy >= threshold]
        if not active_indices:
            return audio_48khz

        left_pad = int(self.audio_cfg.sample_rate * 0.2)
        right_pad = int(self.audio_cfg.sample_rate * 0.35)
        start_sample = max(0, active_indices[0] * window_samples - left_pad)
        end_sample = min(
            audio_48khz.shape[0],
            (active_indices[-1] + 1) * window_samples + right_pad,
        )
        return audio_48khz[start_sample:end_sample]

    # Декодирование 30-секундного окна через Whisper
    def _decode_30s_window(self, audio_16khz: np.ndarray) -> str:
        if audio_16khz.size == 0:
            return ""
        padded = whisper.pad_or_trim(audio_16khz)
        mel = whisper.log_mel_spectrogram(padded, n_mels=self.model.dims.n_mels).to(
            self.model.device
        )
        options = whisper.DecodingOptions(
            language=self.asr_cfg.language,
            task=self.asr_cfg.task,
            fp16=self.asr_cfg.fp16,
            temperature=self.asr_cfg.temperature,
            beam_size=self.asr_cfg.beam_size,
        )
        result = whisper.decode(self.model, mel, options)
        return self._normalize_text(result.text)

    # Подготовка аудио к ASR
    def _prepare_audio_for_asr(self, audio_48khz: np.ndarray) -> np.ndarray:
        if audio_48khz.size == 0:
            return np.zeros(0, dtype=np.float32)

        trimmed_audio = self._trim_silence(audio_48khz)
        normalized_audio = self._normalize_audio(trimmed_audio)
        return self._resample_audio(
            normalized_audio,
            source_rate=self.audio_cfg.sample_rate,
            target_rate=self.asr_cfg.target_sample_rate,
        )

    # Извлечение текста из результата model.transcribe
    @staticmethod
    def _extract_text_from_result(result: dict[str, Any]) -> str:
        return " ".join(
            segment.get("text", "").strip()
            for segment in result.get("segments", [])
        ).strip()

    # Транскрибация подготовленного массива (полный конвейер)
    def transcribe_array(self, audio_48khz: np.ndarray) -> dict[str, Any]:
        audio_16khz = self._prepare_audio_for_asr(audio_48khz)
        if audio_16khz.size == 0:
            return self.contract.create_transcript_result()

        result = self.model.transcribe(
            audio_16khz,
            language=self.asr_cfg.language,
            task=self.asr_cfg.task,
            fp16=self.asr_cfg.fp16,
            temperature=self.asr_cfg.temperature,
            beam_size=self.asr_cfg.beam_size,
        )

        transcript = self._normalize_text(self._extract_text_from_result(result))
        segments = result.get("segments", [])
        language = result.get("language", "")

        serialized_segments: list[dict[str, Any]] = []
        word_timestamps: list[dict[str, Any]] = []
        for seg in segments:
            serialized_segments.append({
                "id": seg.get("id", 0),
                "start": round(float(seg.get("start", 0.0)), 3),
                "end": round(float(seg.get("end", 0.0)), 3),
                "text": self._normalize_text(seg.get("text", "")),
                "avg_logprob": round(float(seg.get("avg_logprob", 0.0)), 4),
                "no_speech_prob": round(float(seg.get("no_speech_prob", 0.0)), 4),
                "words": [],
            })

        probabilities: list[float] = []
        for seg in segments:
            no_speech = float(seg.get("no_speech_prob", 0.0))
            probabilities.append(max(0.0, 1.0 - no_speech))
        confidence = round(float(np.mean(probabilities)), 4) if probabilities else 0.0

        out = self.contract.create_transcript_result()
        out.update({
            "transcript": transcript,
            "language": language,
            "language_probability": 1.0,
            "duration_seconds": round(float(segments[-1]["end"]), 3) if segments else 0.0,
            "segments": serialized_segments,
            "word_timestamps": word_timestamps,
            "confidence": confidence,
        })
        return out

    # Транскрибация аудиофайла
    def transcribe_file(self, audio_path: str | Path) -> dict[str, Any]:
        result = self.model.transcribe(
            str(audio_path),
            language=self.asr_cfg.language,
            task=self.asr_cfg.task,
            fp16=self.asr_cfg.fp16,
            temperature=self.asr_cfg.temperature,
            beam_size=self.asr_cfg.beam_size,
        )
        transcript = self._normalize_text(self._extract_text_from_result(result))

        out = self.contract.create_transcript_result()
        out.update({
            "transcript": transcript,
            "language": result.get("language", ""),
            "language_probability": 1.0,
            "duration_seconds": 0.0,
            "segments": [],
            "word_timestamps": [],
            "confidence": 1.0,
        })
        return out

    # Live-транскрибация в фоновом потоке
    def _transcribe_preview_array(self, chunks: list[np.ndarray]) -> None:
        audio_48khz = self._copy_audio(chunks)
        audio_16khz = self._prepare_audio_for_asr(audio_48khz)
        if audio_16khz.size == 0:
            return
        text = self._decode_30s_window(audio_16khz)
        with self._live_lock:
            self._live_text = text

    # Вывод live-текста
    def _render_live_text(self) -> None:
        with self._live_lock:
            text = self._live_text
        if text:
            print(f"\r[live] {text}", end="", flush=True)

    # Фоновый поток live-транскрибации
    def _live_transcribe_worker(
        self,
        chunks_ref: list[np.ndarray],
        stop_event: threading.Event,
    ) -> None:
        last_processed_count = 0
        while not stop_event.is_set():
            stop_event.wait(self.asr_cfg.live_update_interval)

            current_count = len(chunks_ref)
            audio_seconds = (
                current_count
                * self.audio_cfg.chunk_samples
                / self.audio_cfg.sample_rate
            )
            if current_count > last_processed_count and audio_seconds >= self.asr_cfg.min_live_audio_seconds:
                last_processed_count = current_count
                snapshot = list(chunks_ref)
                self._transcribe_preview_array(snapshot)
                self._render_live_text()

    # Запись голоса с микрофона
    def record_audio(self) -> np.ndarray:
        print("Говорите. Запись завершится после тишины.")

        audio_chunks: list[np.ndarray] = []
        speech_started = False
        silence_duration = 0.0
        speech_duration = 0.0
        started_at = time.monotonic()
        voiced_streak = 0
        pre_roll_max_chunks = max(
            1,
            int(round(self.audio_cfg.pre_roll_duration / self.audio_cfg.chunk_duration)),
        )
        pre_roll_chunks: deque[np.ndarray] = deque(maxlen=pre_roll_max_chunks)

        with sd.InputStream(
            samplerate=self.audio_cfg.sample_rate,
            channels=self.audio_cfg.channels,
            dtype="float32",
        ) as stream:
            while True:
                frames, _ = stream.read(self.audio_cfg.chunk_samples)
                chunk = np.asarray(frames[:, 0], dtype=np.float32).copy()
                chunk_rms = self._rms(chunk)
                elapsed = time.monotonic() - started_at
                is_voiced = chunk_rms >= self.audio_cfg.silence_threshold

                if not speech_started:
                    pre_roll_chunks.append(chunk)
                    voiced_streak = voiced_streak + 1 if is_voiced else 0
                    if voiced_streak >= self.audio_cfg.speech_confirm_chunks:
                        speech_started = True
                        audio_chunks.extend(list(pre_roll_chunks))
                        pre_roll_chunks.clear()
                    elif elapsed >= self.audio_cfg.max_duration:
                        break
                    continue

                audio_chunks.append(chunk)
                if is_voiced:
                    silence_duration = 0.0
                    speech_duration += self.audio_cfg.chunk_duration
                else:
                    silence_duration += self.audio_cfg.chunk_duration

                if (
                    speech_duration >= self.audio_cfg.min_speech_duration
                    and silence_duration >= self.audio_cfg.silence_limit
                ):
                    break

                if elapsed >= self.audio_cfg.max_duration:
                    break

        if not audio_chunks:
            return np.zeros(0, dtype=np.float32)
        return np.concatenate(audio_chunks).astype(np.float32, copy=False)

    # Запись голоса и структурированная расшифровка
    def record_and_transcribe_result(self) -> dict[str, Any]:
        audio_chunks: list[np.ndarray] = []
        stop_event = threading.Event()

        live_thread = threading.Thread(
            target=self._live_transcribe_worker,
            args=(audio_chunks, stop_event),
            daemon=True,
        )
        live_thread.start()

        speech_started = False
        silence_duration = 0.0
        speech_duration = 0.0
        started_at = time.monotonic()
        voiced_streak = 0
        pre_roll_max_chunks = max(
            1,
            int(round(self.audio_cfg.pre_roll_duration / self.audio_cfg.chunk_duration)),
        )
        pre_roll_chunks: deque[np.ndarray] = deque(maxlen=pre_roll_max_chunks)

        print("Говорите. Запись завершится после тишины.")

        with sd.InputStream(
            samplerate=self.audio_cfg.sample_rate,
            channels=self.audio_cfg.channels,
            dtype="float32",
        ) as stream:
            while True:
                frames, _ = stream.read(self.audio_cfg.chunk_samples)
                chunk = np.asarray(frames[:, 0], dtype=np.float32).copy()
                chunk_rms = self._rms(chunk)
                elapsed = time.monotonic() - started_at
                is_voiced = chunk_rms >= self.audio_cfg.silence_threshold

                if not speech_started:
                    pre_roll_chunks.append(chunk)
                    voiced_streak = voiced_streak + 1 if is_voiced else 0
                    if voiced_streak >= self.audio_cfg.speech_confirm_chunks:
                        speech_started = True
                        audio_chunks.extend(list(pre_roll_chunks))
                        pre_roll_chunks.clear()
                    elif elapsed >= self.audio_cfg.max_duration:
                        break
                    continue

                audio_chunks.append(chunk)
                if is_voiced:
                    silence_duration = 0.0
                    speech_duration += self.audio_cfg.chunk_duration
                else:
                    silence_duration += self.audio_cfg.chunk_duration

                if (
                    speech_duration >= self.audio_cfg.min_speech_duration
                    and silence_duration >= self.audio_cfg.silence_limit
                ):
                    break

                if elapsed >= self.audio_cfg.max_duration:
                    break

        stop_event.set()
        live_thread.join(timeout=5.0)

        audio = self._copy_audio(audio_chunks)
        result = self.transcribe_array(audio)
        final_text = result.get("transcript") or "(речь не распознана)"
        print(f"\n[final] {final_text}")
        return result

    # Запись голоса и возврат только текста
    def record_and_transcribe(self) -> str:
        return str(self.record_and_transcribe_result().get("transcript", ""))

from app.ml_core.asr import WhisperSpeechTranscriber

# Запуск
if __name__ == "__main__":
    print(WhisperSpeechTranscriber().record_and_transcribe())

