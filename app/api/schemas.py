from __future__ import annotations

import sys
from pathlib import Path

from pydantic import BaseModel


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


class RecommendationResponseSchema(BaseModel):
    """ОТВЕТ MINI-BACKEND API"""

    status: str
    message: str
    output_path: str
    processed_user_ids: list[str]
    callback_url: str
    callback_sent: bool
    callback_status_code: int | None = None
    callback_response_text: str = ""
    detail_profile_path: str = ""


# Запуск
if __name__ == "__main__":
    print(RecommendationResponseSchema.__name__)
