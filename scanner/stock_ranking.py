from __future__ import annotations

from dataclasses import asdict, dataclass

from scanner.market_data import PriceSeries, clamp


@dataclass(frozen=True)
class StockScore:
    rank: int
    symbol: str
    name: str
    sector: str
    total_score: float
    relative_strength_score: float
    volume_spike_score: float
    breakout_score: float
    trend_strength_score: float
    news_impact_score: float
    one_day_change_percent: float
    five_day_change_percent: float
    twenty_day_change_percent: float
    volume_ratio: float
    breakout_percent: float
    research_note: str

    def to_dict(self) -> dict[str, float | int | str]:
        return asdict(self)


def rank_stocks(
    stock_series: dict[str, PriceSeries],
    stock_metadata: dict[str, dict[str, str]],
    benchmark: PriceSeries,
    limit: int = 20,
) -> list[StockScore]:
    rows: list[StockScore] = []
    benchmark_20d = benchmark.change_percent(20)

    for symbol, series in stock_series.items():
        metadata = stock_metadata[symbol]
        relative_strength = _relative_strength_score(series.change_percent(20), benchmark_20d)
        volume_spike = _volume_spike_score(series.volume_ratio(20))
        breakout = _breakout_score(series.high_breakout_percent(20))
        trend_strength = _trend_strength_score(series)
        news_impact = 50.0
        total = (
            relative_strength * 0.3
            + volume_spike * 0.2
            + breakout * 0.2
            + trend_strength * 0.2
            + news_impact * 0.1
        )

        breakout_percent = series.high_breakout_percent(20)
        volume_ratio = series.volume_ratio(20)
        rows.append(
            StockScore(
                rank=0,
                symbol=symbol,
                name=metadata["name"],
                sector=metadata["sector"],
                total_score=round(clamp(total), 2),
                relative_strength_score=round(relative_strength, 2),
                volume_spike_score=round(volume_spike, 2),
                breakout_score=round(breakout, 2),
                trend_strength_score=round(trend_strength, 2),
                news_impact_score=news_impact,
                one_day_change_percent=round(series.change_percent(1), 2),
                five_day_change_percent=round(series.change_percent(5), 2),
                twenty_day_change_percent=round(series.change_percent(20), 2),
                volume_ratio=round(volume_ratio, 2),
                breakout_percent=round(breakout_percent, 2),
                research_note=_research_note(relative_strength, volume_ratio, breakout_percent, trend_strength),
            )
        )

    ranked = sorted(rows, key=lambda row: row.total_score, reverse=True)[:limit]
    return [
        StockScore(**{**row.to_dict(), "rank": index})
        for index, row in enumerate(ranked, start=1)
    ]


def _relative_strength_score(stock_20d: float, benchmark_20d: float) -> float:
    return clamp(50 + ((stock_20d - benchmark_20d) * 5))


def _volume_spike_score(volume_ratio: float) -> float:
    return clamp(35 + (volume_ratio * 25))


def _breakout_score(breakout_percent: float) -> float:
    if breakout_percent >= 0:
        return clamp(70 + (breakout_percent * 6))
    return clamp(50 + (breakout_percent * 5))


def _trend_strength_score(series: PriceSeries) -> float:
    sma20 = series.simple_moving_average(20)
    sma50 = series.simple_moving_average(50)
    if sma20 == 0 or sma50 == 0:
        return 50.0
    latest_vs_sma20 = ((series.latest_close - sma20) / sma20) * 100
    sma_spread = ((sma20 - sma50) / sma50) * 100
    return clamp(50 + (latest_vs_sma20 * 4) + (sma_spread * 3))


def _research_note(relative_strength: float, volume_ratio: float, breakout_percent: float, trend_strength: float) -> str:
    signals: list[str] = []
    if relative_strength >= 60:
        signals.append("relative strength")
    if volume_ratio >= 1.5:
        signals.append("volume expansion")
    if breakout_percent >= 0:
        signals.append("near or above 20-day high")
    if trend_strength >= 60:
        signals.append("trend participation")
    if not signals:
        signals.append("watchlist activity")
    return "Research signal: " + ", ".join(signals) + ". News impact is a neutral placeholder."
