from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import PathConfig
from app.services.backend_callback import BackendCallbackClient
from app.services.recsys import RecsysService


class ApiDependencies:
    """ПРОВАЙДЕР ЗАВИСИМОСТЕЙ API"""

    # Инициализация зависимостей
    def __init__(self) -> None:
        self.paths = PathConfig()
        self.paths.ensure_directories()

    # Получение recsys-сервиса
    @lru_cache(maxsize=1)
    def get_recsys_service(self) -> RecsysService:
        return RecsysService()

    # Получение callback-клиента
    @lru_cache(maxsize=1)
    def get_callback_client(self) -> BackendCallbackClient:
        return BackendCallbackClient()


_api_dependencies = ApiDependencies()


def get_paths() -> PathConfig:
    return _api_dependencies.paths


def get_recsys_service() -> RecsysService:
    return _api_dependencies.get_recsys_service()


def get_callback_client() -> BackendCallbackClient:
    return _api_dependencies.get_callback_client()


from app.api.deps import ApiDependencies

# Запуск
if __name__ == "__main__":
    print(ApiDependencies().__class__.__name__)
