"""Эндпоинт генерации маршрута по квизу."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.schemas.quiz_route import QuizRouteGenerateRequest, QuizRouteResponse
from app.services.quiz_route_generator import generate_quiz_route

router = APIRouter(tags=["quiz-route"])


@router.post(
    "/ml/quiz-route",
    response_model=QuizRouteResponse,
    status_code=status.HTTP_200_OK,
)
def post_quiz_route(body: QuizRouteGenerateRequest) -> QuizRouteResponse:
    try:
        return generate_quiz_route(body)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
