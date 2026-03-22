from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, RedirectResponse


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# .env не подхватывается uvicorn сам по себе — нужен явный load для DATABASE_URL и т.д.
load_dotenv(PROJECT_ROOT / ".env", override=False)

from app.api.quiz_route import router as ml_quiz_route_router
from app.api.routes.quiz_route import router as quiz_route_router
from app.api.routes.recommendations import router as recommendations_router


class ApiApplication:
    """ПРИЛОЖЕНИЕ MINI-BACKEND API"""

    # Инициализация приложения
    def __init__(self) -> None:
        self.app = FastAPI(
            title="TurMur API",
            version="0.1.0",
            description=(
                "**Создание маршрута (базовый квиз):** `POST /api/v1/recommendations/base` "
                "(multipart: `base_file`, `callback_url`, опционально `user_id`).\n\n"
                "**Углублённый маршрут (текст или аудио):** "
                "`POST /api/v1/recommendations/detail` "
                "(multipart: `user_id`, `callback_url`, либо `text`, либо `audio_file`).\n\n"
                "**Маршрут по квизу (Postgres):** `POST /v1/quiz/route` — JSON квиз → упорядоченные `place_ids`.\n\n"
                "**Stateless маршрут по датасету в теле запроса:** `POST /ml/quiz-route` "
                "(JSON: ответы квиза + список мест + маппинг сезонов).\n\n"
                "**Swagger UI:** `/docs` · **OpenAPI JSON:** `/openapi.json` · **ReDoc:** `/redoc`"
            ),
            openapi_url="/openapi.json",
            docs_url="/docs",
            redoc_url="/redoc",
        )
        self._configure_routes()
        self._configure_quiz_validation_400()

    # Для quiz-route: неверное тело → 400 (контракт интеграции)
    def _configure_quiz_validation_400(self) -> None:
        @self.app.exception_handler(RequestValidationError)
        async def quiz_validation_to_400(
            request: Request,
            exc: RequestValidationError,
        ) -> JSONResponse | RedirectResponse:
            if request.url.path.startswith("/v1/quiz"):
                return JSONResponse(
                    status_code=400,
                    content=jsonable_encoder({"detail": exc.errors()}),
                )
            return await request_validation_exception_handler(request, exc)

    # Подключение router-ов
    def _configure_routes(self) -> None:
        @self.app.get("/", include_in_schema=False)
        async def root() -> RedirectResponse:
            return RedirectResponse(url="/docs")

        self.app.include_router(recommendations_router)
        self.app.include_router(quiz_route_router)
        self.app.include_router(ml_quiz_route_router)

        @self.app.get("/health")
        async def healthcheck() -> dict[str, str]:
            return {"status": "ok"}

        @self.app.get("/api/v1/test/ping")
        async def ping() -> dict[str, object]:
            return {
                "status": "ok",
                "service": "TurMur API",
                "routes": {
                    "test": "/api/v1/test/ping",
                    "health": "/health",
                    "base": "/api/v1/recommendations/base",
                    "detail": "/api/v1/recommendations/detail",
                    "quiz_route": "/v1/quiz/route",
                    "ml_quiz_route": "/ml/quiz-route",
                },
            }

    # Возврат готового FastAPI app
    def build(self) -> FastAPI:
        return self.app


app = ApiApplication().build()


# Запуск
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.api.main:app", host="127.0.0.1", port=8000, reload=False)
