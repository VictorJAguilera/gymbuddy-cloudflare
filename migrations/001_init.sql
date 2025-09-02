-- 001_init.sql
-- Esquema base para GymBuddy (D1 / SQLite)

PRAGMA foreign_keys = ON;

-- ========= Tabla de ejercicios =========
CREATE TABLE IF NOT EXISTS exercises (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  image           TEXT,
  bodyPart        TEXT,           -- grupo muscular primario
  primaryMuscles  TEXT,           -- detalle músculos primarios (texto libre)
  secondaryMuscles TEXT,          -- detalle músculos secundarios (texto libre)
  equipment       TEXT,           -- equipamiento
  isCustom        INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name);
CREATE INDEX IF NOT EXISTS idx_exercises_bodypart ON exercises(bodyPart);

-- ========= Tablas de rutinas =========
CREATE TABLE IF NOT EXISTS routines (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  createdAt  INTEGER,
  updatedAt  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_routines_updatedAt ON routines(updatedAt);

CREATE TABLE IF NOT EXISTS routine_exercises (
  id           TEXT PRIMARY KEY,
  routine_id   TEXT NOT NULL,
  exercise_id  TEXT NOT NULL,
  order_index  INTEGER DEFAULT 0,
  FOREIGN KEY (routine_id)  REFERENCES routines(id)   ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises(id)  ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine ON routine_exercises(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_order   ON routine_exercises(routine_id, order_index);

CREATE TABLE IF NOT EXISTS routine_sets (
  id                   TEXT PRIMARY KEY,
  routine_exercise_id  TEXT NOT NULL,
  reps                 INTEGER,
  peso                 REAL,
  FOREIGN KEY (routine_exercise_id) REFERENCES routine_exercises(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_routine_sets_rex ON routine_sets(routine_exercise_id);

-- ========= Tablas de entrenamientos guardados =========
CREATE TABLE IF NOT EXISTS workouts (
  id           TEXT PRIMARY KEY,
  routine_id   TEXT,
  startedAt    INTEGER,
  finishedAt   INTEGER,
  durationSec  INTEGER,
  FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_workouts_startedAt ON workouts(startedAt);

CREATE TABLE IF NOT EXISTS workout_items (
  id            TEXT PRIMARY KEY,
  workout_id    TEXT NOT NULL,
  exercise_id   TEXT,
  name          TEXT,
  bodyPart      TEXT,
  image         TEXT,
  order_index   INTEGER DEFAULT 0,
  FOREIGN KEY (workout_id)  REFERENCES workouts(id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_workout_items_workout ON workout_items(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_items_order   ON workout_items(workout_id, order_index);

CREATE TABLE IF NOT EXISTS workout_sets (
  id               TEXT PRIMARY KEY,
  workout_item_id  TEXT NOT NULL,
  reps             INTEGER,
  peso             REAL,
  done             INTEGER DEFAULT 0,
  FOREIGN KEY (workout_item_id) REFERENCES workout_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workout_sets_item ON workout_sets(workout_item_id);
