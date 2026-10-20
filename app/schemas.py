from datetime import time
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


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


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=50)
    major: str | None = Field(None, max_length=100)
    grad_year: int | None = Field(None, ge=2000, le=2100)
    is_transfer: bool | None = None
    transfer_from: str | None = Field(None, max_length=100)
    home_city: str | None = Field(None, max_length=100)
    bio: str | None = Field(None, max_length=500)


class MeetingIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    location: str | None = Field(None, max_length=100)

    @model_validator(mode="after")
    def end_after_start(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class MeetingOut(MeetingIn):
    model_config = ConfigDict(from_attributes=True)


class CourseIn(BaseModel):
    course_code: str = Field(pattern=r"^[A-Za-z0-0-]{1,10}$")
    dept: str = Field(max_length=20)
    number: str = Field(max_length=10)
    title: str = Field("", max_length=150)
    meetings: list[MeetingIn] = Field(min_length=1)


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
