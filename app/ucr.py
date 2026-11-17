import html
import re
from datetime import time

import httpx

from app.anteater import CourseNotFound, MeetingData, SectionData, SourceUnavailable

BASE_URL = "https://registrationssb.ucr.edu/StudentRegistrationSsb/ssb"
QUARTER_CODES = {"winter": "10", "spring": "20", "fall": "40"}
DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def banner_term(term: str) -> str:
    year, quarter = term.split("-", 1)
    return year + QUARTER_CODES[quarter]


def parse_time(hhmm: str) -> time:
    return time(int(hhmm[:2]), int(hhmm[2:]))


def parse_meetings(data: dict) -> list[MeetingData]:
    return [
        MeetingData(
            weekday=weekday,
            start_time=parse_time(m["beginTime"]),
            end_time=parse_time(m["endTime"]),
            location=" ".join(filter(None, [m["buildingDescription"], m["room"]])) or None,
        )
        for m in (item["meetingTime"] for item in data["fmt"])
        if m["beginTime"] and m["endTime"]
        for weekday, day in enumerate(DAYS)
        if m[day]
    ]


def span(page: str, name: str) -> str:
    match = re.search(rf'id="{name}"[^>]*>([^<]*)', page)
    if match is None:
        raise CourseNotFound(name)
    return html.unescape(match.group(1)).strip()


def parse_details(page: str) -> tuple[str, str, str]:
    return span(page, "subject"), span(page, "courseNumber"), span(page, "courseTitle")


def fetch_section(term: str, crn: str) -> SectionData:
    params = {"term": banner_term(term), "courseReferenceNumber": crn}
    try:
        details = httpx.post(f"{BASE_URL}/searchResults/getClassDetails", data=params, timeout=10)
        if details.status_code == 500:
            raise CourseNotFound(crn)

        details.raise_for_status()
        subject, number, title = parse_details(details.text)
        times = httpx.get(
            f"{BASE_URL}/searchResults/getFacultyMeetingTimes", params=params, timeout=10
        )
        times.raise_for_status()
        subjects = httpx.get(
            f"{BASE_URL}/classSearch/get_subject",
            params={"term": params["term"], "searchTerm": subject, "offset": 1, "max": 10},
            timeout=10,
        )
        subjects.raise_for_status()
    except httpx.HTTPError as e:
        raise SourceUnavailable from e
    dept = next((s["code"] for s in subjects.json() if s["description"] == subject), subject[:20])
    return SectionData(
        course_code=crn,
        dept=dept,
        number=number,
        title=title,
        meetings=parse_meetings(times.json()),
    )
