from __future__ import annotations

import os
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from typing import Iterable
from urllib.parse import quote_plus

import requests


POSITIVE_TERMS = {
    "rally",
    "gain",
    "surge",
    "record",
    "breakout",
    "approval",
    "deal",
    "order",
    "beats",
    "growth",
    "inflow",
    "upgrade",
}

NEGATIVE_TERMS = {
    "war",
    "attack",
    "conflict",
    "fall",
    "crash",
    "slump",
    "selloff",
    "downgrade",
    "probe",
    "fraud",
    "misses",
    "outflow",
    "sanction",
    "tariff",
}

DEFAULT_QUERIES = [
    "India stock market Nifty today",
    "Nifty Bank India market today",
    "India market FII DII flow today",
    "India stock market crude oil war rupee dollar",
    "NSE corporate announcements today",
]


@dataclass(frozen=True)
class CatalystItem:
    title: str
    source: str
    url: str
    sentiment: str
    score: float

    def to_dict(self) -> dict[str, str | float]:
        return asdict(self)


@dataclass(frozen=True)
class CatalystSummary:
    score: float
    sentiment: str
    risk_flags: list[str]
    items: list[CatalystItem]

    def to_dict(self) -> dict[str, object]:
        return {
            "score": self.score,
            "sentiment": self.sentiment,
            "risk_flags": self.risk_flags,
            "items": [item.to_dict() for item in self.items],
        }


def fetch_market_catalysts(timeout: int = 12) -> CatalystSummary:
    queries = _configured_queries()
    items: list[CatalystItem] = []

    for query in queries:
        try:
            items.extend(_fetch_google_news_rss(query, timeout=timeout))
        except Exception as exc:
            items.append(
                CatalystItem(
                    title=f"Catalyst fetch failed for '{query}': {exc}",
                    source="scanner",
                    url="",
                    sentiment="neutral",
                    score=50.0,
                )
            )

    deduped = _dedupe_items(items)[:12]
    score = round(sum(item.score for item in deduped) / len(deduped), 2) if deduped else 50.0
    risk_flags = _risk_flags(item.title for item in deduped)
    sentiment = "positive" if score >= 58 else "negative" if score <= 42 else "mixed"
    return CatalystSummary(score=score, sentiment=sentiment, risk_flags=risk_flags, items=deduped)


def catalyst_score_for_text(text: str, market_score: float = 50.0) -> float:
    text_score = _headline_score(text)
    return round((text_score * 0.65) + (market_score * 0.35), 2)


def _configured_queries() -> list[str]:
    raw = os.getenv("MARKET_CATALYST_QUERIES", "")
    if not raw.strip():
        return DEFAULT_QUERIES
    return [part.strip() for part in raw.split("|") if part.strip()]


def _fetch_google_news_rss(query: str, timeout: int) -> list[CatalystItem]:
    url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-IN&gl=IN&ceid=IN:en"
    response = requests.get(url, headers={"User-Agent": "TerminalXTradingScanner/1.0"}, timeout=timeout)
    response.raise_for_status()
    root = ET.fromstring(response.content)
    rows: list[CatalystItem] = []

    for item in root.findall("./channel/item")[:4]:
        title = item.findtext("title", default="").strip()
        link = item.findtext("link", default="").strip()
        source = item.findtext("source", default="News").strip()
        score = _headline_score(title)
        rows.append(
            CatalystItem(
                title=title,
                source=source,
                url=link,
                sentiment="positive" if score >= 58 else "negative" if score <= 42 else "neutral",
                score=score,
            )
        )

    return rows


def _headline_score(text: str) -> float:
    lowered = text.lower()
    positive_hits = sum(1 for term in POSITIVE_TERMS if term in lowered)
    negative_hits = sum(1 for term in NEGATIVE_TERMS if term in lowered)
    return max(0.0, min(100.0, 50.0 + (positive_hits * 8) - (negative_hits * 10)))


def _risk_flags(headlines: Iterable[str]) -> list[str]:
    text = " ".join(headlines).lower()
    flags: list[str] = []
    for term in ["war", "attack", "conflict", "crude", "oil", "rupee", "dollar", "fii", "outflow", "tariff"]:
        if term in text:
            flags.append(term)
    return sorted(set(flags))


def _dedupe_items(items: list[CatalystItem]) -> list[CatalystItem]:
    seen: set[str] = set()
    deduped: list[CatalystItem] = []
    for item in items:
        key = item.title.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped
