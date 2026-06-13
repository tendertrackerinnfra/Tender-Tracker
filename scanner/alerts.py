from __future__ import annotations

import datetime as dt
from dataclasses import asdict, dataclass
from typing import Literal

from scanner.market_mood import MarketMoodResult
from scanner.sector_strength import SectorScore
from scanner.stock_ranking import StockScore

AlertPriority = Literal["Critical", "High", "Medium", "Low"]


@dataclass(frozen=True)
class MarketAlert:
    alert_key: str
    priority: AlertPriority
    title: str
    reason: str
    sector: str
    stocks_affected: list[str]
    alert_type: str
    trigger_value: float
    threshold_value: float
    timestamp: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def generate_alerts(
    report_date: str,
    session: str,
    mood: MarketMoodResult,
    sector_scores: list[SectorScore],
    stock_scores: list[StockScore],
    previous_market_mood: str | None,
) -> list[MarketAlert]:
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    alerts: list[MarketAlert] = []

    if previous_market_mood and previous_market_mood != mood.mood:
        alerts.append(
            MarketAlert(
                alert_key=f"{report_date}:{session}:mood:{previous_market_mood}:{mood.mood}",
                priority="Critical",
                title=f"Critical: Market mood changed to {mood.mood}",
                reason=f"Market mood changed from {previous_market_mood} to {mood.mood}. {mood.explanation}",
                sector="Broad Market",
                stocks_affected=[],
                alert_type="market_mood_change",
                trigger_value=mood.score,
                threshold_value=0,
                timestamp=timestamp,
            )
        )

    for sector in sector_scores:
        move = sector.one_day_change_percent
        absolute_move = abs(move)
        if absolute_move > 2:
            priority: AlertPriority = "Critical"
        elif absolute_move > 1.25:
            priority = "High"
        elif absolute_move > 0.75:
            priority = "Medium"
        else:
            continue

        direction = "up" if move > 0 else "down"
        alerts.append(
            MarketAlert(
                alert_key=f"{report_date}:{session}:sector:{sector.sector}:{round(move, 2)}",
                priority=priority,
                title=f"{priority}: {sector.sector} moved {direction} {abs(move):.2f}%",
                reason=f"{sector.sector} recorded a {move:.2f}% move with sector score {sector.sector_score:.0f}.",
                sector=sector.sector,
                stocks_affected=[],
                alert_type="sector_move",
                trigger_value=round(move, 2),
                threshold_value=2 if priority == "Critical" else 1.25 if priority == "High" else 0.75,
                timestamp=timestamp,
            )
        )

    for stock in stock_scores:
        stock_alerts = _stock_alerts(report_date, session, stock, timestamp)
        alerts.extend(stock_alerts)

    return _dedupe_alerts(alerts)


def _stock_alerts(report_date: str, session: str, stock: StockScore, timestamp: str) -> list[MarketAlert]:
    alerts: list[MarketAlert] = []
    move = stock.one_day_change_percent
    absolute_move = abs(move)

    if absolute_move > 5:
        direction = "up" if move > 0 else "down"
        alerts.append(
            MarketAlert(
                alert_key=f"{report_date}:{session}:stock_move:{stock.symbol}:{round(move, 2)}",
                priority="Critical",
                title=f"Critical: {stock.symbol} moved {direction} {absolute_move:.2f}%",
                reason=f"{stock.name} moved {move:.2f}% in the latest scan.",
                sector=stock.sector,
                stocks_affected=[stock.symbol],
                alert_type="stock_move",
                trigger_value=round(move, 2),
                threshold_value=5,
                timestamp=timestamp,
            )
        )
    elif absolute_move > 3:
        alerts.append(
            MarketAlert(
                alert_key=f"{report_date}:{session}:stock_move_high:{stock.symbol}:{round(move, 2)}",
                priority="High",
                title=f"High: {stock.symbol} notable price move",
                reason=f"{stock.name} moved {move:.2f}% in the latest scan.",
                sector=stock.sector,
                stocks_affected=[stock.symbol],
                alert_type="stock_move",
                trigger_value=round(move, 2),
                threshold_value=3,
                timestamp=timestamp,
            )
        )

    if stock.volume_ratio > 3:
        alerts.append(
            MarketAlert(
                alert_key=f"{report_date}:{session}:volume:{stock.symbol}:{round(stock.volume_ratio, 2)}",
                priority="Critical",
                title=f"Critical: {stock.symbol} volume above 3x average",
                reason=f"{stock.name} volume expanded to {stock.volume_ratio:.2f}x its recent average.",
                sector=stock.sector,
                stocks_affected=[stock.symbol],
                alert_type="volume_spike",
                trigger_value=round(stock.volume_ratio, 2),
                threshold_value=3,
                timestamp=timestamp,
            )
        )
    elif stock.volume_ratio > 2:
        alerts.append(
            MarketAlert(
                alert_key=f"{report_date}:{session}:volume_high:{stock.symbol}:{round(stock.volume_ratio, 2)}",
                priority="High",
                title=f"High: {stock.symbol} volume expansion",
                reason=f"{stock.name} volume expanded to {stock.volume_ratio:.2f}x its recent average.",
                sector=stock.sector,
                stocks_affected=[stock.symbol],
                alert_type="volume_spike",
                trigger_value=round(stock.volume_ratio, 2),
                threshold_value=2,
                timestamp=timestamp,
            )
        )
    elif stock.total_score >= 70:
        alerts.append(
            MarketAlert(
                alert_key=f"{report_date}:{session}:score:{stock.symbol}:{round(stock.total_score, 0)}",
                priority="Medium",
                title=f"Medium: {stock.symbol} focus score elevated",
                reason=f"{stock.name} has a focus score of {stock.total_score:.0f}.",
                sector=stock.sector,
                stocks_affected=[stock.symbol],
                alert_type="focus_score",
                trigger_value=round(stock.total_score, 2),
                threshold_value=70,
                timestamp=timestamp,
            )
        )

    if stock.setup_quality_score >= 72 or stock.attention_score >= 75:
        alerts.append(
            MarketAlert(
                alert_key=f"{report_date}:{session}:setup:{stock.symbol}:{round(stock.setup_quality_score, 0)}:{round(stock.attention_score, 0)}",
                priority="High" if stock.setup_quality_score < 82 else "Critical",
                title=f"{stock.symbol} research setup quality elevated",
                reason=(
                    f"{stock.name} setup quality {stock.setup_quality_score:.0f}/100 and attention score "
                    f"{stock.attention_score:.0f}/100. Watch zones: support {stock.support_zone_low:.2f}-"
                    f"{stock.support_zone_high:.2f}, resistance {stock.resistance_zone_low:.2f}-"
                    f"{stock.resistance_zone_high:.2f}. {stock.risk_note}"
                ),
                sector=stock.sector,
                stocks_affected=[stock.symbol],
                alert_type="research_setup_quality",
                trigger_value=round(stock.setup_quality_score, 2),
                threshold_value=72,
                timestamp=timestamp,
            )
        )

    return alerts


def _dedupe_alerts(alerts: list[MarketAlert]) -> list[MarketAlert]:
    seen: set[str] = set()
    deduped: list[MarketAlert] = []
    for alert in alerts:
        if alert.alert_key in seen:
            continue
        seen.add(alert.alert_key)
        deduped.append(alert)
    return deduped
