from __future__ import annotations

import sys
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile


PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.api.deps import get_callback_client, get_paths, get_recsys_service
from app.api.schemas import RecommendationResponseSchema
from app.config import PathConfig
from app.services.backend_callback import BackendCallbackClient
from app.services.recsys import RecsysService


class RecommendationsApi:
    """РУЧКИ РЕКОМЕНДАЦИЙ MINI-BACKEND"""

    # Инициализация router-а
    def __init__(self) -> None:
        self.router = APIRouter(prefix="/api/v1/recommendations", tags=["recommendations"])
        self._bind_routes()

    # Регистрация route-обработчиков
    def _bind_routes(self) -> None:
        self.router.add_api_route(
            "/base",
            self.create_base_recommendations,
            methods=["POST"],
            response_model=RecommendationResponseSchema,
        )
        self.router.add_api_route(
            "/detail",
            self.create_detail_recommendations,
            methods=["POST"],
            response_model=RecommendationResponseSchema,
        )

    # Сохранение входного файла
    @staticmethod
    async def _save_upload(upload_file: UploadFile, destination_path: Path) -> Path:
        file_bytes = await upload_file.read()
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        destination_path.write_bytes(file_bytes)
        await upload_file.close()
        return destination_path

    # Отправка callback с переводом ошибок в HTTPException
    @staticmethod
    def _send_callback_or_fail(
        callback_client: BackendCallbackClient,
        callback_url: str,
        file_path: str,
        user_id: str,
        stage: str,
        session_id: str,
        extra_fields: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        try:
            return callback_client.send_csv(
                callback_url=callback_url,
                file_path=file_path,
                user_id=user_id,
                stage=stage,
                session_id=session_id,
                extra_fields=extra_fields,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Построение JSON-ответа
    @staticmethod
    def _build_response(
        message: str,
        output_path: str,
        processed_user_ids: list[str],
        callback_result: dict[str, Any],
        detail_profile_path: str = "",
    ) -> RecommendationResponseSchema:
        return RecommendationResponseSchema(
            status="ok" if callback_result.get("success", False) else "callback_failed",
            message=message,
            output_path=output_path,
            processed_user_ids=processed_user_ids,
            callback_url=str(callback_result.get("callback_url", "")),
            callback_sent=bool(callback_result.get("success", False)),
            callback_status_code=callback_result.get("status_code"),
            callback_response_text=str(callback_result.get("response_text", "")),
            detail_profile_path=detail_profile_path,
        )

    # Базовая генерация маршрута из CSV
    async def create_base_recommendations(
        self,
        callback_url: str = Form(""),
        user_id: str = Form(""),
        base_file: UploadFile = File(...),
        recsys_service: RecsysService = Depends(get_recsys_service),
        callback_client: BackendCallbackClient = Depends(get_callback_client),
        paths: PathConfig = Depends(get_paths),
    ) -> RecommendationResponseSchema:
        await self._save_upload(base_file, paths.user_01_base_csv_path)
        normalized_user_id = str(user_id or "").strip()

        if normalized_user_id:
            result = recsys_service.build_base_for_user(normalized_user_id)
            processed_user_ids = [normalized_user_id]
        else:
            result = recsys_service.build_base_for_all()
            processed_user_ids = [
                str(item.get("user_id", "") or "").strip()
                for item in result.get("results", [])
                if str(item.get("user_id", "") or "").strip()
            ]

        callback_result = self._send_callback_or_fail(
            callback_client=callback_client,
            callback_url=callback_url,
            file_path=str(result["output_path"]),
            user_id=",".join(processed_user_ids),
            stage="base",
            session_id="base_callback",
            extra_fields={"processed_users": ",".join(processed_user_ids)},
        )
        return self._build_response(
            message="Базовый маршрут построен и отправлен в основной backend.",
            output_path=str(result["output_path"]),
            processed_user_ids=processed_user_ids,
            callback_result=callback_result,
        )

    # Detail-генерация маршрута из текста или аудио
    async def create_detail_recommendations(
        self,
        user_id: str = Form(...),
        callback_url: str = Form(""),
        text: str = Form(""),
        session_id: str = Form(""),
        audio_file: UploadFile | None = File(None),
        recsys_service: RecsysService = Depends(get_recsys_service),
        callback_client: BackendCallbackClient = Depends(get_callback_client),
        paths: PathConfig = Depends(get_paths),
    ) -> RecommendationResponseSchema:
        normalized_user_id = str(user_id or "").strip()
        if not normalized_user_id:
            raise HTTPException(status_code=400, detail="Поле user_id не должно быть пустым.")
        normalized_text = str(text or "").strip()
        has_audio = audio_file is not None and bool(str(audio_file.filename or "").strip())
        has_text = bool(normalized_text)
        if has_text == has_audio:
            raise HTTPException(
                status_code=400,
                detail="Нужно передать либо text, либо audio_file.",
            )

        if has_text:
            result = recsys_service.build_detail_from_text(
                user_id=normalized_user_id,
                text=normalized_text,
                session_id=session_id,
            )
        else:
            audio_suffix = Path(str(audio_file.filename or "")).suffix or ".wav"
            temp_audio_path = paths.uploads_dir / f"detail_{normalized_user_id}_{uuid4().hex}{audio_suffix}"
            try:
                await self._save_upload(audio_file, temp_audio_path)
                result = recsys_service.build_detail_from_audio(
                    user_id=normalized_user_id,
                    audio_path=temp_audio_path,
                    session_id=session_id,
                )
            finally:
                temp_audio_path.unlink(missing_ok=True)

        callback_result = self._send_callback_or_fail(
            callback_client=callback_client,
            callback_url=callback_url,
            file_path=str(result["output_path"]),
            user_id=normalized_user_id,
            stage="detail",
            session_id=str(result.get("profile_row", {}).get("session_id", "") or session_id),
        )
        return self._build_response(
            message="Углублённый маршрут построен и отправлен в основной backend.",
            output_path=str(result["output_path"]),
            processed_user_ids=[normalized_user_id],
            callback_result=callback_result,
            detail_profile_path=str(result.get("user_02_detail_path", "")),
        )


api = RecommendationsApi()
router = api.router


from app.api.routes.recommendations import RecommendationsApi

# Запуск
if __name__ == "__main__":
    print(RecommendationsApi().__class__.__name__)
