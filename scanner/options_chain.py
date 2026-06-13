from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

import requests

from scanner.market_data import clamp
from scanner.market_mood import MarketMoodResult


NSE_OPTION_SYMBOLS = {
    "NIFTY": "NIFTY",
    "BANKNIFTY": "BANKNIFTY",
}


@dataclass(frozen=True)
class OptionStrikeCandidate:
    index: str
    option_type: str
    strike: float
    expiry: str
    last_price: float
    open_interest: float
    change_in_open_interest: float
    volume: float
    implied_volatility: float
    distance_from_spot_percent: float
    score: float
    reason: str
    risk_note: str

    def to_dict(self) -> dict[str, float | str]:
        return asdict(self)


@dataclass(frozen=True)
class IndexOptionResearch:
    index: str
    spot: float
    expiry: str
    put_call_ratio: float
    max_call_oi_strike: float
    max_put_oi_strike: float
    max_pain_strike: float
    trend_context: str
    data_status: str
    calls: list[OptionStrikeCandidate]
    puts: list[OptionStrikeCandidate]
    note: str

    def to_dict(self) -> dict[str, object]:
        return {
            "index": self.index,
            "spot": self.spot,
            "expiry": self.expiry,
            "putCallRatio": self.put_call_ratio,
            "maxCallOiStrike": self.max_call_oi_strike,
            "maxPutOiStrike": self.max_put_oi_strike,
            "maxPainStrike": self.max_pain_strike,
            "trendContext": self.trend_context,
            "dataStatus": self.data_status,
            "calls": [row.to_dict() for row in self.calls],
            "puts": [row.to_dict() for row in self.puts],
            "note": self.note,
        }


def build_options_research(mood: MarketMoodResult) -> list[dict[str, object]]:
    research: list[IndexOptionResearch] = []

    for label, symbol in NSE_OPTION_SYMBOLS.items():
        try:
            research.append(_fetch_nse_option_research(label, symbol, mood))
        except Exception as exc:
            research.append(_unavailable(label, f"NSE option-chain fetch failed: {exc}"))

    research.append(
        _unavailable(
            "SENSEX",
            "SENSEX options are traded on BSE. Configure a BSE option-chain data source before ranking SENSEX strikes.",
        )
    )

    return [row.to_dict() for row in research]


def _fetch_nse_option_research(label: str, symbol: str, mood: MarketMoodResult) -> IndexOptionResearch:
    payload = _fetch_nse_option_chain(symbol)
    records = payload.get("records", {})
    rows = records.get("data", [])
    expiry_dates = records.get("expiryDates", [])
    expiry = str(expiry_dates[0]) if expiry_dates else ""
    spot = float(records.get("underlyingValue") or 0)
    expiry_rows = [row for row in rows if row.get("expiryDate") == expiry]

    if not expiry_rows or spot <= 0:
        raise RuntimeError("No usable option-chain rows returned.")

    call_rows = [_option_payload(row, "CE", spot, expiry, label) for row in expiry_rows if row.get("CE")]
    put_rows = [_option_payload(row, "PE", spot, expiry, label) for row in expiry_rows if row.get("PE")]
    total_call_oi = sum(row.open_interest for row in call_rows)
    total_put_oi = sum(row.open_interest for row in put_rows)
    pcr = round(total_put_oi / total_call_oi, 2) if total_call_oi > 0 else 0.0
    max_call_oi = max(call_rows, key=lambda row: row.open_interest, default=None)
    max_put_oi = max(put_rows, key=lambda row: row.open_interest, default=None)
    max_pain = _max_pain_strike(expiry_rows)
    trend_context = _trend_context(label, mood)

    scored_calls = _rank_candidates(call_rows, mood, "CE")
    scored_puts = _rank_candidates(put_rows, mood, "PE")

    return IndexOptionResearch(
        index=label,
        spot=round(spot, 2),
        expiry=expiry,
        put_call_ratio=pcr,
        max_call_oi_strike=max_call_oi.strike if max_call_oi else 0.0,
        max_put_oi_strike=max_put_oi.strike if max_put_oi else 0.0,
        max_pain_strike=max_pain,
        trend_context=trend_context,
        data_status="ok",
        calls=scored_calls[:3],
        puts=scored_puts[:3],
        note="Options research only. Strike scores are not entry, exit, target, or stop-loss advice.",
    )


def _fetch_nse_option_chain(symbol: str) -> dict[str, Any]:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "Mozilla/5.0 TerminalXTradingScanner/1.0",
            "Accept": "application/json,text/plain,*/*",
            "Accept-Language": "en-IN,en;q=0.9",
            "Referer": "https://www.nseindia.com/option-chain",
        }
    )
    session.get("https://www.nseindia.com", timeout=15)
    response = session.get(
        "https://www.nseindia.com/api/option-chain-indices",
        params={"symbol": symbol},
        timeout=20,
    )
    response.raise_for_status()
    return response.json()


