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
    attention_score: float
    setup_quality_score: float
    setup_direction: str
    reference_price: float
    support_zone_low: float
    support_zone_high: float
    resistance_zone_low: float
    resistance_zone_high: float
    historical_edge_score: float
    risk_note: str
    catalyst_summary: str
    research_note: str

    def to_dict(self) -> dict[str, float | int | str]:
        return asdict(self)


def rank_stocks(
    stock_series: dict[str, PriceSeries],
    stock_metadata: dict[str, dict[str, str]],
    benchmark: PriceSeries,
    limit: int = 20,
    catalyst_score: float = 50.0,
) -> list[StockScore]:
    rows: list[StockScore] = []
    benchmark_20d = benchmark.change_percent(20)

    for symbol, series in stock_series.items():
        metadata = stock_metadata[symbol]
        relative_strength = _relative_strength_score(series.change_percent(20), benchmark_20d)
        volume_spike = _volume_spike_score(series.volume_ratio(20))
        breakout = _breakout_score(series.high_breakout_percent(20))
        trend_strength = _trend_strength_score(series)
        news_impact = catalyst_score
        historical_edge = _historical_edge_score(series)
        attention_score = _attention_score(relative_strength, volume_spike, breakout, trend_strength, news_impact)
        setup_quality = _setup_quality_score(relative_strength, volume_spike, breakout, trend_strength, historical_edge, news_impact)
        support_low, support_high, resistance_low, resistance_high = _research_zones(series)
        setup_direction = _setup_direction(setup_quality, series.change_percent(1), trend_strength)
        risk_note = _risk_note(series, setup_quality)
        catalyst_summary = _catalyst_summary(news_impact)
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
                attention_score=round(attention_score, 2),
                setup_quality_score=round(setup_quality, 2),
                setup_direction=setup_direction,
                reference_price=round(series.latest_close, 2),
                support_zone_low=round(support_low, 2),
                support_zone_high=round(support_high, 2),
                resistance_zone_low=round(resistance_low, 2),
                resistance_zone_high=round(resistance_high, 2),
                historical_edge_score=round(historical_edge, 2),
                risk_note=risk_note,
                catalyst_summary=catalyst_summary,
                research_note=_research_note(
                    relative_strength,
                    volume_ratio,
                    breakout_percent,
                    trend_strength,
                    setup_quality,
                    support_low,
                    support_high,
                    resistance_low,
                    resistance_high,
                ),
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


def _historical_edge_score(series: PriceSeries) -> float:
    positive_days = 0
    checked_days = min(20, len(series.closes) - 1)
    for index in range(1, checked_days + 1):
        if series.closes[-index] > series.closes[-index - 1]:
            positive_days += 1
    consistency = (positive_days / checked_days) * 100 if checked_days else 50
    volatility_penalty = min(series.average_range_percent(14) * 4, 35)
    return clamp((consistency * 0.7) + 35 - volatility_penalty)


def _attention_score(
    relative_strength: float,
    volume_spike: float,
    breakout: float,
    trend_strength: float,
    news_impact: float,
) -> float:
    return clamp(
        (relative_strength * 0.25)
        + (volume_spike * 0.25)
        + (breakout * 0.2)
        + (trend_strength * 0.15)
        + (news_impact * 0.15)
    )


def _setup_quality_score(
    relative_strength: float,
    volume_spike: float,
    breakout: float,
    trend_strength: float,
    historical_edge: float,
    news_impact: float,
) -> float:
    return clamp(
        (relative_strength * 0.22)
        + (volume_spike * 0.18)
        + (breakout * 0.2)
        + (trend_strength * 0.2)
        + (historical_edge * 0.12)
        + (news_impact * 0.08)
    )


def _research_zones(series: PriceSeries) -> tuple[float, float, float, float]:
    latest = series.latest_close
    low_20 = series.recent_low(20)
    high_20 = series.recent_high(20)
    range_buffer = max(series.average_range_percent(14), 0.4) / 100
    support_high = max(low_20, latest * (1 - range_buffer))
    support_low = support_high * (1 - range_buffer)
    resistance_low = min(high_20, latest * (1 + range_buffer))
    resistance_high = resistance_low * (1 + range_buffer)
    return support_low, support_high, resistance_low, resistance_high


def _setup_direction(setup_quality: float, one_day_change: float, trend_strength: float) -> str:
    if setup_quality >= 65 and trend_strength >= 55 and one_day_change >= -1:
        return "long-watch"
    if setup_quality <= 40 and trend_strength <= 45:
        return "weakness-watch"
    return "neutral-watch"


def _risk_note(series: PriceSeries, setup_quality: float) -> str:
    average_range = series.average_range_percent(14)
    if average_range >= 4:
        return "High volatility; wait for confirmation and manage position risk."
    if setup_quality >= 70:
        return "Quality is elevated, but avoid chasing extended moves without confirmation."
    return "Mixed setup; use as watchlist context, not a trade call."


def _catalyst_summary(news_impact: float) -> str:
    if news_impact >= 58:
        return "Catalyst tone is supportive in latest scanned headlines."
    if news_impact <= 42:
        return "Catalyst tone carries caution in latest scanned headlines."
    return "Catalyst tone is mixed or neutral."


def _research_note(
    relative_strength: float,
    volume_ratio: float,
    breakout_percent: float,
    trend_strength: float,
    setup_quality: float,
    support_low: float,
    support_high: float,
    resistance_low: float,
    resistance_high: float,
) -> str:
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
    return (
        "Research signal: "
        + ", ".join(signals)
        + f". Setup quality {setup_quality:.0f}/100. Research support zone {support_low:.2f}-{support_high:.2f}; "
        + f"resistance zone {resistance_low:.2f}-{resistance_high:.2f}. No buy/sell recommendation."
    )
