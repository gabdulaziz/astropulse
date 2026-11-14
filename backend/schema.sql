-- AstroPulse database schema (PostgreSQL)
-- You do NOT need to run this: the API creates these tables automatically on start.
-- It is here so you can read the structure in plain SQL, or create the tables by hand:
--     psql -U astropulse -d astropulse -h localhost -f schema.sql

CREATE TABLE IF NOT EXISTS astronauts (
    id                     SERIAL PRIMARY KEY,
    name                   VARCHAR(120) NOT NULL,
    call_sign              VARCHAR(40)  NOT NULL DEFAULT '',
    role                   VARCHAR(80)  NOT NULL DEFAULT 'Mission Specialist',
    agency                 VARCHAR(40)  NOT NULL DEFAULT 'NASA',
    environment            VARCHAR(30)  NOT NULL DEFAULT 'station',  -- station | spacecraft | rover | lunar_base | mars_base
    mission_name           VARCHAR(120) NOT NULL DEFAULT '',
    mission_start          DATE         NOT NULL DEFAULT CURRENT_DATE,
    baseline_mass_kg       DOUBLE PRECISION,                         -- pre-flight body mass, used for % change
    prior_career_dose_msv  DOUBLE PRECISION NOT NULL DEFAULT 0,      -- radiation from earlier missions
    avatar_color           VARCHAR(20)  NOT NULL DEFAULT '#7c5cff',
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vital_readings (
    id            SERIAL PRIMARY KEY,
    astronaut_id  INTEGER NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
    indicator     VARCHAR(40) NOT NULL,      -- heart_rate, blood_pressure, blood_glucose, ...
    value         DOUBLE PRECISION NOT NULL, -- main value (systolic for blood pressure)
    value2        DOUBLE PRECISION,          -- diastolic for blood pressure, otherwise NULL
    status        VARCHAR(12) NOT NULL DEFAULT 'nominal',  -- nominal | caution | critical
    notes         TEXT NOT NULL DEFAULT '',
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_readings_astro_ind_time ON vital_readings (astronaut_id, indicator, recorded_at);

CREATE TABLE IF NOT EXISTS task_completions (
    id            SERIAL PRIMARY KEY,
    astronaut_id  INTEGER NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
    task_key      VARCHAR(40) NOT NULL,
    xp            INTEGER NOT NULL DEFAULT 0,
    completed_on  DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_task_per_day UNIQUE (astronaut_id, task_key, completed_on)
);

CREATE TABLE IF NOT EXISTS health_images (
    id            SERIAL PRIMARY KEY,
    astronaut_id  INTEGER NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
    category      VARCHAR(30) NOT NULL DEFAULT 'other',  -- ultrasound | skin | eye | wound | other
    filename      VARCHAR(200) NOT NULL,                 -- file stored in backend/uploads/
    notes         TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
