from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .alerts import bp_status, glucose_status
from .database import Base


class User(Base):
    """Patients and clinicians share one table; every other record carries a user_id."""
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)  # patient | clinician
    phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # patient-only fields
    clinician_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    emergency_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # local emergency line
    calorie_goal: Mapped[int] = mapped_column(Integer, default=1800)        # daily net calories
    activity_goal_min: Mapped[int] = mapped_column(Integer, default=30)     # daily active minutes
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class GlucoseReading(Base):
    __tablename__ = "glucose"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    measured_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    value: Mapped[float] = mapped_column(Float)  # mg/dL
    context: Mapped[str] = mapped_column(String, default="fasting")  # fasting|before_meal|after_meal|bedtime

    @property
    def _s(self):
        return glucose_status(self.value, self.context)

    @property
    def status(self): return self._s.label
    @property
    def severity(self): return self._s.severity
    @property
    def message(self): return self._s.message


class BPReading(Base):
    __tablename__ = "bp"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    measured_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    systolic: Mapped[int] = mapped_column(Integer)
    diastolic: Mapped[int] = mapped_column(Integer)
    pulse: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    @property
    def _s(self):
        return bp_status(self.systolic, self.diastolic)

    @property
    def status(self): return self._s.label
    @property
    def severity(self): return self._s.severity
    @property
    def message(self): return self._s.message


class BMIRecord(Base):
    __tablename__ = "bmi"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    measured_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    height_cm: Mapped[float] = mapped_column(Float)
    weight_kg: Mapped[float] = mapped_column(Float)
    bmi: Mapped[float] = mapped_column(Float)
    category: Mapped[str] = mapped_column(String)


class Medication(Base):
    __tablename__ = "medications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String)
    dose: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    times: Mapped[str] = mapped_column(String, default="08:00")  # comma separated HH:MM
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class MedicationLog(Base):
    __tablename__ = "medication_logs"
    __table_args__ = (UniqueConstraint("medication_id", "day", "slot"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    medication_id: Mapped[int] = mapped_column(ForeignKey("medications.id", ondelete="CASCADE"))
    day: Mapped[date] = mapped_column(Date, index=True)
    slot: Mapped[str] = mapped_column(String)  # HH:MM
    status: Mapped[str] = mapped_column(String, default="taken")  # taken|skipped


class FoodEntry(Base):
    __tablename__ = "food_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    meal_type: Mapped[str] = mapped_column(String)  # breakfast|lunch|snack|dinner
    name: Mapped[str] = mapped_column(String)
    quantity: Mapped[float] = mapped_column(Float, default=1)
    calories: Mapped[float] = mapped_column(Float, default=0)
    carbs_g: Mapped[float] = mapped_column(Float, default=0)
    protein_g: Mapped[float] = mapped_column(Float, default=0)
    fat_g: Mapped[float] = mapped_column(Float, default=0)
    sodium_mg: Mapped[float] = mapped_column(Float, default=0)
    source: Mapped[str] = mapped_column(String, default="text")  # text | one_tap (self-declared)


class Workout(Base):
    __tablename__ = "workouts"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    kind: Mapped[str] = mapped_column(String)
    duration_min: Mapped[int] = mapped_column(Integer)
    intensity: Mapped[str] = mapped_column(String, default="moderate")  # light|moderate|vigorous
    calories_burned: Mapped[float] = mapped_column(Float, default=0)


class Habit(Base):
    __tablename__ = "habits"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String)
    target: Mapped[int] = mapped_column(Integer, default=1)
    unit: Mapped[str] = mapped_column(String, default="time")


class HabitLog(Base):
    __tablename__ = "habit_logs"
    __table_args__ = (UniqueConstraint("habit_id", "day"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    habit_id: Mapped[int] = mapped_column(ForeignKey("habits.id", ondelete="CASCADE"))
    day: Mapped[date] = mapped_column(Date, index=True)
    count: Mapped[int] = mapped_column(Integer, default=0)


class CheckIn(Base):
    __tablename__ = "checkins"
    __table_args__ = (UniqueConstraint("user_id", "day"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)


class Message(Base):
    """Chat between a patient and their care team; patient_id identifies the thread."""
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class NotificationLog(Base):
    """When each reminder was last sent, so a missed dose repeats every 30 minutes and no more."""
    __tablename__ = "notification_log"
    __table_args__ = (UniqueConstraint("user_id", "kind", "key"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String)
    key: Mapped[str] = mapped_column(String)
    last_sent_at: Mapped[datetime] = mapped_column(DateTime)


class SummaryAudit(Base):
    """Who generated which AI summary, and whether guardrails had to reject the model's output."""
    __tablename__ = "summary_audit"
    id: Mapped[int] = mapped_column(primary_key=True)
    clinician_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    patient_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    days: Mapped[int] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String)  # llm | template
    guardrail_notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
