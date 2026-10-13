export interface User {
  id: number; name: string; email: string; role: "patient" | "clinician"; phone: string | null;
  emergency_number: string | null; calorie_goal: number; activity_goal_min: number; notifications_enabled: boolean;
  age: number | null; gender: string | null; height_cm: number | null; blood_type: string | null; allergies: string | null;
  emergency_contact_name: string | null; emergency_contact_phone: string | null; bio: string | null;
}
export interface Status { status: string; severity: number; message: string }
export interface Glucose extends Status { id: number; measured_at: string; value: number; context: string }
export interface BP extends Status { id: number; measured_at: string; systolic: number; diastolic: number; pulse?: number | null }
export interface BMI { id: number; measured_at: string; height_cm: number; weight_kg: number; bmi: number; category: string }
export interface Medication { id: number; name: string; dose: string | null; times: string }
export interface DoseRow { medication_id: number; name: string; dose: string | null; slot: string; status: "pending" | "taken" | "skipped" }
export interface Food { id: number; day: string; meal_type: string; name: string; quantity: number; calories: number; carbs_g: number; sodium_mg: number; source: string }
export interface FoodPreview { items: { name: string; quantity: number; serving: string; calories: number }[]; unmatched: string[]; total_calories: number }
export interface Workout { id: number; day: string; kind: string; duration_min: number; intensity: string; calories_burned: number }
export interface HabitRow { habit_id: number; name: string; target: number; unit: string; count: number; done: boolean }
export interface Streak { current: number; longest: number; checked_in_today: boolean; milestone: boolean; next_milestone: number }
export interface Energy {
  goal: number; intake: number; burned: number; net: number; difference: number;
  state: "matched" | "over" | "under"; suggestions: string[]; active_min: number; activity_goal_min: number;
}
export interface Home {
  status: { level: "green" | "amber" | "red"; text: string };
  streak: Streak; energy: Energy; clinician: { name: string; phone: string | null } | null;
}
export interface ChatMessage { id: number; from_role: "patient" | "clinician"; sender: string; body: string; created_at: string }
export interface Thread { patient_id: number; name: string; last_body: string | null; last_from_role: ChatMessage["from_role"] | null; last_at: string | null }
export interface Notice { tag: string; title: string; body: string; url: string }

export interface PatientRow {
  id: number; name: string; age: number | null; streak: number; last_check_in: string | null;
  med_adherence_7d: number | null; attention: number;
  latest_bp: { value: string; status: string; severity: number; at: string } | null;
  latest_glucose: { value: number; status: string; severity: number; at: string } | null;
  latest_bmi: { value: number; category: string; at: string } | null;
}
export interface Records {
  patient: { id: number; name: string; age: number | null; phone: string | null; calorie_goal: number; activity_goal_min: number };
  blood_pressure: BP[]; glucose: Glucose[]; bmi: BMI[]; food: Food[]; activity: Workout[]; medicines: Medication[]; streak: Streak;
}
export interface SummaryResult { text: string; source: "llm" | "template"; notes: string[]; disclaimer: string; days: number }
