from __future__ import annotations

import logging
import sys
import time
from collections.abc import Generator
from pathlib import Path
from typing import Annotated

import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import JSONResponse

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import QuizRouteServiceConfig
from app.quiz_route.engine import QuizRouteInput
from app.quiz_route.errors import UnsatisfiableQuizRouteError
from app.quiz_route.http_models import QuizRouteErrorModel, QuizRouteRequestModel, QuizRouteResponseModel
from app.quiz_route.orchestrator import QuizRouteOrchestrator

router = APIRouter(prefix="/v1/quiz", tags=["quiz-route"])
_log = logging.getLogger("quiz_route")


# Настройки quiz-route
def get_quiz_settings() -> QuizRouteServiceConfig:
    return QuizRouteServiceConfig()


# Парсинг тела (кэшируется FastAPI для цепочки зависимостей)
def parse_quiz_request(payload: QuizRouteRequestModel) -> QuizRouteRequestModel:
    return payload


# Проверка Bearer при заданном QUIZ_ROUTE_API_TOKEN
def verify_quiz_bearer(
    settings: Annotated[QuizRouteServiceConfig, Depends(get_quiz_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    token = settings.api_bearer_token
    if not token:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization Bearer token required",
        )
    if authorization.removeprefix("Bearer ").strip() != token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token",
        )


# Соединение Postgres после успешной валидации тела (чтобы 400 шёл без DSN)
def get_quiz_db_connection(
    _validated: Annotated[QuizRouteRequestModel, Depends(parse_quiz_request)],
    settings: Annotated[QuizRouteServiceConfig, Depends(get_quiz_settings)],
) -> Generator[psycopg.Connection, None, None]:
    if not settings.database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "DATABASE_URL is not configured (пустая переменная окружения). "
                "Добавь DATABASE_URL в .env в корне проекта и перезапусти uvicorn — "
                "при старте app.api.main подгружает .env через python-dotenv."
            ),
        )
    try:
        conn = psycopg.connect(settings.database_url, connect_timeout=12)
    except Exception as exc:  # noqa: BLE001
        _log.exception("database connection failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"database connection failed: {exc!s}",
        ) from exc
    try:
        yield conn
    finally:
        conn.close()


# Оркестратор маршрута
def get_quiz_orchestrator() -> QuizRouteOrchestrator:
    return QuizRouteOrchestrator()


# Построение маршрута по ответам квиза
@router.post(
    "/route",
    response_model=QuizRouteResponseModel,
    summary="Маршрут по квизу (ordered place_ids)",
    responses={
        422: {"model": QuizRouteErrorModel},
    },
)
def post_quiz_route(
    payload: Annotated[QuizRouteRequestModel, Depends(parse_quiz_request)],
    _: Annotated[None, Depends(verify_quiz_bearer)],
    conn: Annotated[psycopg.Connection, Depends(get_quiz_db_connection)],
    orchestrator: Annotated[QuizRouteOrchestrator, Depends(get_quiz_orchestrator)],
    x_request_id: Annotated[str | None, Header()] = None,
) -> QuizRouteResponseModel | JSONResponse:
    rid = payload.request_id or x_request_id or "-"
    t0 = time.perf_counter()
    inp = QuizRouteInput(
        people_count=payload.people_count,
        budget_from=float(payload.budget_from),
        budget_to=float(payload.budget_to),
        excursion_type=payload.excursion_type,
        days_count=payload.days_count,
    )
    try:
        place_ids, rationale = orchestrator.build_route(conn, payload.season, inp)
    except UnsatisfiableQuizRouteError as exc:
        latency = time.perf_counter() - t0
        _log.warning(
            "quiz_route unsatisfiable request_id=%s latency_ms=%.1f stops=0 detail=%s",
            rid,
            latency * 1000,
            exc.detail,
        )
        body = QuizRouteErrorModel(detail=exc.detail)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content=body.model_dump(),
        )

    latency = time.perf_counter() - t0
    confidence = min(1.0, max(0.0, len(place_ids) / 15.0))
    _log.info(
        "quiz_route ok request_id=%s latency_ms=%.1f stops=%d",
        rid,
        latency * 1000,
        len(place_ids),
    )
    return QuizRouteResponseModel(
        place_ids=place_ids,
        confidence=round(confidence, 3),
        rationale=rationale,
    )
