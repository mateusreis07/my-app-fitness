/**
 * Tipos do banco, escritos à mão e alinhados com `supabase/migrations`.
 *
 * Não são gerados pelo CLI do Supabase: o projeto não depende do CLI para
 * aplicar migrations (ver `scripts/migrate.mjs`). Ao alterar uma migration,
 * atualize este arquivo na mesma mudança.
 */

export type BiologicalSex = 'female' | 'male' | 'unspecified';

export type ActivityLevel =
  'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';

export type FitnessExperience = 'beginner' | 'intermediate' | 'advanced';

export type GoalType =
  'lose_weight' | 'gain_muscle' | 'maintain_weight' | 'improve_health' | 'improve_fitness';

export type GoalStatus = 'active' | 'achieved' | 'abandoned';

export type TrainingLocation = 'home' | 'gym' | 'outdoor' | 'mixed';

export type MealType =
  'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner' | 'supper' | 'other';

export type FoodSource = 'official' | 'imported' | 'ai' | 'seed';

export type ExerciseSource = 'seed' | 'official' | 'imported';

export type WorkoutSessionStatus = 'in_progress' | 'completed' | 'abandoned';

export type Profile = {
  id: string;
  user_id: string;
  display_name: string | null;
  birth_date: string | null;
  biological_sex: BiologicalSex | null;
  height_cm: number | null;
  activity_level: ActivityLevel | null;
  fitness_experience: FitnessExperience | null;
  country: string | null;
  locale: string;
  timezone: string;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Goal = {
  id: string;
  user_id: string;
  goal_type: GoalType;
  starting_weight_kg: number | null;
  target_weight_kg: number | null;
  started_at: string;
  target_date: string | null;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
};

export type WeightLog = {
  id: string;
  user_id: string;
  weight_kg: number;
  recorded_at: string;
  recorded_date: string;
  recorded_timezone: string;
  notes: string | null;
  created_at: string;
};

export type TrainingPreferences = {
  id: string;
  user_id: string;
  days_per_week: number;
  session_minutes: number;
  location: TrainingLocation;
  equipment: string[];
  created_at: string;
  updated_at: string;
};

export type NotificationPreferences = {
  id: string;
  user_id: string;
  water_enabled: boolean;
  workout_enabled: boolean;
  weight_enabled: boolean;
  summary_enabled: boolean;
  reminder_time: string;
  summary_time: string;
  created_at: string;
  updated_at: string;
};

export type NutritionTargets = {
  id: string;
  user_id: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
  effective_from: string;
  effective_until: string | null;
  calculation_source: string;
  created_at: string;
};

export type WaterLog = {
  id: string;
  user_id: string;
  amount_ml: number;
  recorded_at: string;
  recorded_date: string;
  recorded_timezone: string;
  created_at: string;
};

export type NutritionPreferences = {
  id: string;
  user_id: string;
  meals_per_day: number | null;
  vegetarian: boolean;
  vegan: boolean;
  restrictions: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Food = {
  id: string;
  name: string;
  brand: string | null;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sodium_mg: number | null;
  source: FoodSource;
  verified: boolean;
  created_at: string;
};

export type UserFood = {
  id: string;
  user_id: string;
  name: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: string;
  updated_at: string;
};

export type Meal = {
  id: string;
  user_id: string;
  meal_type: MealType;
  meal_date: string;
  created_at: string;
};

export type MealItem = {
  id: string;
  meal_id: string;
  food_id: string | null;
  user_food_id: string | null;
  name_snapshot: string;
  quantity: number;
  serving_unit: string;
  calories_snapshot: number;
  protein_snapshot: number;
  carbs_snapshot: number;
  fat_snapshot: number;
  created_at: string;
};

export type Exercise = {
  id: string;
  name: string;
  primary_muscle: string;
  secondary_muscles: string[];
  equipment: string | null;
  instructions: string | null;
  media_url: string | null;
  source: ExerciseSource;
  verified: boolean;
  active: boolean;
  created_at: string;
};

export type UserExercise = {
  id: string;
  user_id: string;
  name: string;
  primary_muscle: string;
  secondary_muscles: string[];
  equipment: string | null;
  instructions: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkoutPlan = {
  id: string;
  user_id: string;
  name: string;
  goal: string | null;
  days_per_week: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkoutPlanDay = {
  id: string;
  plan_id: string;
  day_index: number;
  name: string;
  order_index: number;
  created_at: string;
};

export type WorkoutDayExercise = {
  id: string;
  workout_day_id: string;
  exercise_id: string | null;
  user_exercise_id: string | null;
  name_snapshot: string;
  order_index: number;
  target_sets: number;
  min_reps: number;
  max_reps: number;
  rest_seconds: number;
  notes: string | null;
  created_at: string;
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  workout_day_id: string | null;
  day_name_snapshot: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  status: WorkoutSessionStatus;
  created_at: string;
};

export type WorkoutSessionExercise = {
  id: string;
  session_id: string;
  exercise_id: string | null;
  user_exercise_id: string | null;
  name_snapshot: string;
  order_index: number;
  created_at: string;
};

export type WorkoutSet = {
  id: string;
  session_exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number;
  completed: boolean;
  rest_seconds: number | null;
  created_at: string;
};

export type DailyScore = {
  id: string;
  user_id: string;
  score_date: string;
  nutrition_score: number | null;
  protein_score: number | null;
  hydration_score: number | null;
  workout_score: number;
  consistency_score: number;
  total_score: number | null;
  algorithm_version: string;
  created_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      water_logs: Table<WaterLog, Omit<WaterLog, 'created_at'>, never>;
      profiles: Table<Profile>;
      goals: Table<Goal, Omit<Goal, 'id' | 'created_at' | 'updated_at'>>;
      // O registro manual manda o próprio UUID para ser idempotente; o
      // onboarding deixa o banco gerar. Por isso `id` é opcional aqui.
      weight_logs: Table<WeightLog, Omit<WeightLog, 'created_at' | 'id'> & { id?: string }, never>;
      training_preferences: Table<
        TrainingPreferences,
        Omit<TrainingPreferences, 'id' | 'created_at' | 'updated_at'>
      >;
      nutrition_preferences: Table<
        NutritionPreferences,
        Omit<NutritionPreferences, 'id' | 'created_at' | 'updated_at'>
      >;
      nutrition_targets: Table<NutritionTargets, Omit<NutritionTargets, 'id' | 'created_at'>>;
      foods: Table<Food, Omit<Food, 'id' | 'created_at'>>;
      user_foods: Table<UserFood, Omit<UserFood, 'id' | 'created_at' | 'updated_at'>>;
      meals: Table<Meal, Omit<Meal, 'id' | 'created_at'>>;
      meal_items: Table<MealItem, Omit<MealItem, 'id' | 'created_at'>>;
      exercises: Table<Exercise, Omit<Exercise, 'id' | 'created_at'>>;
      user_exercises: Table<UserExercise, Omit<UserExercise, 'id' | 'created_at' | 'updated_at'>>;
      workout_plans: Table<WorkoutPlan, Omit<WorkoutPlan, 'id' | 'created_at' | 'updated_at'>>;
      workout_plan_days: Table<WorkoutPlanDay, Omit<WorkoutPlanDay, 'id' | 'created_at'>>;
      workout_day_exercises: Table<
        WorkoutDayExercise,
        Omit<WorkoutDayExercise, 'id' | 'created_at'>
      >;
      // started_at/completed_at/duration_seconds/status têm padrão ou são
      // preenchidos depois (início e conclusão da sessão são escritas separadas).
      workout_sessions: Table<
        WorkoutSession,
        Omit<
          WorkoutSession,
          'id' | 'created_at' | 'started_at' | 'completed_at' | 'duration_seconds' | 'status'
        > &
          Partial<
            Pick<WorkoutSession, 'started_at' | 'completed_at' | 'duration_seconds' | 'status'>
          >
      >;
      workout_session_exercises: Table<
        WorkoutSessionExercise,
        Omit<WorkoutSessionExercise, 'id' | 'created_at'>
      >;
      // Histórico imutável: id vem do cliente para a escrita ser idempotente,
      // como weight_logs/water_logs. Sem UPDATE.
      workout_sets: Table<WorkoutSet, Omit<WorkoutSet, 'created_at'>, never>;
      // Fecha por chave natural (user_id, score_date), não por UUID de
      // cliente: é escrita derivada e determinística, não toque do usuário.
      daily_scores: Table<DailyScore, Omit<DailyScore, 'id' | 'created_at'>>;
      notification_preferences: Table<
        NotificationPreferences,
        Omit<NotificationPreferences, 'id' | 'created_at' | 'updated_at'>
      >;
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      biological_sex: BiologicalSex;
      activity_level: ActivityLevel;
      fitness_experience: FitnessExperience;
      goal_type: GoalType;
      goal_status: GoalStatus;
      training_location: TrainingLocation;
      meal_type: MealType;
      food_source: FoodSource;
      exercise_source: ExerciseSource;
      workout_session_status: WorkoutSessionStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};
