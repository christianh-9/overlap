from datetime import time
from types import SimpleNamespace

import httpx
import pytest

from app import anteater, ucr
from app.anteater import CourseNotFound
from app.routers.schedule import get_fetcher
from app.ucr import banner_term, parse_details, parse_meetings

MEETINGS = {
    "fmt": [
        {
            "meetingTime": {
                "beginTime": "1530",
                "endTime": "1650",
                "monday": True,
                "tuesday": False,
                "wednesday": True,
                "thursday": False,
                "friday": False,
                "saturday": False,
                "sunday": False,
                "buildingDescription": "Winston Chung Hall",
                "room": "138",
            }
        },
        {
            "meetingTime": {
                "beginTime": None,
                "endTime": None,
                "monday": False,
                "tuesday": False,
                "wednesday": False,
                "thursday": False,
                "friday": False,
                "saturday": False,
                "sunday": False,
                "buildingDescription": None,
                "room": None,
            }
        },
    ]
}

DETAILS = """
<span id="subject">Computer Science</span>
<span id="courseNumber" style="display:none;">010A</span>
<span id="courseTitle">INTRO TO CS &amp; ENGINEERING</span>
"""


@pytest.mark.parametrize(
    ("term", "code"),
    [("2026-fall", "202640"), ("2027-winter", "202710"), ("2027-spring", "202720")],
)
def test_banner_term(term, code):
    assert banner_term(term) == code


def test_parse_meetings_expands_days_and_skips_online():
    meetings = parse_meetings(MEETINGS)
    assert [m.weekday for m in meetings] == [0, 2]
    assert meetings[0].start_time == time(15, 30)
    assert meetings[0].end_time == time(16, 50)
    assert meetings[0].location == "Winston Chung Hall 138"


def test_parse_details():
    assert parse_details(DETAILS) == ("Computer Science", "010A", "INTRO TO CS & ENGINEERING")


def fake_http(monkeypatch, details_status=200):
    request = httpx.Request("GET", "https://example.test")

    def post(url, **kwargs):
        return httpx.Response(details_status, text=DETAILS, request=request)

    def get(url, **kwargs):
        if url.endswith("get_subject"):
            return httpx.Response(
                200, json=[{"code": "CS", "description": "Computer Science"}], request=request
            )
        return httpx.Response(200, json=MEETINGS, request=request)

    monkeypatch.setattr(ucr.httpx, "post", post)
    monkeypatch.setattr(ucr.httpx, "get", get)


def test_fetch_section(monkeypatch):
    fake_http(monkeypatch)
    section = ucr.fetch_section("2026-fall", "30919")
    assert (section.dept, section.number) == ("CS", "010A")
    assert len(section.meetings) == 2


def test_unknown_crn(monkeypatch):
    fake_http(monkeypatch, details_status=500)
    with pytest.raises(CourseNotFound):
        ucr.fetch_section("2026-fall", "99999")


def test_each_campus_gets_its_own_lookup():

    def user(slug):
        return SimpleNamespace(campus=SimpleNamespace(slug=slug))

    assert get_fetcher(user("uci")) is anteater.fetch_section
    assert get_fetcher(user("ucr")) is ucr.fetch_section
