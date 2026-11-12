import time
from datetime import date, datetime
from zoneinfo import ZoneInfo

import httpx

from app.config import settings

CALENDAR_URL = "https://anteaterapi.com/v2/rest/calendar/all"
# Summer sessions are left out: few students take them, and there are three.
REGULAR_QUARTERS = ("Winter", "Spring", "Fall")
DAY = 24 * 60 * 60
RETRY_AFTER = 10 * 60


def term_for(today: date, calendar: list[dict]) -> str | None:
    """The first regular quarter whose finals haven't ended, e.g. "2027-winter".

    A quarter stays current through its last day of finals, so the break after it
    already belongs to the next quarter, when students add their new classes.
    """
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
    """A rough guess for when the calendar is unavailable or hasn't been published that far."""
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


# ponytail: one copy per server process with no lock, so two requests can both
# refetch at the same moment; harmless at this scale.
_cache: dict = {"calendar": None, "next_fetch": 0.0}


def _calendar() -> list[dict] | None:
    now = _clock()
    if now >= _cache["next_fetch"]:
        try:
            _cache["calendar"] = fetch_calendar()
            _cache["next_fetch"] = now + DAY
        except (httpx.HTTPError, KeyError, ValueError):
            # Keep whatever loaded last, and don't make every request wait on a
            # timeout while Anteater API is down.
            _cache["next_fetch"] = now + RETRY_AFTER
    return _cache["calendar"]


def current_term() -> str:
    if settings.current_term:
        return settings.current_term
    today = _today()
    calendar = _calendar()
    return (calendar and term_for(today, calendar)) or month_term(today)
