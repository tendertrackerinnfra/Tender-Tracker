from __future__ import annotations

from dataclasses import asdict, dataclass

from scanner.market_data import PriceSeries, clamp


@dataclass(frozen=True)
class MarketMoodResult:
    mood: str
    score: float
    nifty_trend_score: float
    bank_nifty_trend_score: float
    india_vix_score: float
    advance_decline_score: float
    advance_decline_ratio: float
    nifty_value: float
    nifty_change_percent: float
    bank_nifty_value: float
    bank_nifty_change_percent: float
    india_vix_value: float
    india_vix_change_percent: float
    explanation: str

    def to_dict(self) -> dict[str, float | str]:
        return asdict(self)


def calculate_market_mood(
    nifty: PriceSeries,
    bank_nifty: PriceSeries,
    india_vix: PriceSeries,
    stock_series: list[PriceSeries],
) -> MarketMoodResult:
    nifty_score = _trend_score(nifty)
    bank_score = _trend_score(bank_nifty)
    vix_score = _vix_score(india_vix.latest_close)
    ad_ratio = _advance_decline_ratio(stock_series)
    ad_score = clamp(50 + ((ad_ratio - 1) * 35), 0, 100)

    score = (nifty_score * 0.35) + (bank_score * 0.25) + (vix_score * 0.2) + (ad_score * 0.2)

    if score >= 58:
        mood = "Bullish"
    elif score <= 42:
        mood = "Bearish"
    else:
        mood = "Sideways"

    explanation = (
        f"Nifty trend {nifty_score:.1f}, Bank Nifty trend {bank_score:.1f}, "
        f"India VIX risk score {vix_score:.1f}, advance/decline ratio {ad_ratio:.2f}."
    )

    return MarketMoodResult(
        mood=mood,
        score=round(score, 2),
        nifty_trend_score=round(nifty_score, 2),
        bank_nifty_trend_score=round(bank_score, 2),
        india_vix_score=round(vix_score, 2),
        advance_decline_score=round(ad_score, 2),
        advance_decline_ratio=round(ad_ratio, 2),
        nifty_value=round(nifty.latest_close, 2),
        nifty_change_percent=round(nifty.change_percent(1), 2),
        bank_nifty_value=round(bank_nifty.latest_close, 2),
        bank_nifty_change_percent=round(bank_nifty.change_percent(1), 2),
        india_vix_value=round(india_vix.latest_close, 2),
        india_vix_change_percent=round(india_vix.change_percent(1), 2),
        explanation=explanation,
    )


def _trend_score(series: PriceSeries) -> float:
    one_day = series.change_percent(1)
    five_day = series.change_percent(5)
    twenty_day = series.change_percent(20)
    distance_from_sma20 = ((series.latest_close - series.simple_moving_average(20)) / series.simple_moving_average(20)) * 100
    return clamp(50 + (one_day * 3) + (five_day * 4) + (twenty_day * 2) + (distance_from_sma20 * 3))


def _vix_score(vix_value: float) -> float:
    if vix_value <= 11:
        return 85.0
    if vix_value >= 22:
        return 15.0
    return clamp(85 - ((vix_value - 11) * (70 / 11)))


def _advance_decline_ratio(series_list: list[PriceSeries]) -> float:
    advances = sum(1 for series in series_list if series.change_percent(1) > 0)
    declines = sum(1 for series in series_list if series.change_percent(1) < 0)
    if declines == 0:
        return float(advances or 1)
    return advances / declines
