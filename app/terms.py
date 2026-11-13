import time
from datetime import date, datetime
from zoneinfo import ZoneInfo

import httpx

from app.config import settings

CALENDAR_URL = "https://anteaterapi.com/v2/rest/calendar/all"
REGULAR_QUARTERS = ("Winter", "Spring", "Fall")
DAY = 24 * 60 * 60
RETRY_AFTER = 10 * 60


def term_for(today: date, calendar: list[dict]) -> str | None:
    upcoming = [
        q
        for q in calendar
        if q["quarter"] in REGULAR_QUARTERS and date.fromisoformat(q["finalsEnd"]) >= today
    ]
    if not upcoming:
        return None
    quarter = min(upcoming, key=lambda q: q["finalsEnd"])
    return f"{quarter['year']}-{quarter['quarter'].lower()}"


def month_term(today: date) -> str:
    quarter = "winter" if today.month <= 3 else "spring" if today.month <= 6 else "fall"
    return f"{today.year}-{quarter}"


def term_label(term: str) -> str:
    year, quarter = term.split("-", 1)
    return f"{quarter.capitalize()} {year}"


def fetch_calendar() -> list[dict]:
    response = httpx.get(CALENDAR_URL, timeout=10)
    response.raise_for_status()
    return response.json()["data"]


def _today() -> date:
    return datetime.now(ZoneInfo(settings.timezone)).date()


def _clock() -> float:
    return time.monotonic()


_cache: dict = {"calendar": None, "next_fetch": 0.0}


def _calendar() -> list[dict] | None:
    now = _clock()
    if now >= _cache["next_fetch"]:
        try:
            _cache["calendar"] = fetch_calendar()
            _cache["next_fetch"] = now + DAY
        except (httpx.HTTPError, KeyError, ValueError):
            _cache["next_fetch"] = now + RETRY_AFTER
    return _cache["calendar"]


def current_term() -> str:
    if settings.current_term:
        return settings.current_term
    today = _today()
    calendar = _calendar()
    return (calendar and term_for(today, calendar)) or month_term(today)
