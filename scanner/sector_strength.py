from __future__ import annotations

from dataclasses import asdict, dataclass

from scanner.market_data import PriceSeries, clamp


@dataclass(frozen=True)
class SectorScore:
    rank: int
    sector: str
    symbol: str
    sector_score: float
    relative_strength_score: float
    momentum_score: float
    trend_score: float
    one_day_change_percent: float
    five_day_change_percent: float
    twenty_day_change_percent: float

    def to_dict(self) -> dict[str, float | int | str]:
        return asdict(self)


def rank_sectors(sector_series: dict[str, PriceSeries], benchmark: PriceSeries) -> list[SectorScore]:
    rows: list[SectorScore] = []
    benchmark_20d = benchmark.change_percent(20)

    for sector, series in sector_series.items():
        relative_strength = _relative_strength_score(series.change_percent(20), benchmark_20d)
        momentum = _momentum_score(series)
        trend = _trend_score(series)
        sector_score = (relative_strength * 0.4) + (momentum * 0.35) + (trend * 0.25)

        rows.append(
            SectorScore(
                rank=0,
                sector=sector,
                symbol=series.symbol,
                sector_score=round(clamp(sector_score), 2),
                relative_strength_score=round(relative_strength, 2),
                momentum_score=round(momentum, 2),
                trend_score=round(trend, 2),
                one_day_change_percent=round(series.change_percent(1), 2),
                five_day_change_percent=round(series.change_percent(5), 2),
                twenty_day_change_percent=round(series.change_percent(20), 2),
            )
        )

    ranked = sorted(rows, key=lambda row: row.sector_score, reverse=True)
    return [
        SectorScore(**{**row.to_dict(), "rank": index})
        for index, row in enumerate(ranked, start=1)
    ]


def _relative_strength_score(sector_20d: float, benchmark_20d: float) -> float:
    spread = sector_20d - benchmark_20d
    return clamp(50 + (spread * 5))


def _momentum_score(series: PriceSeries) -> float:
    return clamp(50 + (series.change_percent(5) * 5) + (series.change_percent(20) * 2))


def _trend_score(series: PriceSeries) -> float:
    sma20 = series.simple_moving_average(20)
    sma50 = series.simple_moving_average(50)
    if sma20 == 0 or sma50 == 0:
        return 50.0
    latest_vs_sma20 = ((series.latest_close - sma20) / sma20) * 100
    sma_spread = ((sma20 - sma50) / sma50) * 100
    return clamp(50 + (latest_vs_sma20 * 4) + (sma_spread * 3))
