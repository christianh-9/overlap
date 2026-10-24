import re
from dataclasses import dataclass
from datetime import time

import httpx

BASE_URL = "https://anteaterapi.com/v2/rest/websoc"
DAY_INDEX = {"M": 0, "Tu": 1, "W": 2, "Th": 3, "F": 4, "Sa": 5, "Su": 6}
DAY_PATTERN = re.compile(r"M|Tu|W|Th|F|Sa|Su")


class CourseNotFound(Exception):
    pass


class SourceUnavailable(Exception):
    pass


@dataclass
class MeetingData:
    weekday: int
    start_time: time
    end_time: time
    location: str | None


@dataclass
class SectionData:
    course_code: str
    dept: str
    number: str
    title: str
    meetings: list[MeetingData]


def parse_term(term: str) -> tuple[str, str]:
    year, quarter = term.split("-", 1)
    return year, quarter.capitalize()


def parse_days(days: str) -> list[int]:
    return [DAY_INDEX[d] for d in DAY_PATTERN.findall(days)]


def parse_section(data: dict, course_code: str) -> SectionData:
    for school in data["schools"]:
        for dept in school["departments"]:
            for course in dept["courses"]:
                for section in course["sections"]:
                    if section["sectionCode"] != course_code or section["isCancelled"]:
                        continue
                    meetings = [
                        MeetingData(
                            weekday=day,
                            start_time=time(**m["startTime"]),
                            end_time=time(**m["endTime"]),
                            location=", ".join(m["bldg"]) or None,
                        )
                        for m in section["meetings"]
                        if not m["timeIsTBA"]
                        for day in parse_days(m["days"])
                    ]
                    return SectionData(
                        course_code=course_code,
                        dept=course["deptCode"],
                        number=course["courseNumber"],
                        title=course["courseTitle"],
                        meetings=meetings,
                    )
    raise CourseNotFound(course_code)


def fetch_section(term: str, course_code: str) -> SectionData:
    year, quarter = parse_term(term)
    try:
        response = httpx.get(
            BASE_URL,
            params={"year": year, "quarter": quarter, "sectionCodes": course_code},
            timeout=10,
        )
        response.raise_for_status()
    except httpx.HTTPError as e:
        raise SourceUnavailable from e
    return parse_section(response.json()["data"], course_code)
