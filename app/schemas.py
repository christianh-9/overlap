from datetime import datetime, time
from typing import Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    computed_field,
    field_validator,
    model_validator,
)

from app.config import settings
from app.photos import photo_url


class CodeRequest(BaseModel):
    email: EmailStr


class CodeSent(BaseModel):
    sent: bool
    dev_code: str | None = None


class CodeVerify(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CampusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    major: str | None
    grad_year: int | None
    is_transfer: bool
    transfer_from: str | None
    bio: str
    photo_key: str | None = Field(None, exclude=True)

    @computed_field
    @property
    def photo_url(self) -> str | None:
        return photo_url(self.photo_key)


class MeOut(ProfileOut):
    email: str
    home_city: str | None
    contact: str | None
    campus: CampusOut


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=50)
    major: str | None = Field(None, max_length=100)
    grad_year: int | None = Field(None, ge=2000, le=2100)
    is_transfer: bool | None = None
    transfer_from: str | None = Field(None, max_length=100)
    home_city: str | None = Field(None, max_length=100)
    contact: str | None = Field(None, max_length=100)
    bio: str | None = Field(None, max_length=500)

    @field_validator("display_name", "is_transfer", "bio")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("can't be null")
        return value


class TermOut(BaseModel):
    term: str
    label: str


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


class CampusHoursIn(BaseModel):
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def long_enough(self):
        start = self.start_time.hour * 60 + self.start_time.minute
        end = self.end_time.hour * 60 + self.end_time.minute
        if end - start < settings.min_gap_minutes:
            raise ValueError(f"must be at least {settings.min_gap_minutes} minutes")
        return self


class CampusHoursOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    weekday: int
    start_time: time
    end_time: time


class MatchOut(BaseModel):
    profile: ProfileOut
    windows: list[str]
    overlap_minutes: int
    shared_courses: int
    same_major: bool
    same_transfer_school: bool
    waved: bool
    note: str | None


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


class WaveIn(BaseModel):
    note: str | None = Field(None, max_length=140)

    @field_validator("note")
    @classmethod
    def blank_is_none(cls, value):
        if value is None:
            return None
        return value.strip() or None


class ReceivedWaveOut(BaseModel):
    profile: ProfileOut
    note: str | None


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
    action: Literal["dismiss", "remove_photo", "ban"]
