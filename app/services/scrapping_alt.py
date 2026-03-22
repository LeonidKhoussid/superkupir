from __future__ import annotations

import re
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import PathConfig, ScrapingConfig
from app.db_connector.session import CsvSession


class RussianWineriesAltScraper:
    """АЛЬТЕРНАТИВНЫЙ СКРАПИНГ ВИНОДЕЛЕН"""

    # Инициализация альтернативного скрапера
    def __init__(self) -> None:
        self.paths = PathConfig()
        self.paths.ensure_directories()
        self.cfg = ScrapingConfig()
        self.csv_session = CsvSession()
        self.columns = [
            "location",
            "name",
            "short_description",
            "logo_url",
            "description",
            "photo_url",
            "website_url",
            "address",
            "phone",
            "coordinates",
        ]
        self.list_card_selector = "a.t404__link[href]"
        self.list_title_selector = "div.t404__title"
        self.list_short_description_selector = "div.t404__descr"
        self.list_logo_selector = "div.t404__img"
        self.detail_description_selector = "div.t195__text"
        self.detail_photo_selector = "div.t195__imgsection img, meta[itemprop='image']"
        self.contact_block_selector = "div.t494__text.t-text"

    # Нормализация текста
    @staticmethod
    def _normalize_text(text: str) -> str:
        return " ".join(str(text).replace("\xa0", " ").split()).strip()

    # Извлечение URL из style
    def _extract_url_from_style(self, style_value: str) -> str:
        match = re.search(r"url\((['\"]?)(.*?)\1\)", style_value)
        if not match:
            return ""
        return self._normalize_text(match.group(2))

    # Приведение URL к абсолютному виду
    def _to_absolute_url(self, raw_url: str) -> str:
        if not raw_url:
            return ""
        return urljoin(self.cfg.scrapping_alt_base_url, raw_url)

    # Извлечение медиа-ссылки из тега
    def _extract_media_url(self, tag: Tag | None) -> str:
        if tag is None:
            return ""

        for attribute_name in (
            "data-bg",
            "data-src",
            "data-original",
            "content",
            "href",
            "src",
        ):
            attribute_value = self._normalize_text(tag.get(attribute_name, ""))
            if attribute_value:
                return self._to_absolute_url(attribute_value)

        style_value = self._normalize_text(tag.get("style", ""))
        return self._to_absolute_url(self._extract_url_from_style(style_value))

    # Поиск браузерного бинарника
    def _find_browser_binary(self, browser_name: str) -> Path | None:
        if browser_name == "chrome":
            candidates = [
                Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
                Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
                Path.home() / "AppData/Local/Google/Chrome/Application/chrome.exe",
            ]
        else:
            candidates = [
                Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
                Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
                Path.home() / "AppData/Local/Microsoft/Edge/Application/msedge.exe",
            ]

        for candidate in candidates:
            if candidate.exists():
                return candidate
        return None

    # Сборка браузера Selenium
    def _build_driver(self) -> WebDriver:
        chrome_binary = self._find_browser_binary("chrome")
        if chrome_binary is not None:
            options = webdriver.ChromeOptions()
            options.binary_location = str(chrome_binary)
            if self.cfg.headless:
                options.add_argument("--headless=new")
            options.add_argument("--disable-gpu")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_argument("--no-sandbox")
            options.add_argument("--window-size=1600,2200")
            options.add_argument(f"--user-agent={self.cfg.user_agent}")
            options.add_experimental_option("excludeSwitches", ["enable-logging"])

            if self.paths.chromedriver_path.exists():
                service = Service(executable_path=str(self.paths.chromedriver_path))
                driver = webdriver.Chrome(service=service, options=options)
            else:
                print(
                    "[scrapping_alt] chromedriver не найден в models/chromedriver, "
                    "использую Selenium Manager."
                )
                driver = webdriver.Chrome(options=options)

            driver.set_page_load_timeout(self.cfg.page_load_timeout)
            return driver

        edge_binary = self._find_browser_binary("edge")
        if edge_binary is None:
            raise FileNotFoundError(
                "Не найден chrome.exe или msedge.exe для запуска Selenium."
            )

        print("[scrapping_alt] chrome.exe не найден, использую Microsoft Edge.")
        options = webdriver.EdgeOptions()
        options.binary_location = str(edge_binary)
        if self.cfg.headless:
            options.add_argument("--headless=new")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_argument("--no-sandbox")
        options.add_argument("--window-size=1600,2200")
        options.add_argument(f"--user-agent={self.cfg.user_agent}")

        driver = webdriver.Edge(options=options)
        driver.set_page_load_timeout(self.cfg.page_load_timeout)
        return driver

    # Открытие страницы с ожиданием элемента
    def _open_page(
        self,
        driver: WebDriver,
        url: str,
        locator_by: str = By.TAG_NAME,
        locator_value: str = "body",
    ) -> None:
        driver.get(url)
        WebDriverWait(driver, self.cfg.wait_timeout).until(
            EC.presence_of_element_located((locator_by, locator_value))
        )
        time.sleep(self.cfg.detail_pause_seconds)

    # Извлечение страниц для обхода
    def _extract_page_urls(self, soup: BeautifulSoup) -> list[str]:
        return [self.cfg.scrapping_alt_source_url]

    # Сбор карточек виноделен со страницы списка
    def _extract_listing_items(self, soup: BeautifulSoup) -> list[dict[str, str]]:
        items: list[dict[str, str]] = []
        current_location = ""

        for block in soup.select("#allrecords > div[id^='rec']"):
            heading = block.find("h2")
            if heading is not None:
                current_location = self._normalize_text(heading.get_text(" ", strip=True))

            for card in block.select(self.list_card_selector):
                detail_url = self._to_absolute_url(
                    self._normalize_text(card.get("href", ""))
                )
                if not detail_url or detail_url.startswith("#"):
                    continue

                title_node = card.select_one(self.list_title_selector)
                if title_node is None:
                    continue

                short_description_node = card.select_one(
                    self.list_short_description_selector
                )
                logo_node = card.select_one(self.list_logo_selector)
                items.append(
                    {
                        "location": current_location,
                        "name": self._normalize_text(title_node.get_text(" ", strip=True)),
                        "short_description": self._normalize_text(
                            short_description_node.get_text(" ", strip=True)
                            if short_description_node is not None
                            else ""
                        ),
                        "logo_url": self._extract_media_url(logo_node),
                        "detail_url": detail_url,
                    }
                )
        return items

    # Извлечение текста описания
    def _extract_texts(self, soup: BeautifulSoup) -> tuple[str, str]:
        description_block = soup.select_one(self.detail_description_selector)
        if description_block is None:
            return "", ""

        line_parts = [
            self._normalize_text(line)
            for line in description_block.get_text("\n", strip=True).splitlines()
            if self._normalize_text(line)
        ]
        description = " ".join(line_parts)
        return "", description

    # Поиск контактного блока
    def _extract_contact_block(self, soup: BeautifulSoup) -> Tag | None:
        for block in soup.select(self.contact_block_selector):
            block_text = self._normalize_text(block.get_text(" ", strip=True))
            if "Адрес:" in block_text or "Телефон:" in block_text or "Сайт:" in block_text:
                return block
        return None

    # Извлечение адреса из контактного блока
    def _extract_address(self, contact_block: Tag | None) -> str:
        if contact_block is None:
            return ""

        raw_text = contact_block.get_text("\n", strip=True)
        match = re.search(
            r"Адрес(?:а)?:\s*(.+?)(?=Телефон:|e-mail:|email:|$)",
            raw_text,
            flags=re.S | re.IGNORECASE,
        )
        if not match:
            return ""

        address_lines = [
            self._normalize_text(line)
            for line in match.group(1).splitlines()
            if self._normalize_text(line)
        ]
        return "; ".join(address_lines)

    # Поиск внешнего сайта винодельни
    def _extract_website_url(self, soup: BeautifulSoup) -> str:
        contact_block = self._extract_contact_block(soup)
        if contact_block is None:
            return ""

        for link in contact_block.select("a[href^='http']"):
            href = self._normalize_text(link.get("href", ""))
            if "tourist.wine" in href or "t.me" in href or "pay.cloudtips.ru" in href:
                continue
            return href
        return ""

    # Поиск телефона винодельни
    def _extract_phone(self, soup: BeautifulSoup) -> str:
        contact_block = self._extract_contact_block(soup)
        if contact_block is None:
            return ""

        phone_values: list[str] = []
        for link in contact_block.select("a[href^='tel:']"):
            href = self._normalize_text(link.get("href", ""))
            if href.startswith("tel:"):
                phone_text = self._normalize_text(link.get_text(" ", strip=True))
                if phone_text and phone_text not in phone_values:
                    phone_values.append(phone_text)

        for line in contact_block.get_text("\n", strip=True).splitlines():
            normalized_line = self._normalize_text(line)
            if "+7" not in normalized_line:
                continue
            normalized_line = re.sub(
                r"^Телефон:\s*",
                "",
                normalized_line,
                flags=re.IGNORECASE,
            )
            if normalized_line and normalized_line not in phone_values:
                phone_values.append(normalized_line)

        return "; ".join(phone_values)

    # Извлечение данных детальной страницы
    def _extract_detail_data(
        self,
        driver: WebDriver,
        item: dict[str, str],
    ) -> dict[str, str]:
        self._open_page(driver, item["detail_url"], By.CSS_SELECTOR, "div.t195__text, h1")

        soup = BeautifulSoup(driver.page_source, "html.parser")
        _, description = self._extract_texts(soup)
        photo_node = soup.select_one(self.detail_photo_selector)
        page_title = soup.select_one("h1")
        name = self._normalize_text(
            page_title.get_text(" ", strip=True) if page_title is not None else item["name"]
        )
        contact_block = self._extract_contact_block(soup)

        return {
            "location": item["location"],
            "name": name,
            "short_description": item["short_description"],
            "logo_url": item["logo_url"],
            "description": description,
            "photo_url": self._extract_media_url(photo_node),
            "website_url": self._extract_website_url(soup),
            "address": self._extract_address(contact_block),
            "phone": self._extract_phone(soup),
            "coordinates": "",
        }

    # Полный сбор данных с сайта
    def scrape(self) -> list[dict[str, Any]]:
        driver = self._build_driver()
        try:
            self._open_page(
                driver,
                self.cfg.scrapping_alt_source_url,
                By.CSS_SELECTOR,
                self.list_card_selector,
            )
            soup = BeautifulSoup(driver.page_source, "html.parser")
            page_urls = self._extract_page_urls(soup)
            print(f"[scrapping_alt] Найдено страниц: {len(page_urls)}")

            listing_items: list[dict[str, str]] = []
            seen_urls: set[str] = set()
            for page_url in page_urls:
                self._open_page(driver, page_url, By.CSS_SELECTOR, self.list_card_selector)
                page_soup = BeautifulSoup(driver.page_source, "html.parser")
                for item in self._extract_listing_items(page_soup):
                    if item["detail_url"] in seen_urls:
                        continue
                    seen_urls.add(item["detail_url"])
                    listing_items.append(item)

            print(f"[scrapping_alt] Найдено карточек: {len(listing_items)}")

            rows: list[dict[str, Any]] = []
            for item in listing_items:
                try:
                    row = self._extract_detail_data(driver, item)
                except Exception as exc:
                    print(
                        f"[scrapping_alt] Ошибка карточки {item['detail_url']}: {exc}"
                    )
                    continue

                rows.append(row)
                print(f"[scrapping_alt] Обработано: {row['name']}")
            return rows
        finally:
            driver.quit()

    # Сохранение строк в CSV
    def write_rows(self, rows: list[dict[str, Any]]) -> None:
        self.csv_session.write_rows(
            self.paths.scrapping_alt_csv_path,
            self.columns,
            rows,
        )

    # Полный запуск скрапера с сохранением
    def scrape_and_save(self) -> list[dict[str, Any]]:
        rows = self.scrape()
        self.write_rows(rows)
        print(f"[scrapping_alt] Сохранено строк: {len(rows)}")
        print(f"[scrapping_alt] CSV: {self.paths.scrapping_alt_csv_path}")
        return rows


# Запуск
if __name__ == "__main__":
    RussianWineriesAltScraper().scrape_and_save()
