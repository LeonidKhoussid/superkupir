from __future__ import annotations

import re
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import PathConfig, ScrapingConfig
from app.db_connector.session import CsvSession


class RussianWineriesScraper:
    """СКРАПИНГ ВИНОДЕЛЕН РОССИИ"""

    # Инициализация скрапера
    def __init__(self) -> None:
        self.paths = PathConfig()
        self.paths.ensure_directories()
        self.cfg = ScrapingConfig()
        self.csv_session = CsvSession()
        self.columns = [
            "wines_id",
            "name",
            "source_location",
            "card_url",
            "logo_url",
            "size",
            "description",
            "photo_urls",
            "lat",
            "lon",
            "coordinates_raw",
            "address",
        ]
        self.load_more_xpath = (
            "/html/body/div[3]/div[4]/div[3]/div/div/div/div/div[3]/div/div/div[2]/div/div[1]/span"
        )
        self.address_cache: dict[tuple[str, str], str] = {}

    # Нормализация текста
    @staticmethod
    def _normalize_text(text: str) -> str:
        return " ".join(str(text).replace("\xa0", " ").split()).strip()

    # Сборка браузера Edge
    def _build_driver(self) -> webdriver.Edge:
        options = webdriver.EdgeOptions()
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

    # Открытие страницы с ожиданием body
    def _open_page(self, driver: webdriver.Edge, url: str) -> None:
        driver.get(url)
        WebDriverWait(driver, self.cfg.wait_timeout).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        time.sleep(self.cfg.detail_pause_seconds)

    # Подтверждение возраста 18+
    def _accept_age_gate(self, driver: webdriver.Edge) -> None:
        age_xpath = "/html/body/div[8]/div[2]/div/div[3]/div/a[1]"
        try:
            button = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, age_xpath))
            )
            button.click()
            print("[scraper] Подтверждение 18+: нажато.")
            time.sleep(self.cfg.detail_pause_seconds)
        except TimeoutException:
            pass

    # Нажатие на кнопку загрузки карточек
    def _click_load_more_until_end(self, driver: webdriver.Chrome) -> None:
        print("[scraper] Открываю список виноделен в браузере...")
        for click_index in range(1, self.cfg.max_load_more_clicks + 1):
            try:
                button = WebDriverWait(driver, self.cfg.wait_timeout).until(
                    EC.element_to_be_clickable((By.XPATH, self.load_more_xpath))
                )
            except TimeoutException:
                print("[scraper] Кнопка 'Загрузить еще' больше не найдена.")
                break
            except Exception:
                break

            try:
                button_text = self._normalize_text(button.text)
                if "загрузить" not in button_text.lower():
                    break
                driver.execute_script(
                    "arguments[0].scrollIntoView({block: 'center'});",
                    button,
                )
                time.sleep(self.cfg.scroll_pause_seconds)
                driver.execute_script("arguments[0].click();", button)
                time.sleep(self.cfg.scroll_pause_seconds)
                print(f"[scraper] Нажатие 'Загрузить еще': {click_index}")
            except Exception:
                break

    # Извлечение карточек виноделен со страницы списка
    def _extract_listing_items(self, html: str) -> list[dict[str, str]]:
        soup = BeautifulSoup(html, "html.parser")
        items: list[dict[str, str]] = []
        seen_urls: set[str] = set()

        for link in soup.select("a.project-list__wrapper[href]"):
            url = urljoin(self.cfg.base_url, link.get("href", ""))
            if not url or url in seen_urls:
                continue

            name_element = link.select_one(".project-list__item-title")
            location_element = link.select_one(".project-list__item-section")
            name = self._normalize_text(name_element.get_text(" ", strip=True) if name_element else "")
            location = self._normalize_text(
                location_element.get_text(" ", strip=True) if location_element else ""
            )
            if not name:
                continue

            seen_urls.add(url)
            items.append(
                {
                    "url": url,
                    "name": name,
                    "location": location,
                }
            )
        return items

    # Загрузка страницы карточки через Selenium
    def _fetch_detail_html(self, driver: webdriver.Edge, url: str) -> str:
        driver.get(url)
        WebDriverWait(driver, self.cfg.wait_timeout).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        time.sleep(self.cfg.detail_pause_seconds)
        return driver.page_source

    # Сборка словаря свойств карточки
    def _extract_properties(self, soup: BeautifulSoup) -> dict[str, str]:
        properties: dict[str, str] = {}
        for item in soup.select(".detail-info__chars-item"):
            title_element = item.select_one(".properties__title")
            value_element = item.select_one(".properties__value")
            title = self._normalize_text(
                title_element.get_text(" ", strip=True) if title_element else ""
            )
            value = self._normalize_text(
                value_element.get_text(" ", strip=True) if value_element else ""
            )
            if title and value:
                properties[title] = value
        return properties

    # Извлечение логотипа карточки
    def _extract_logo_url(self, soup: BeautifulSoup) -> str:
        logo_element = soup.select_one(".defail-info__logo img, .detail-info__text img")
        if logo_element:
            logo_src = (
                logo_element.get("data-src")
                or logo_element.get("src")
                or logo_element.get("data-lazy")
                or ""
            )
            logo_src = self._normalize_text(logo_src)
            if logo_src:
                return urljoin(self.cfg.base_url, logo_src)

        og_image = soup.select_one("meta[property='og:image']")
        og_image_url = self._normalize_text(og_image.get("content", "") if og_image else "")
        return urljoin(self.cfg.base_url, og_image_url) if og_image_url else ""

    # Извлечение описания карточки с абзацами
    def _extract_description(self, soup: BeautifulSoup) -> str:
        paragraphs: list[str] = []
        selectors = [
            ".detail-info__text p",
            ".detail-block.desc p",
            "[itemprop='description'] p",
            ".services-detail__bottom-info p",
            ".detail-block.desc .introtext",
            ".detail-block.desc .content",
        ]
        for selector in selectors:
            for element in soup.select(selector):
                text = self._normalize_text(element.get_text(" ", strip=True))
                if text and text not in paragraphs:
                    paragraphs.append(text)

        skip_texts = {"Назад к списку", "Товары", "."}
        filtered = [p for p in paragraphs if p not in skip_texts and len(p) > 2]
        return "\n\n".join(filtered)

    # Извлечение ссылок на фото
    def _extract_photo_urls(self, soup: BeautifulSoup) -> list[str]:
        photo_urls: list[str] = []
        for link in soup.select("a[data-fancybox='big-gallery'][href]"):
            photo_url = self._normalize_text(link.get("href", ""))
            if not photo_url:
                continue
            full_url = urljoin(self.cfg.base_url, photo_url)
            if full_url not in photo_urls:
                photo_urls.append(full_url)
        return photo_urls

    # Извлечение координат
    def _extract_coordinates(self, html: str, page_text: str) -> tuple[str, str, str]:
        coordinates_match = re.search(
            r"Точные координаты:\s*N\s*([0-9.]+)\s*°?\s*E\s*([0-9.]+)",
            page_text,
            flags=re.IGNORECASE,
        )
        if coordinates_match:
            lat = coordinates_match.group(1)
            lon = coordinates_match.group(2)
            return lat, lon, f"N{lat} E{lon}"

        route_match = re.search(
            r"lat_to=([0-9.]+).*?lon_to=([0-9.]+)",
            html,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if route_match:
            lat = route_match.group(1)
            lon = route_match.group(2)
            return lat, lon, f"N{lat} E{lon}"

        return "", "", ""

    # Форматирование населенного пункта
    def _format_locality(self, address_data: dict[str, Any]) -> str:
        locality_mapping = [
            ("village", "с."),
            ("hamlet", "х."),
            ("town", "г."),
            ("city", "г."),
            ("municipality", ""),
            ("suburb", ""),
        ]
        for field_name, prefix in locality_mapping:
            field_value = self._normalize_text(address_data.get(field_name, ""))
            if field_value:
                return f"{prefix} {field_value}".strip()
        return ""

    # Форматирование улицы
    def _format_road(self, road_value: str) -> str:
        road_text = self._normalize_text(road_value)
        if not road_text:
            return ""

        replacements = {
            "улица ": "ул. ",
            "ул. ": "ул. ",
            "переулок ": "пер. ",
            "пер. ": "пер. ",
            "проспект ": "пр-кт ",
            "пр. ": "пр-кт ",
            "проезд ": "пр-д ",
            "шоссе ": "ш. ",
            "набережная ": "наб. ",
        }
        lowered_road = road_text.lower()
        for source_prefix, target_prefix in replacements.items():
            if lowered_road.startswith(source_prefix):
                return f"{target_prefix}{road_text[len(source_prefix):].strip()}"
        return f"ул. {road_text}"

    # Генерация адреса по координатам
    def _reverse_geocode(self, lat: str, lon: str) -> str:
        if not self.cfg.geocode_enabled or not lat or not lon:
            return ""

        cache_key = (lat, lon)
        if cache_key in self.address_cache:
            return self.address_cache[cache_key]

        try:
            response = requests.get(
                self.cfg.reverse_geocode_url,
                params={
                    "format": "jsonv2",
                    "lat": lat,
                    "lon": lon,
                    "zoom": 18,
                    "addressdetails": 1,
                    "accept-language": "ru",
                },
                headers={"User-Agent": self.cfg.user_agent},
                timeout=self.cfg.wait_timeout,
            )
            response.raise_for_status()
            payload = response.json()
        except Exception:
            return ""

        time.sleep(self.cfg.geocode_pause_seconds)
        address_data = payload.get("address", {})
        locality = self._format_locality(address_data)
        road = self._format_road(
            address_data.get("road")
            or address_data.get("pedestrian")
            or address_data.get("residential")
            or ""
        )
        house_number = self._normalize_text(address_data.get("house_number", ""))
        address_parts = [part for part in (locality, road, house_number) if part]
        generated_address = ", ".join(address_parts)

        if not generated_address:
            display_name = self._normalize_text(payload.get("display_name", ""))
            generated_address = ", ".join(display_name.split(", ")[:3]) if display_name else ""

        self.address_cache[cache_key] = generated_address
        return generated_address

    # Разбор HTML карточки винодельни
    def _parse_detail_html(
        self,
        html: str,
        item: dict[str, str],
        row_index: int,
    ) -> dict[str, Any]:
        soup = BeautifulSoup(html, "html.parser")
        page_text = soup.get_text("\n", strip=True)
        properties = self._extract_properties(soup)
        winery_name = self._normalize_text(
            soup.select_one("h1").get_text(" ", strip=True) if soup.select_one("h1") else item["name"]
        )
        lat, lon, coordinates_raw = self._extract_coordinates(html, page_text)

        return {
            "wines_id": f"{row_index:03d}",
            "name": winery_name.removeprefix("Винодельня").strip() or item["name"],
            "source_location": properties.get("Местоположение", item["location"]),
            "card_url": item["url"],
            "logo_url": self._extract_logo_url(soup),
            "size": properties.get("Размер виноградников", ""),
            "description": self._extract_description(soup),
            "photo_urls": ";".join(self._extract_photo_urls(soup)),
            "lat": lat,
            "lon": lon,
            "coordinates_raw": coordinates_raw.replace("Точные координаты: ", ""),
            "address": self._reverse_geocode(lat, lon),
        }

    # Разбор одной карточки винодельни
    def _parse_detail_item(
        self,
        driver: webdriver.Edge,
        item: dict[str, str],
        row_index: int,
    ) -> dict[str, Any] | None:
        try:
            html = self._fetch_detail_html(driver, item["url"])
            return self._parse_detail_html(html, item, row_index)
        except Exception as exc:
            print(f"[scraper] Ошибка карточки {item['url']}: {exc}")
            return None

    # Полный сбор виноделен с сайта
    def scrape(self) -> list[dict[str, Any]]:
        driver = self._build_driver()
        try:
            self._open_page(driver, self.cfg.source_url)
            self._accept_age_gate(driver)
            self._click_load_more_until_end(driver)
            listing_items = self._extract_listing_items(driver.page_source)
            total = len(listing_items)
            print(f"[scraper] Найдено карточек: {total}")

            rows: list[dict[str, Any]] = []
            for index, item in enumerate(listing_items, start=1):
                row = self._parse_detail_item(driver, item, index)
                if row is None:
                    continue
                rows.append(row)
                print(f"[scraper] {index}/{total} обработано: {row['name']}")

            rows.sort(key=lambda row: row["wines_id"])
            return rows
        finally:
            driver.quit()

    # Сохранение виноделен в CSV
    def write_rows(self, rows: list[dict[str, Any]]) -> None:
        self.csv_session.write_rows(
            self.paths.scrapping_csv_path,
            self.columns,
            rows,
        )

    # Полный скрапинг с сохранением
    def scrape_and_save(self) -> list[dict[str, Any]]:
        rows = self.scrape()
        self.write_rows(rows)
        print(f"[scraper] Сохранено строк: {len(rows)}")
        print(f"[scraper] CSV: {self.paths.scrapping_csv_path}")
        return rows


from app.services.scrapping import RussianWineriesScraper

# Запуск
if __name__ == "__main__":
    RussianWineriesScraper().scrape_and_save()
