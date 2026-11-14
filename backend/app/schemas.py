"""Pydantic schemas: the shape of JSON going in and out of the API (with validation)."""
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from . import knowledge as K


class AstronautBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    call_sign: str = ""
    role: str = "Mission Specialist"
    agency: str = "NASA"
    environment: str = "station"
    mission_name: str = ""
    mission_start: date | None = None
    baseline_mass_kg: float | None = Field(default=None, gt=20, lt=250)
    prior_career_dose_msv: float = Field(default=0.0, ge=0)
    avatar_color: str = "#7c5cff"

    @field_validator("environment")
    @classmethod
    def valid_env(cls, v):
        if v not in K.ENVIRONMENTS:
            raise ValueError(f"environment must be one of {list(K.ENVIRONMENTS)}")
        return v


class AstronautCreate(AstronautBase):
    pin: str = Field(pattern=r"^\d{6}$", description="6-digit PIN the astronaut will log in with")


class PinSet(BaseModel):
    pin: str = Field(pattern=r"^\d{6}$")


class AstronautUpdate(BaseModel):
    name: str | None = None
    call_sign: str | None = None
    role: str | None = None
    agency: str | None = None
    environment: str | None = None
    mission_name: str | None = None
    mission_start: date | None = None
    baseline_mass_kg: float | None = None
    prior_career_dose_msv: float | None = None
    avatar_color: str | None = None


class AstronautOut(AstronautBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    has_pin: bool = False
    photo_url: str | None = None


class ReadingCreate(BaseModel):
    astronaut_id: int
    indicator: str
    value: float
    value2: float | None = None
    notes: str = ""
    recorded_at: datetime | None = None

    @field_validator("indicator")
    @classmethod
    def valid_indicator(cls, v):
        if v not in K.INDICATORS:
            raise ValueError(f"indicator must be one of {list(K.INDICATORS)}")
        return v


class ReadingBatch(BaseModel):
    astronaut_id: int
    readings: list[dict]  # [{indicator, value, value2?, notes?}]


class ReadingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    astronaut_id: int
    indicator: str
    value: float
    value2: float | None
    status: str
    notes: str
    recorded_at: datetime


class TaskToggle(BaseModel):
    astronaut_id: int
    task_key: str


class ImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    astronaut_id: int
    category: str
    filename: str
    notes: str
    created_at: datetime
    url: str = ""
