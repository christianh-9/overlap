from datetime import date

import httpx
import pytest

from app import terms
from app.config import settings
from app.terms import month_term, term_for, term_label

# Real dates from Anteater API's /calendar/all, trimmed to the fields used.
CALENDAR = [
    {"year": "2026", "quarter": "Spring", "finalsEnd": "2026-06-11"},
    {"year": "2026", "quarter": "Summer1", "finalsEnd": "2026-07-29"},
    {"year": "2026", "quarter": "Summer2", "finalsEnd": "2026-09-09"},
    {"year": "2026", "quarter": "Fall", "finalsEnd": "2026-12-11"},
    {"year": "2027", "quarter": "Winter", "finalsEnd": "2027-03-19"},
    {"year": "2027", "quarter": "Spring", "finalsEnd": "2027-06-10"},
    {"year": "2027", "quarter": "Summer10wk", "finalsEnd": "2027-08-27"},
]


@pytest.mark.parametrize(
    ("today", "expected"),
    [
        (date(2026, 11, 12), "2026-fall"),
        (date(2026, 12, 11), "2026-fall"),  # last day of fall finals
        (date(2026, 12, 12), "2027-winter"),  # the break: time to add winter classes
        (date(2027, 1, 20), "2027-winter"),
        (date(2027, 4, 15), "2027-spring"),
        (date(2026, 7, 15), "2026-fall"),  # summer sessions are skipped
    ],
)
def test_term_for_follows_finals(today, expected):
    assert term_for(today, CALENDAR) == expected


def test_term_for_is_none_once_the_calendar_runs_out():
    # Summer 2027: Fall 2027 isn't published yet.
    assert term_for(date(2027, 7, 1), CALENDAR) is None
    assert term_for(date(2027, 7, 1), []) is None


@pytest.mark.parametrize(
    ("today", "expected"),
    [
        (date(2027, 2, 1), "2027-winter"),
        (date(2027, 5, 1), "2027-spring"),
        (date(2027, 7, 1), "2027-fall"),
        (date(2026, 11, 1), "2026-fall"),
    ],
)
def test_month_term(today, expected):
    assert month_term(today) == expected


def test_term_label():
    assert term_label("2027-winter") == "Winter 2027"
    assert term_label("2026-fall") == "Fall 2026"


@pytest.fixture
def auto(monkeypatch):
    """current_term() with no override, a fixed date, a fake clock, and a fake fetch."""
    monkeypatch.setattr(settings, "current_term", None)
    monkeypatch.setattr(terms, "_cache", {"calendar": None, "next_fetch": 0.0})
    monkeypatch.setattr(terms, "_today", lambda: date(2026, 12, 12))
    state = {"now": 1000.0, "fetches": 0, "fail": False}
    monkeypatch.setattr(terms, "_clock", lambda: state["now"])

    def fake_fetch():
        state["fetches"] += 1
        if state["fail"]:
            raise httpx.ConnectError("down")
        return CALENDAR

    monkeypatch.setattr(terms, "fetch_calendar", fake_fetch)
    return state


def test_override_wins(monkeypatch, auto):
    monkeypatch.setattr(settings, "current_term", "2026-spring")
    assert terms.current_term() == "2026-spring"
    assert auto["fetches"] == 0


def test_uses_the_calendar_and_fetches_once_a_day(auto):
    assert terms.current_term() == "2027-winter"
    assert terms.current_term() == "2027-winter"
    assert auto["fetches"] == 1

    auto["now"] += terms.DAY
    terms.current_term()
    assert auto["fetches"] == 2


def test_failed_fetch_keeps_the_last_calendar(auto):
    terms.current_term()
    auto["now"] += terms.DAY
    auto["fail"] = True
    assert terms.current_term() == "2027-winter"


def test_no_calendar_falls_back_to_the_month(auto):
    auto["fail"] = True
    assert terms.current_term() == "2026-fall"  # December, by month


def test_failed_fetch_waits_before_trying_again(auto):
    # During an outage, only one request in a while should wait on the timeout.
    auto["fail"] = True
    terms.current_term()
    terms.current_term()
    assert auto["fetches"] == 1
    auto["now"] += terms.RETRY_AFTER
    terms.current_term()
    assert auto["fetches"] == 2
