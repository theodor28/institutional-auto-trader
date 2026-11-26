from __future__ import annotations

import re
import unittest
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1] / "piano_seo_live"
BASE_URL = "https://piano-express-seo-pro.onrender.com"
BUSINESS_PHONE = "5511982247766"


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.h1_count = 0
        self.h1_parts: list[str] = []
        self.description = ""
        self.canonical = ""
        self.links: list[str] = []
        self._in_title = False
        self._in_h1 = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "title":
            self._in_title = True
        elif tag == "h1":
            self.h1_count += 1
            self._in_h1 = True
        elif tag == "meta" and (values.get("name") or "").lower() == "description":
            self.description = values.get("content") or ""
        elif tag == "link" and "canonical" in (values.get("rel") or "").lower().split():
            self.canonical = values.get("href") or ""
        elif tag == "a" and values.get("href"):
            self.links.append(values["href"])

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif tag == "h1":
            self._in_h1 = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data)
        if self._in_h1:
            self.h1_parts.append(data)

    @property
    def title(self) -> str:
        return " ".join(" ".join(self.title_parts).split())

    @property
    def h1(self) -> str:
        return " ".join(" ".join(self.h1_parts).split())


def indexable_html_pages() -> list[Path]:
    return sorted(path for path in ROOT.rglob("*.html") if "monitor" not in path.parts)


class SiteQualityTests(unittest.TestCase):
    def test_public_pages_have_unique_titles_descriptions_canonicals_and_one_h1(self):
        pages = indexable_html_pages()
        self.assertGreaterEqual(len(pages), 14, "Expected the 14 public pages listed in the sitemap.")
        seen_titles: set[str] = set()
        seen_canonicals: set[str] = set()
        for path in pages:
            parser = PageParser()
            parser.feed(path.read_text(encoding="utf-8"))
            self.assertTrue(parser.title, f"Missing title: {path}")
            self.assertGreater(len(parser.title), 20, f"Title too short: {path}")
            self.assertNotIn(parser.title.casefold(), seen_titles, f"Duplicate title: {path}")
            seen_titles.add(parser.title.casefold())
            self.assertTrue(parser.description, f"Missing meta description: {path}")
            self.assertGreater(len(parser.description), 50, f"Description too short: {path}")
            self.assertEqual(parser.h1_count, 1, f"Expected exactly one H1 in {path}; got {parser.h1_count}")
            self.assertTrue(parser.h1, f"Empty H1: {path}")
            self.assertTrue(parser.canonical.startswith(BASE_URL), f"Missing or invalid canonical: {path}")
            self.assertNotIn(parser.canonical, seen_canonicals, f"Duplicate canonical: {path}")
            seen_canonicals.add(parser.canonical)

    def test_internal_links_resolve_to_existing_files(self):
        for source in indexable_html_pages():
            parser = PageParser()
            parser.feed(source.read_text(encoding="utf-8"))
            for href in parser.links:
                parts = urlsplit(href)
                if not parts.path.startswith("/") or href.startswith("//"):
                    continue
                local_path = Path(unquote(parts.path.lstrip("/")))
                target = ROOT / local_path
                if parts.path.endswith("/") or not target.suffix:
                    target = target / "index.html"
                self.assertTrue(target.is_file(), f"Broken internal link in {source}: {href}")

    def test_sitemap_matches_public_html_pages_without_duplicates(self):
        tree = ET.parse(ROOT / "sitemap.xml")
        namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        urls = [node.text or "" for node in tree.findall(".//sm:loc", namespace)]
        self.assertEqual(len(urls), len(set(urls)), "Duplicate URL in sitemap.")
        expected: set[str] = set()
        for page in indexable_html_pages():
            relative = page.relative_to(ROOT).as_posix()
            if relative == "index.html":
                expected.add(BASE_URL + "/")
            else:
                expected.add(BASE_URL + "/" + relative.removesuffix("index.html"))
        self.assertEqual(set(urls), expected)

    def test_all_public_pages_use_the_confirmed_whatsapp_number(self):
        for path in indexable_html_pages():
            content = path.read_text(encoding="utf-8")
            numbers = set(re.findall("wa[.]me/([0-9]+)", content))
            self.assertTrue(numbers, f"No WhatsApp CTA found: {path}")
            self.assertEqual(numbers, {BUSINESS_PHONE}, f"WhatsApp number mismatch in {path}: {numbers}")
            self.assertNotIn("95479-2433", content, f"Old phone number remains in {path}")

    def test_core_service_pages_target_distinct_search_intents(self):
        expected = {
            "afinacao-de-piano": "afinação de piano em são bernardo do campo",
            "transporte-de-piano": "transporte de piano em são bernardo do campo",
            "regulagem-de-piano": "regulagem de piano acústico em são bernardo do campo",
            "manutencao-de-piano": "manutenção de piano acústico em são bernardo do campo",
        }
        for slug, phrase in expected.items():
            page = ROOT / slug / "index.html"
            content = page.read_text(encoding="utf-8").casefold()
            self.assertIn(phrase, content, f"Missing primary search intent on {page}")


if __name__ == "__main__":
    unittest.main()
