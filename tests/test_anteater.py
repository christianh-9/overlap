from datetime import time

import pytest

from app.anteater import CourseNotFound, parse_days, parse_section, parse_term

TUTH_MEETING = {
    "timeIsTBA": False,
    "days": "TuTh",
    "startTime": {"hour": 14, "minute": 0},
    "endTime": {"hour": 15, "minute": 20},
    "bldg": ["SSLH 100"],
}

COURSE = {
    "deptCode": "I&C SCI",
    "courseNumber": "46",
    "courseTitle": "DATA STRC IMPL&ANLS",
    "sections": [
        {"sectionCode": "36000", "isCancelled": False, "meetings": [TUTH_MEETING]},
        {"sectionCode": "36001", "isCancelled": False, "meetings": [{"timeIsTBA": True}]},
        {"sectionCode": "36002", "isCancelled": True, "meetings": []},
    ],
}

SAMPLE = {"schools": [{"departments": [{"courses": [COURSE]}]}]}


def test_parse_term():
    assert parse_term("2026-fall") == ("2026", "Fall")
    assert parse_term("2027-summer10wk") == ("2027", "Summer10wk")


def test_parse_days():
    assert parse_days("MWF") == [0, 2, 4]
    assert parse_days("TuTh") == [1, 3]


def test_parse_section_expands_days():
    s = parse_section(SAMPLE, "36000")
    assert (s.dept, s.number) == ("I&C SCI", "46")
    assert [m.weekday for m in s.meetings] == [1, 3]
    assert s.meetings[0].start_time == time(14, 0)
    assert s.meetings[0].location == "SSLH 100"


def test_the_section_has_no_meetings():
    assert parse_section(SAMPLE, "36001").meetings == []


@pytest.mark.parametrize("code", ["36002", "99999"])
def test_cancelled_or_missing_raises(code):
    with pytest.raises(CourseNotFound):
        parse_section(SAMPLE, code)
