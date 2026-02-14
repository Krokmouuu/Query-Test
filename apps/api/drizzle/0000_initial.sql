-- Clinic schema + saved_reports
CREATE TABLE IF NOT EXISTS "organizations" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "address" text,
  "phone" varchar(20),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "facilities" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "address" text,
  "phone" varchar(20),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "doctors" (
  "id" serial PRIMARY KEY NOT NULL,
  "facility_id" integer NOT NULL REFERENCES "facilities"("id") ON DELETE CASCADE,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(100) NOT NULL,
  "email" varchar(255) NOT NULL UNIQUE,
  "phone" varchar(20),
  "specialty" varchar(100),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "patients" (
  "id" serial PRIMARY KEY NOT NULL,
  "facility_id" integer NOT NULL REFERENCES "facilities"("id") ON DELETE CASCADE,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(100) NOT NULL,
  "email" varchar(255) UNIQUE,
  "phone" varchar(20),
  "date_of_birth" date,
  "address" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "insurances" (
  "id" serial PRIMARY KEY NOT NULL,
  "patient_id" integer NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
  "provider_name" varchar(255) NOT NULL,
  "policy_number" varchar(100) NOT NULL,
  "group_number" varchar(100),
  "effective_date" date,
  "expiration_date" date,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "visits" (
  "id" serial PRIMARY KEY NOT NULL,
  "doctor_id" integer NOT NULL REFERENCES "doctors"("id") ON DELETE CASCADE,
  "patient_id" integer NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
  "visit_date" timestamp NOT NULL,
  "reason" text,
  "diagnosis" text,
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "saved_reports" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "natural_language_query" text,
  "sql" text,
  "chart_type" varchar(50),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
