from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import requests


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import BackendCallbackConfig


class BackendCallbackClient:
    """ОТПРАВКА CSV В ОСНОВНОЙ БЕК"""

    # Инициализация callback-клиента
    def __init__(self) -> None:
        self.cfg = BackendCallbackConfig()

    # Получение итогового callback URL
    def resolve_url(self, callback_url: str = "") -> str:
        resolved = str(callback_url or "").strip() or self.cfg.default_url
        if not resolved:
            raise ValueError("Не задан callback URL для отправки результата.")
        return resolved

    # Построение заголовков запроса
    def _build_headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self.cfg.auth_header_name and self.cfg.auth_token:
            headers[self.cfg.auth_header_name] = self.cfg.auth_token
        return headers

    # Формирование form-data полей
    def _build_form_data(
        self,
        file_path: Path,
        user_id: str,
        stage: str,
        session_id: str,
        extra_fields: dict[str, Any] | None,
    ) -> dict[str, str]:
        form_data = {
            self.cfg.user_id_field_name: str(user_id or "").strip(),
            self.cfg.stage_field_name: str(stage or "").strip(),
            self.cfg.session_id_field_name: str(session_id or "").strip(),
            self.cfg.filename_field_name: file_path.name,
        }
        for key, value in (extra_fields or {}).items():
            form_data[str(key)] = str(value)
        return form_data

    # Сухой прогон без сетевого запроса
    @staticmethod
    def _build_dry_run_response(callback_url: str, file_path: Path) -> dict[str, Any]:
        return {
            "success": True,
            "callback_url": callback_url,
            "status_code": 200,
            "response_text": "dry-run callback accepted",
            "file_path": str(file_path),
        }

    # Отправка CSV в основной backend
    def send_csv(
        self,
        callback_url: str,
        file_path: str | Path,
        user_id: str,
        stage: str,
        session_id: str = "",
        extra_fields: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        resolved_url = self.resolve_url(callback_url)
        normalized_path = Path(file_path)
        if not normalized_path.exists():
            raise FileNotFoundError(f"CSV для callback не найден: {normalized_path}")

        if resolved_url.startswith("noop://") or resolved_url.startswith("dry-run://"):
            return self._build_dry_run_response(resolved_url, normalized_path)

        headers = self._build_headers()
        form_data = self._build_form_data(
            file_path=normalized_path,
            user_id=user_id,
            stage=stage,
            session_id=session_id,
            extra_fields=extra_fields,
        )
        try:
            with normalized_path.open("rb") as file_handle:
                response = requests.post(
                    resolved_url,
                    headers=headers,
                    data=form_data,
                    files={
                        self.cfg.file_field_name: (
                            normalized_path.name,
                            file_handle,
                            "text/csv",
                        ),
                    },
                    timeout=self.cfg.timeout_seconds,
                )
        except requests.RequestException as exc:
            return {
                "success": False,
                "callback_url": resolved_url,
                "status_code": None,
                "response_text": str(exc),
                "file_path": str(normalized_path),
            }
        return {
            "success": response.ok,
            "callback_url": resolved_url,
            "status_code": response.status_code,
            "response_text": response.text[:1000],
            "file_path": str(normalized_path),
        }


from app.services.backend_callback import BackendCallbackClient

# Запуск
if __name__ == "__main__":
    print(BackendCallbackClient().__class__.__name__)
