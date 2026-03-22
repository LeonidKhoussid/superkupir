from __future__ import annotations

from collections.abc import Generator
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.api.main import app
from app.api.routes import quiz_route
from app.quiz_route.errors import UnsatisfiableQuizRouteError


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def clear_overrides() -> Generator[None, None, None]:
    yield
    app.dependency_overrides.clear()


def _fake_db_conn() -> Generator[MagicMock, None, None]:
    yield MagicMock()


VALID_BODY: dict[str, Any] = {
    "people_count": 4,
    "season": "summer",
    "budget_from": 15000,
    "budget_to": 80000,
    "excursion_type": "умеренный",
    "days_count": 3,
}


# Некорректный сезон → 400 на /v1/quiz
def test_invalid_season_400(client: TestClient) -> None:
    body = {**VALID_BODY, "season": "monsoon"}
    r = client.post("/v1/quiz/route", json=body)
    assert r.status_code == 400
    assert "detail" in r.json()


# budget_to < budget_from → 400
def test_invalid_budget_order_400(client: TestClient) -> None:
    body = {**VALID_BODY, "budget_from": 90000, "budget_to": 10000}
    r = client.post("/v1/quiz/route", json=body)
    assert r.status_code == 400


# fall нормализуется в autumn и проходит валидацию (мок оркестратора)
def test_fall_maps_to_autumn(client: TestClient) -> None:
    class OkOrch:
        def build_route(self, conn: object, season_slug: str, inp: object) -> tuple[list[int], str]:
            assert season_slug == "autumn"
            return [10, 20, 30, 40], "ok"

    app.dependency_overrides[quiz_route.get_quiz_db_connection] = _fake_db_conn
    app.dependency_overrides[quiz_route.get_quiz_orchestrator] = lambda: OkOrch()
    body = {**VALID_BODY, "season": "fall"}
    r = client.post("/v1/quiz/route", json=body)
    assert r.status_code == 200
    assert r.json()["place_ids"] == [10, 20, 30, 40]


# Пустой пул / невыполнимо → 422
def test_unsatisfiable_422(client: TestClient) -> None:
    class BadOrch:
        def build_route(self, conn: object, season_slug: str, inp: object) -> tuple[list[int], str]:
            raise UnsatisfiableQuizRouteError("слишком мало мест")

    app.dependency_overrides[quiz_route.get_quiz_db_connection] = _fake_db_conn
    app.dependency_overrides[quiz_route.get_quiz_orchestrator] = lambda: BadOrch()
    r = client.post("/v1/quiz/route", json=VALID_BODY)
    assert r.status_code == 422
    data = r.json()
    assert data["error"] == "unsatisfiable"
    assert "слишком" in data["detail"]


# Успешный путь: уникальные id, длина в разумных пределах
def test_happy_path_ordered_ids(client: TestClient) -> None:
    ids = list(range(100, 114))

    class OkOrch:
        def build_route(self, conn: object, season_slug: str, inp: object) -> tuple[list[int], str]:
            return ids, "test"

    app.dependency_overrides[quiz_route.get_quiz_db_connection] = _fake_db_conn
    app.dependency_overrides[quiz_route.get_quiz_orchestrator] = lambda: OkOrch()
    r = client.post("/v1/quiz/route", json=VALID_BODY)
    assert r.status_code == 200
    data = r.json()
    assert data["place_ids"] == ids
    assert len(set(data["place_ids"])) == len(data["place_ids"])
    assert 4 <= len(data["place_ids"]) <= 15


# Bearer при заданном токене в окружении
def test_bearer_required(monkeypatch: pytest.MonkeyPatch, client: TestClient) -> None:
    monkeypatch.setenv("QUIZ_ROUTE_API_TOKEN", "secret-token")

    class OkOrch:
        def build_route(self, conn: object, season_slug: str, inp: object) -> tuple[list[int], str]:
            return [1, 2, 3, 4], "ok"

    app.dependency_overrides[quiz_route.get_quiz_db_connection] = _fake_db_conn
    app.dependency_overrides[quiz_route.get_quiz_orchestrator] = lambda: OkOrch()

    r = client.post("/v1/quiz/route", json=VALID_BODY)
    assert r.status_code == 401

    r2 = client.post(
        "/v1/quiz/route",
        json=VALID_BODY,
        headers={"Authorization": "Bearer secret-token"},
    )
    assert r2.status_code == 200
