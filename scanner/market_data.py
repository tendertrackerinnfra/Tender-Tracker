from __future__ import annotations

from dataclasses import dataclass
from statistics import mean
from typing import Any

import requests


@dataclass(frozen=True)
class PriceSeries:
    symbol: str
    closes: list[float]
    highs: list[float]
    lows: list[float]
    volumes: list[float]

    @property
    def latest_close(self) -> float:
        return self.closes[-1]

    @property
    def previous_close(self) -> float:
        return self.closes[-2]

    @property
    def latest_volume(self) -> float:
        return self.volumes[-1] if self.volumes else 0

    def change_percent(self, periods: int = 1) -> float:
        if len(self.closes) <= periods:
            return 0.0
        start = self.closes[-periods - 1]
        if start == 0:
            return 0.0
        return ((self.closes[-1] - start) / start) * 100

    def simple_moving_average(self, periods: int) -> float:
        values = self.closes[-periods:] if len(self.closes) >= periods else self.closes
        return mean(values) if values else 0.0

    def average_volume(self, periods: int = 20) -> float:
        values = self.volumes[-periods - 1 : -1] if len(self.volumes) > 1 else []
        if not values:
            return 0.0
        return mean(values)

    def volume_ratio(self, periods: int = 20) -> float:
        average = self.average_volume(periods)
        if average <= 0:
            return 1.0
        return self.latest_volume / average

    def high_breakout_percent(self, periods: int = 20) -> float:
        if len(self.highs) < 2:
            return 0.0
        prior_highs = self.highs[-periods - 1 : -1] if len(self.highs) > periods else self.highs[:-1]
        if not prior_highs:
            return 0.0
        prior_high = max(prior_highs)
        if prior_high == 0:
            return 0.0
        return ((self.latest_close - prior_high) / prior_high) * 100

    def recent_high(self, periods: int = 20) -> float:
        values = self.highs[-periods:] if len(self.highs) >= periods else self.highs
        return max(values) if values else self.latest_close

    def recent_low(self, periods: int = 20) -> float:
        values = self.lows[-periods:] if len(self.lows) >= periods else self.lows
        return min(values) if values else self.latest_close

    def average_range_percent(self, periods: int = 14) -> float:
        ranges: list[float] = []
        for high, low, close in zip(self.highs[-periods:], self.lows[-periods:], self.closes[-periods:]):
            if close > 0:
                ranges.append(((high - low) / close) * 100)
        return mean(ranges) if ranges else 0.0


class YahooChartClient:
    def __init__(self, timeout: int = 20) -> None:
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "TerminalXTradingScanner/1.0"})

    def fetch(self, symbol: str, chart_range: str = "6mo", interval: str = "1d") -> PriceSeries:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        response = self.session.get(url, params={"range": chart_range, "interval": interval}, timeout=self.timeout)
        response.raise_for_status()
        payload: dict[str, Any] = response.json()
        result = payload["chart"]["result"][0]
        quote = result["indicators"]["quote"][0]

        closes = _clean_numeric(quote.get("close", []))
        highs = _clean_numeric(quote.get("high", []))
        lows = _clean_numeric(quote.get("low", []))
        volumes = _clean_numeric(quote.get("volume", []))

        if len(closes) < 22:
            raise ValueError(f"Not enough daily candles for {symbol}")

        return PriceSeries(symbol=symbol, closes=closes, highs=highs, lows=lows, volumes=volumes)


def _clean_numeric(values: list[Any]) -> list[float]:
    return [float(value) for value in values if value is not None]


def clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))
