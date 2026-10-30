from datetime import datetime, time
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field


class CodeRequest(BaseModel):
    email: EmailStr


class CodeVerify(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    major: str | None
    grad_year: int | None
    is_transfer: bool
    transfer_from: str | None
    bio: str


class MeOut(ProfileOut):
    email: str
    home_city: str | None
    contact: str | None


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=50)
    major: str | None = Field(None, max_length=100)
    grad_year: int | None = Field(None, ge=2000, le=2100)
    is_transfer: bool | None = None
    transfer_from: str | None = Field(None, max_length=100)
    home_city: str | None = Field(None, max_length=100)
    contact: str | None = Field(None, max_length=100)
    bio: str | None = Field(None, max_length=500)


class CourseAdd(BaseModel):
    course_code: str = Field(pattern=r"^\d{5}$")


class MeetingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    weekday: int
    start_time: time
    end_time: time
    location: str | None


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    term: str
    course_code: str
    dept: str
    number: str
    title: str
    meetings: list[MeetingOut]


class MatchOut(BaseModel):
    profile: ProfileOut
    windows: list[str]
    overlap_minutes: int
    shared_courses: int
    same_major: bool
    same_transfer_school: bool


class ActivityIn(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    location: str = Field(min_length=1, max_length=100)
    starts_at: AwareDatetime
    max_size: int = Field(ge=2, le=20)


class ActivityOut(BaseModel):
    id: int
    title: str
    location: str
    starts_at: datetime
    max_size: int
    creator: ProfileOut
    member_count: int
    joined: bool


class WaveResult(BaseModel):
    mutual: bool


class ConnectionOut(BaseModel):
    profile: ProfileOut
    contact: str | None


ReportReason = Literal["harassment", "spam", "fake_profile", "inappropriate", "other"]


class ReportIn(BaseModel):
    reason: ReportReason
    details: str = Field("", max_length=1000)
    block: bool = True


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reporter_id: int | None
    reported_id: int | None
    reported_email: str
    reason: str
    details: str
    status: str
    created_at: datetime


class ResolveIn(BaseModel):
    action: Literal["dismiss", "ban"]
