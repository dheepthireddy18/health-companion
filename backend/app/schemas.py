from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

MealType = Literal["breakfast", "lunch", "snack", "dinner"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- auth / profile ----------
Role = Literal["patient", "clinician"]


class LoginIn(BaseModel):
    email: str
    password: str
    role: Role  # the login tab used (required); an account of the other role is refused


class RegisterIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=254)
    password: str = Field(min_length=8, max_length=128)
    phone: Optional[str] = Field(None, max_length=30)
    age: Optional[int] = Field(None, ge=13, le=120)
    gender: Optional[str] = Field(None, max_length=30)
    clinician_id: Optional[int] = Field(None, ge=0)  # 0 or missing: any available doctor
    # for the first BMI reading and the suggested calorie goal
    height_cm: float = Field(ge=100, le=250)
    weight_kg: float = Field(ge=25, le=300)
    activity_level: Literal["sedentary", "light", "moderate", "active"] = "light"


class GoogleLoginIn(BaseModel):
    credential: str = Field(min_length=10)
    role: Role


class UserOut(ORM):
    id: int
    name: str
    email: str
    role: str
    phone: Optional[str] = None
    emergency_number: Optional[str] = None
    calorie_goal: int
    activity_goal_min: int
    notifications_enabled: bool
    age: Optional[int] = None
    gender: Optional[str] = None
    height_cm: Optional[float] = None
    blood_type: Optional[str] = None
    allergies: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    bio: Optional[str] = None
    clinician_id: Optional[int] = None
    available: Optional[bool] = None
    on_call: Optional[bool] = None


PROFILE_FIELDS = {"name", "phone", "age", "gender", "height_cm", "blood_type", "allergies",
                  "emergency_contact_name", "emergency_contact_phone", "bio"}
PATIENT_FIELDS = {"emergency_number", "calorie_goal", "activity_goal_min", "notifications_enabled", "clinician_id"}
CLINICIAN_FIELDS = {"available", "on_call"}


class ClinicianPublic(BaseModel):
    """What anyone, including someone registering, may see about a doctor."""
    id: int
    name: str
    gender: Optional[str] = None
    bio: Optional[str] = None
    available: bool
    on_call: bool


class SettingsIn(BaseModel):
    """Profile fields anyone may change, plus patient-only goals and reminders."""
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    phone: Optional[str] = Field(None, max_length=30)
    age: Optional[int] = Field(None, ge=1, le=120)
    gender: Optional[str] = Field(None, max_length=30)
    height_cm: Optional[float] = Field(None, ge=50, le=250)
    blood_type: Optional[str] = Field(None, max_length=5)
    allergies: Optional[str] = Field(None, max_length=300)
    emergency_contact_name: Optional[str] = Field(None, max_length=80)
    emergency_contact_phone: Optional[str] = Field(None, max_length=30)
    bio: Optional[str] = Field(None, max_length=500)
    # clinician-only
    available: Optional[bool] = None
    on_call: Optional[bool] = None
    # patient-only (clinician_id 0 = any available doctor)
    clinician_id: Optional[int] = Field(None, ge=0)
    emergency_number: Optional[str] = Field(None, max_length=20)
    calorie_goal: Optional[int] = Field(None, ge=800, le=4500)
    activity_goal_min: Optional[int] = Field(None, ge=0, le=300)
    notifications_enabled: Optional[bool] = None


class ClinicianInfo(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None
    bio: Optional[str] = None
    available: bool = True
    on_call: bool = False


# ---------- vitals ----------
class Alerting(ORM):
    status: str
    severity: int
    message: str


class GlucoseIn(BaseModel):
    measured_at: datetime
    value: float = Field(ge=20, le=800, description="mg/dL")
    context: Literal["fasting", "before_meal", "after_meal", "bedtime"] = "fasting"


class GlucoseOut(GlucoseIn, Alerting):
    id: int


class BPIn(BaseModel):
    measured_at: datetime
    systolic: int = Field(ge=50, le=300)
    diastolic: int = Field(ge=30, le=200)
    pulse: Optional[int] = Field(None, ge=20, le=250)


class BPOut(BPIn, Alerting):
    id: int


class BMIIn(BaseModel):
    height_cm: float = Field(ge=80, le=250)
    weight_kg: float = Field(ge=20, le=400)
    measured_at: Optional[datetime] = None


class BMIOut(ORM):
    id: int
    measured_at: datetime
    height_cm: float
    weight_kg: float
    bmi: float
    category: str


# ---------- medicines ----------
class MedicationIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    dose: Optional[str] = Field(None, max_length=40)
    times: str = Field("08:00", pattern=r"^\d{2}:\d{2}(,\d{2}:\d{2})*$")


class MedicationOut(MedicationIn, ORM):
    id: int
    active: bool


class DoseMark(BaseModel):
    medication_id: int
    day: date
    slot: str
    status: Literal["taken", "skipped"]


# ---------- food / activity / habits ----------
class FoodIn(BaseModel):
    text: str = Field(min_length=1, max_length=300, description="e.g. '2 idli and a cup of dal'")
    meal_type: MealType
    day: Optional[date] = None


class FoodPreviewIn(BaseModel):
    text: str = Field(max_length=300)


class FoodOut(ORM):
    id: int
    day: date
    meal_type: str
    name: str
    quantity: float
    calories: float
    carbs_g: float
    sodium_mg: float
    source: str


class WorkoutIn(BaseModel):
    kind: str = Field(min_length=1, max_length=40)
    duration_min: int = Field(ge=1, le=600)
    intensity: Literal["light", "moderate", "vigorous"] = "moderate"
    day: Optional[date] = None


class WorkoutOut(ORM):
    id: int
    day: date
    kind: str
    duration_min: int
    intensity: str
    calories_burned: float


class HabitCount(BaseModel):
    day: date
    count: int = Field(ge=0, le=100)


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=1000)
    clinician_id: Optional[int] = None  # patients: which doctor to write to (default: their own doctor)


class ThreadOut(BaseModel):
    patient_id: int
    name: str
    clinician_id: Optional[int] = None
    last_body: Optional[str] = None
    last_from_role: Optional[str] = None
    last_at: Optional[datetime] = None


class MessageOut(BaseModel):
    id: int
    clinician_id: Optional[int] = None  # the doctor this conversation is with
    from_role: str
    sender: str
    body: str
    created_at: datetime
