from __future__ import annotations

import os
import sys
import wave
import torch
import numpy as np
from pathlib import Path
import sounddevice as sd
from qwen_tts import Qwen3TTSModel
from huggingface_hub import snapshot_download


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import CUDAConfig, PathConfig, QwenTTSConfig


class QwenSpeechSynthesizer:
    """СИНТЕЗ РЕЧИ QWEN"""

    # Инициализация TTS-модуля
    def __init__(self) -> None:
        self.cuda_cfg = CUDAConfig()
        self.cuda_cfg.apply()

        self.tts_cfg = QwenTTSConfig()
        self.paths = PathConfig()
        self.paths.ensure_directories()

        self.device = self._resolve_device()
        self.dtype = self._resolve_dtype()
        self._configure_huggingface_paths()
        self.model_path = self._ensure_model_directory()
        self.model = self._load_model()
        self.output_path = self.paths.tts_output_dir / self.tts_cfg.output_filename

    # Определение устройства инференса
    def _resolve_device(self) -> str:
        if self.tts_cfg.device == "cuda":
            return "cuda:0"
        return "cpu"

    # Подбор dtype для инференса
    def _resolve_dtype(self):
        if self.tts_cfg.device != "cuda":
            return torch.float32

        if hasattr(torch.cuda, "is_bf16_supported") and torch.cuda.is_bf16_supported():
            return torch.bfloat16
        return torch.float16

    # Настройка локального Hugging Face-кэша
    def _configure_huggingface_paths(self) -> None:
        os.environ.setdefault("HF_HOME", str(self.paths.tts_hf_home_dir))
        os.environ.setdefault(
            "HUGGINGFACE_HUB_CACHE",
            str(self.paths.tts_hf_home_dir / "hub"),
        )
        os.environ.setdefault(
            "TRANSFORMERS_CACHE",
            str(self.paths.tts_hf_home_dir / "transformers"),
        )

    # Проверка наличия файлов весов модели
    @staticmethod
    def _has_model_weights(path: Path) -> bool:
        if not path.exists():
            return False

        for pattern in ("*.safetensors", "*.bin", "*.pt"):
            if any(path.glob(pattern)):
                return True
        return False

    # Загрузка модели и токенайзера в models
    def _ensure_model_directory(self) -> Path:
        snapshot_download(
            repo_id=self.tts_cfg.tokenizer_repo_id,
            cache_dir=str(self.paths.tts_hf_home_dir),
        )

        if not self._has_model_weights(self.paths.tts_qwen_voice_design_dir):
            snapshot_download(
                repo_id=self.tts_cfg.model_repo_id,
                local_dir=str(self.paths.tts_qwen_voice_design_dir),
            )
        return self.paths.tts_qwen_voice_design_dir

    # Загрузка модели Qwen
    def _load_model(self):
        return Qwen3TTSModel.from_pretrained(
            str(self.model_path),
            device_map=self.device,
            dtype=self.dtype,
            attn_implementation="sdpa",
        )

    # Преобразование сгенерированного аудио в numpy
    @staticmethod
    def _to_numpy_audio(audio: torch.Tensor | np.ndarray | list[float]) -> np.ndarray:
        if isinstance(audio, torch.Tensor):
            audio = audio.detach().cpu().numpy()

        audio_array = np.asarray(audio, dtype=np.float32)
        if audio_array.ndim > 1:
            audio_array = audio_array.reshape(-1)
        return np.clip(audio_array, -1.0, 1.0)

    # Сохранение результата в WAV-файл
    def _save_wav(self, audio: np.ndarray, sample_rate: int) -> Path:
        pcm_audio = (audio * 32767.0).astype(np.int16)
        with wave.open(str(self.output_path), "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(pcm_audio.tobytes())
        return self.output_path

    # Немедленное воспроизведение сгенерированного аудио
    def _play_audio(self, audio: np.ndarray, sample_rate: int) -> None:
        sd.stop()
        sd.play(audio.astype(np.float32, copy=False), sample_rate)
        if self.tts_cfg.playback_blocking:
            sd.wait()

    # Генерация речи через voice design
    def _generate_audio(self) -> tuple[np.ndarray, int]:
        with torch.inference_mode():
            wavs, sample_rate = self.model.generate_voice_design(
                text=self.tts_cfg.test_text,
                language=self.tts_cfg.language,
                instruct=self.tts_cfg.voice_instruct,
                max_new_tokens=self.tts_cfg.max_new_tokens,
                do_sample=self.tts_cfg.do_sample,
                temperature=self.tts_cfg.temperature,
            )

        if not wavs:
            raise RuntimeError("Qwen TTS не вернула сгенерированное аудио.")

        return self._to_numpy_audio(wavs[0]), int(sample_rate)

    # Генерация речи из тестового текста
    def synthesize_and_play(self) -> Path:
        print(f"TTS provider: {self.tts_cfg.provider}")
        print(f"TTS device: {self.device}")
        print(f"TTS model: {self.model_path}")
        print(f"TTS language: {self.tts_cfg.language}")

        audio_array, sample_rate = self._generate_audio()
        if audio_array.size == 0:
            raise RuntimeError("Qwen TTS вернула пустой аудиомассив.")

        output_path = self._save_wav(audio_array, sample_rate)
        self._play_audio(audio_array, sample_rate)
        print(f"TTS output: {output_path}")
        return output_path


# Запуск модуля
def main() -> None:
    QwenSpeechSynthesizer().synthesize_and_play()


if __name__ == "__main__":
    main()