def _option_payload(row: dict[str, Any], option_type: str, spot: float, expiry: str, index: str) -> OptionStrikeCandidate:
    option = row[option_type]
    strike = float(option.get("strikePrice") or row.get("strikePrice") or 0)
    distance = ((strike - spot) / spot) * 100 if spot else 0.0
    if option_type == "PE":
        distance = ((spot - strike) / spot) * 100 if spot else 0.0

    return OptionStrikeCandidate(
        index=index,
        option_type="CALL" if option_type == "CE" else "PUT",
        strike=strike,
        expiry=expiry,
        last_price=float(option.get("lastPrice") or 0),
        open_interest=float(option.get("openInterest") or 0),
        change_in_open_interest=float(option.get("changeinOpenInterest") or 0),
        volume=float(option.get("totalTradedVolume") or 0),
        implied_volatility=float(option.get("impliedVolatility") or 0),
        distance_from_spot_percent=round(distance, 2),
        score=0.0,
        reason="",
        risk_note="",
    )


def _rank_candidates(
    rows: list[OptionStrikeCandidate],
    mood: MarketMoodResult,
    option_kind: str,
) -> list[OptionStrikeCandidate]:
    near_money = [row for row in rows if -1.5 <= row.distance_from_spot_percent <= 3.5]
    pool = near_money if near_money else rows
    max_oi = max((row.open_interest for row in pool), default=1)
    max_oi_change = max((max(row.change_in_open_interest, 0) for row in pool), default=1)
    max_volume = max((row.volume for row in pool), default=1)

    ranked: list[OptionStrikeCandidate] = []
    for row in pool:
        oi_score = (row.open_interest / max_oi) * 30 if max_oi else 0
        oi_change_score = (max(row.change_in_open_interest, 0) / max_oi_change) * 25 if max_oi_change else 0
        volume_score = (row.volume / max_volume) * 20 if max_volume else 0
        distance_score = max(0, 15 - (abs(row.distance_from_spot_percent) * 4))
        trend_score = _option_trend_score(mood, option_kind)
        total = clamp(oi_score + oi_change_score + volume_score + distance_score + trend_score)
        ranked.append(
            OptionStrikeCandidate(
                **{
                    **row.to_dict(),
                    "score": round(total, 2),
                    "reason": _reason(row, option_kind, total),
                    "risk_note": _risk_note(row),
                }
            )
        )

    return sorted(ranked, key=lambda candidate: candidate.score, reverse=True)


def _option_trend_score(mood: MarketMoodResult, option_kind: str) -> float:
    if option_kind == "CE" and mood.mood == "Bullish":
        return 10.0
    if option_kind == "PE" and mood.mood == "Bearish":
        return 10.0
    if mood.mood == "Sideways":
        return 5.0
    return 2.0


def _reason(row: OptionStrikeCandidate, option_kind: str, score: float) -> str:
    side = "call" if option_kind == "CE" else "put"
    return (
        f"{side.title()} watch strike with score {score:.0f}/100, OI {row.open_interest:.0f}, "
        f"OI change {row.change_in_open_interest:.0f}, volume {row.volume:.0f}, "
        f"distance from spot {row.distance_from_spot_percent:.2f}%."
    )


def _risk_note(row: OptionStrikeCandidate) -> str:
    if row.implied_volatility >= 25:
        return "High IV; premium can decay quickly if momentum fades."
    if abs(row.distance_from_spot_percent) > 2.5:
        return "Further from spot; needs stronger index move for follow-through."
    return "Near spot; confirm with price action and risk controls."


def _trend_context(label: str, mood: MarketMoodResult) -> str:
    if label == "BANKNIFTY":
        return f"Bank Nifty trend score {mood.bank_nifty_trend_score:.0f}/100 with market mood {mood.mood}."
    return f"Nifty trend score {mood.nifty_trend_score:.0f}/100 with market mood {mood.mood}."


def _max_pain_strike(rows: list[dict[str, Any]]) -> float:
    strikes = [float(row.get("strikePrice") or 0) for row in rows if row.get("strikePrice")]
    if not strikes:
        return 0.0
    candidates = strikes[:: max(1, len(strikes) // 35)]
    best_strike = candidates[0]
    best_pain = float("inf")

    for candidate in candidates:
        pain = 0.0
        for row in rows:
            strike = float(row.get("strikePrice") or 0)
            call_oi = float(row.get("CE", {}).get("openInterest") or 0)
            put_oi = float(row.get("PE", {}).get("openInterest") or 0)
            pain += max(0, candidate - strike) * call_oi
            pain += max(0, strike - candidate) * put_oi
        if pain < best_pain:
            best_pain = pain
            best_strike = candidate

    return round(best_strike, 2)


def _unavailable(index: str, note: str) -> IndexOptionResearch:
    return IndexOptionResearch(
        index=index,
        spot=0.0,
        expiry="",
        put_call_ratio=0.0,
        max_call_oi_strike=0.0,
        max_put_oi_strike=0.0,
        max_pain_strike=0.0,
        trend_context="Data unavailable.",
        data_status="unavailable",
        calls=[],
        puts=[],
        note=note,
    )
