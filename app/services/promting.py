from __future__ import annotations

from datetime import datetime
from typing import Any


class PromptRouting:
    """ГЕНЕРАТОР ПРОМТОВ ДЛЯ LLAMA-CPP"""

    # Инициализация промпт-билдера
    def __init__(self, system_prompt: str | None = None, default_persona: str = "гид"):
        self.default_instruction = system_prompt or self._default_system_prompt()
        self.default_persona = default_persona

    # Системный промпт по умолчанию
    @staticmethod
    def _default_system_prompt() -> str:
        return (
            "Ты — вежливый, дружелюбный и информированный ассистент-гид, специализирующийся на Краснодарском крае.\n"
            "Ты должен отвечать понятно, живо и с душой — будто рассказываешь другу.\n"
            "Твоя задача — делиться полезной, актуальной и интересной информацией, быть собеседником, а не сухим справочником.\n"
            "Ты не используешь англицизмы и сленг, говоришь в стиле местного жителя, который любит свой регион.\n"
            "Если ты чего-то не знаешь — скажи честно, не выдумывай.\n"
            "\n"
            "Ориентируйся на следующие ключевые темы, которые ты хорошо знаешь и можешь рассказывать с уверенностью:\n"
            "1. Природные маршруты, каньоны, ущелья, водопады.\n"
            "2. Местная кухня и гастрономия.\n"
            "3. Курортные города и пляжи.\n"
            "4. Историко-культурные объекты.\n"
            "5. Винодельни и энотуризм.\n"
            "6. Секретные локации и малоизвестные достопримечательности.\n"
            "7. Термальные источники и СПА зоны.\n"
            "8. Местные праздники, рынки и ярмарки.\n"
            "9. Транспорт и логистика в регионе.\n"
            "10. Климат и сезонные особенности.\n"
            "\n"
            "Отвечай только на русском языке.\n"
            "Будь лаконичен, но не сух — ответы должны быть человечными.\n"
            "Ответ — не более 3-4 предложений, чтобы его удобно было озвучить голосом."
        )

    # Сборка system-сообщения для chatml
    def _build_system_content(
        self,
        persona: str | None = None,
        metadata: dict[str, Any] | None = None,
        add_time_context: bool = False,
    ) -> str:
        persona = persona or self.default_persona
        parts = [
            self.default_instruction,
            f"\nТы выступаешь в роли: {persona}.",
        ]

        if add_time_context:
            parts.append(f"\nТекущее время: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.")

        if metadata:
            meta_lines = ["\nДополнительные указания:"]
            for key, value in metadata.items():
                meta_lines.append(f"- {key}: {value}")
            parts.append("\n".join(meta_lines))

        return "\n".join(parts)

    # Сборка массива messages для llama-cpp create_chat_completion
    def build_messages(
        self,
        user_input: str,
        history: list[tuple[str, str]] | None = None,
        persona: str | None = None,
        metadata: dict[str, Any] | None = None,
        add_time_context: bool = False,
    ) -> list[dict[str, str]]:
        messages: list[dict[str, str]] = [
            {
                "role": "system",
                "content": self._build_system_content(persona, metadata, add_time_context),
            }
        ]

        if history:
            for user_text, assistant_text in history:
                messages.append({"role": "user", "content": user_text})
                messages.append({"role": "assistant", "content": assistant_text})

        messages.append({"role": "user", "content": user_input})
        return messages

    # Промпт для презентации места с веб-контекстом
    @staticmethod
    def _place_presentation_system() -> str:
        return (
            "Ты — увлечённый гид по Краснодарскому краю.\n"
            "Тебе дают название места и информацию из интернета о нём.\n"
            "Твоя задача — составить живой, продающий и достоверный рассказ об этом месте.\n"
            "\n"
            "Правила:\n"
            "- Говори так, будто рассказываешь другу, который сомневается, стоит ли туда ехать.\n"
            "- Подчеркни уникальность, атмосферу и то, что запомнится.\n"
            "- Если место подходит для семьи, пары или компании — упомяни это.\n"
            "- Не выдумывай факты — опирайся только на предоставленную информацию.\n"
            "- Ответ — 3-5 предложений, живых и тёплых, пригодных для озвучки голосом.\n"
            "- Отвечай только на русском языке."
        )

    # Сборка messages для презентации места
    def build_place_messages(
        self,
        place_name: str,
        web_context: str,
        user_preferences: str = "",
    ) -> list[dict[str, str]]:
        messages: list[dict[str, str]] = [
            {"role": "system", "content": self._place_presentation_system()}
        ]

        user_parts = [f"Расскажи про место: {place_name}."]
        if user_preferences:
            user_parts.append(f"\nПредпочтения путешественника: {user_preferences}")
        if web_context:
            user_parts.append(f"\nИнформация из интернета:\n{web_context}")

        messages.append({"role": "user", "content": "\n".join(user_parts)})
        return messages

    # Сборка messages для диалога с веб-контекстом
    def build_messages_with_context(
        self,
        user_input: str,
        web_context: str,
        history: list[tuple[str, str]] | None = None,
        persona: str | None = None,
        add_time_context: bool = False,
    ) -> list[dict[str, str]]:
        system_content = self._build_system_content(persona, add_time_context=add_time_context)
        if web_context:
            system_content += (
                "\n\nТебе предоставлена актуальная информация из интернета по теме запроса. "
                "Используй её для ответа, но говори своими словами, живо и по делу.\n"
                f"\n{web_context}"
            )

        messages: list[dict[str, str]] = [
            {"role": "system", "content": system_content}
        ]

        if history:
            for user_text, assistant_text in history:
                messages.append({"role": "user", "content": user_text})
                messages.append({"role": "assistant", "content": assistant_text})

        messages.append({"role": "user", "content": user_input})
        return messages

    # Совместимость — плоский промпт (для дебага / логов)
    def build_prompt(
        self,
        user_input: str,
        history: list[tuple[str, str]] | None = None,
        persona: str | None = None,
        metadata: dict[str, Any] | None = None,
        add_time_context: bool = False,
    ) -> str:
        messages = self.build_messages(user_input, history, persona, metadata, add_time_context)
        parts: list[str] = []
        for msg in messages:
            parts.append(f"[{msg['role']}] {msg['content']}")
        return "\n\n".join(parts)


from app.services.promting import PromptRouting

# Запуск
if __name__ == "__main__":
    routing = PromptRouting()
    msgs = routing.build_messages("Что посмотреть в Абрау-Дюрсо за один день?")
    for m in msgs:
        print(f"--- {m['role']} ---")
        print(m["content"][:200])
