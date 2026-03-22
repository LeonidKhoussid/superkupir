from __future__ import annotations

import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")
if hasattr(sys.stdin, "reconfigure"):
    sys.stdin.reconfigure(encoding="utf-8")

from app.db_connector.repositories import CsvRepository
from app.services.backend_callback import BackendCallbackClient
from app.services.recsys import RecsysService


class RunRecsysCli:
    """КОНСОЛЬНЫЙ ЗАПУСК RECSYS"""

    # Инициализация CLI
    def __init__(self) -> None:
        self.repository = CsvRepository()
        self.recsys = RecsysService()
        self.callback_client = BackendCallbackClient()

    # Печать заголовка блока
    @staticmethod
    def _print_title(title: str) -> None:
        print(f"\n{'=' * 84}")
        print(f"  {title}")
        print(f"{'=' * 84}")

    # Человекочитаемый тип остановки
    @staticmethod
    def _stop_label(place: dict[str, Any]) -> str:
        category = str(place.get("category", "") or "")
        if category == "stay":
            return "Отель"
        if category == "food":
            return "Еда"
        if category == "wine":
            return "Винодельня"
        return "Активность"

    # Выбор пользователя из user_01_base.csv
    def _choose_user(self) -> str:
        rows = self.repository.read_user_01_base_rows() or self.repository.read_user_base_rows()
        if not rows:
            raise ValueError("user_01_base.csv пуст или не найден.")

        self._print_title("ПОЛЬЗОВАТЕЛИ user_01_base.csv")
        for index, row in enumerate(rows, start=1):
            print(
                f"  [{index:02d}] id={row.get('id', '')} | "
                f"group={row.get('group', '')} | "
                f"season={row.get('season', '')} | "
                f"days={row.get('days', '')} | "
                f"budget={row.get('budget', '')}",
            )

        while True:
            raw_choice = input(f"\nВыберите пользователя [01-{len(rows):02d}]: ").strip()
            try:
                choice = int(raw_choice)
            except ValueError:
                continue
            if 1 <= choice <= len(rows):
                return str(rows[choice - 1].get("id", "") or "").strip()

    # Печать краткого профиля пользователя
    @staticmethod
    def _print_profile(profile_row: dict[str, Any]) -> None:
        print("  Профиль:")
        print(f"    user_id: {profile_row.get('user_id', '')}")
        print(f"    stage: {profile_row.get('profile_stage', '')}")
        print(f"    season: {profile_row.get('travel_season', '')}")
        print(f"    city_to: {profile_row.get('city_to', '')}")
        print(f"    areas: {profile_row.get('preferred_areas', '')}")
        print(f"    group: {profile_row.get('group_type', '')}")
        print(f"    budget: {profile_row.get('budget_level', '')} / {profile_row.get('budget_total_rub', '')}")
        print(f"    themes: {profile_row.get('themes', '')}")
        print(f"    focus: {profile_row.get('focus_categories', '')}")
        print(f"    query: {profile_row.get('query_text', '')}")

    # Запрос callback URL
    def _ask_callback_url(self) -> str:
        default_url = str(self.callback_client.cfg.default_url or "").strip()
        if default_url:
            prompt = f"\nВведите callback URL [Enter = {default_url}]: "
        else:
            prompt = "\nВведите callback URL [Enter = пропустить]: "
        return input(prompt).strip() or default_url

    # Отправка CSV в основной backend
    def _maybe_send_callback(
        self,
        output_path: str,
        user_id: str,
        stage: str,
        session_id: str = "",
    ) -> None:
        callback_url = self._ask_callback_url()
        if not callback_url:
            print("  [recsys] callback пропущен.")
            return

        callback_result = self.callback_client.send_csv(
            callback_url=callback_url,
            file_path=output_path,
            user_id=user_id,
            stage=stage,
            session_id=session_id,
        )
        print(
            f"  [recsys] callback -> {callback_result.get('status_code', '')} | "
            f"success={callback_result.get('success', False)}",
        )

    # Печать маршрутов в консоль
    def _print_variants(self, route_variants: list[dict[str, Any]], title: str) -> None:
        self._print_title(title)
        if not route_variants:
            print("  Нет построенных маршрутов.")
            return

        for variant in route_variants:
            print(
                f"  Вариант #{variant.get('variant_rank', '')}: "
                f"{variant.get('variant_name', '')} | "
                f"{variant.get('summary', '')}",
            )
            for stop in variant.get("stops", []):
                place = stop.get("place", {})
                print(
                    f"    День {stop.get('day', 1)} | "
                    f"#{stop.get('stop_order', 0)} | "
                    f"{self._stop_label(place)} | "
                    f"{place.get('name', '')}",
                )
                print(
                    f"      score={stop.get('score', 0.0)} | "
                    f"{stop.get('start_time', '')} -> {stop.get('end_time', '')}",
                )
                print(f"      why={stop.get('why_selected', '')}")
            print(f"{'-' * 84}")

    # Основной базовый сценарий
    def _run_base(self) -> int:
        user_id = self._choose_user()
        self._print_title("ЛОГИ 01 | BASE")
        print(f"  [recsys] user_id={user_id}")
        print(f"  [recsys] wines path={self.recsys.paths.wines_csv_path}")
        print(f"  [recsys] llm model={self.recsys.llm_model_path}")
        print("  [recsys] Строю базовый unified-маршрут...")

        result = self.recsys.build_base_for_user(user_id)
        self._print_profile(result["profile_row"])
        self._print_variants(result["selected_variants"], "BASE ROUTE")
        print(f"  [recsys] recsys_01_base.csv -> {result['output_path']}")
        self._maybe_send_callback(
            output_path=str(result["output_path"]),
            user_id=user_id,
            stage="base",
            session_id=str(result["profile_row"].get("session_id", "") or f"base_{user_id}"),
        )
        return 0

    # Основной detail-сценарий
    def _run_detail(self) -> int:
        user_id = self._choose_user()
        self._print_title("ЛОГИ 02 | DETAIL")
        print(f"  [recsys] user_id={user_id}")
        print(f"  [recsys] llm model exists={self.recsys.llm_model_path.exists()}")
        print("  [01] Текст")
        print("  [02] Аудиофайл")
        print("  [03] Микрофон")

        mode = ""
        while mode not in {"01", "02", "03"}:
            mode = input("\nВыберите источник уточнения [01/02/03]: ").strip()

        if mode == "01":
            text = input("Введите текст уточнения: ").strip()
            if not text:
                raise ValueError("Пустой текст уточнения.")
            print("  [recsys] Парсю текст и строю detail-профиль...")
            result = self.recsys.build_detail_from_text(
                user_id=user_id,
                text=text,
                session_id=f"detail_{user_id}",
            )
        elif mode == "02":
            audio_path = input("Введите путь к аудиофайлу: ").strip()
            if not audio_path:
                raise ValueError("Пустой путь к аудиофайлу.")
            print("  [recsys] Транскрибирую аудио и строю detail-профиль...")
            result = self.recsys.build_detail_from_audio(
                user_id=user_id,
                audio_path=audio_path,
                session_id=f"detail_{user_id}",
            )
        else:
            print("  [recsys] Запись с микрофона...")
            result = self.recsys.build_detail_from_microphone(
                user_id=user_id,
                session_id=f"detail_{user_id}",
            )

        transcript_result = result.get("transcript_result", {})
        print(f"  [recsys] transcript={transcript_result.get('transcript', '')}")
        self._print_profile(result["profile_row"])
        self._print_variants(result["route_variants"], "DETAIL ROUTES")
        print(f"  [recsys] user_02_detail.csv -> {result['user_02_detail_path']}")
        print(f"  [recsys] recsys_02_detail.csv -> {result['output_path']}")
        self._maybe_send_callback(
            output_path=str(result["output_path"]),
            user_id=user_id,
            stage="detail",
            session_id=str(result["profile_row"].get("session_id", "") or f"detail_{user_id}"),
        )
        return 0

    # Основной сценарий альтернативных маршрутов
    def _run_alternatives(self) -> int:
        user_id = self._choose_user()
        self._print_title("ЛОГИ 03 | ALTERNATIVES")
        print(f"  [recsys] user_id={user_id}")
        print("  [recsys] Беру последний профиль из user_02_detail.csv и строю альтернативы...")

        result = self.recsys.build_alternatives_from_user_detail(user_id)
        self._print_profile(result["profile_row"])
        self._print_variants(result["alternative_variants"], "ALTERNATIVE ROUTES")
        print(f"  [recsys] recsys_02_detail.csv -> {result['output_path']}")
        self._maybe_send_callback(
            output_path=str(result["output_path"]),
            user_id=user_id,
            stage="detail",
            session_id=str(result["profile_row"].get("session_id", "") or f"detail_{user_id}"),
        )
        return 0

    # Полный запуск CLI
    def run(self) -> int:
        self._print_title("UNIFIED RECSYS")
        print("  [01] Базовые рекомендации -> recsys_01_base.csv")
        print("  [02] Детальный профиль и маршрут -> user_02_detail.csv + recsys_02_detail.csv")
        print("  [03] Альтернативные маршруты по последнему detail-профилю")

        mode = ""
        while mode not in {"01", "02", "03"}:
            mode = input("\nВыберите сценарий [01/02/03]: ").strip()

        if mode == "01":
            return self._run_base()
        if mode == "02":
            return self._run_detail()
        return self._run_alternatives()


# Запуск
if __name__ == "__main__":
    raise SystemExit(RunRecsysCli().run())
