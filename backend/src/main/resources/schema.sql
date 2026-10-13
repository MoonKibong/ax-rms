CREATE TABLE IF NOT EXISTS department (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employee (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  department_id INTEGER NOT NULL REFERENCES department(id),
  job_title TEXT NOT NULL,
  career_years INTEGER NOT NULL,
  availability_status TEXT NOT NULL CHECK (availability_status IN ('AVAILABLE', 'UNAVAILABLE')),
  unavailable_reason TEXT,
  unavailable_until TEXT
);

CREATE TABLE IF NOT EXISTS employee_skill (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employee(id),
  skill_name TEXT NOT NULL,
  proficiency_level TEXT NOT NULL CHECK (proficiency_level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
  UNIQUE (employee_id, skill_name)
);

CREATE TABLE IF NOT EXISTS account (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL UNIQUE REFERENCES employee(id),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_role (
  account_id INTEGER NOT NULL REFERENCES account(id),
  role TEXT NOT NULL CHECK (role IN ('HR_MANAGER', 'PROJECT_MANAGER', 'EMPLOYEE')),
  PRIMARY KEY (account_id, role)
);

CREATE TABLE IF NOT EXISTS project (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'DONE', 'ON_HOLD'))
);

CREATE TABLE IF NOT EXISTS project_required_skill_line (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES project(id),
  job_title TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  proficiency_level TEXT NOT NULL CHECK (proficiency_level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
  headcount INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assignment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employee(id),
  project_id INTEGER NOT NULL REFERENCES project(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  allocation_percent INTEGER NOT NULL CHECK (allocation_percent BETWEEN 5 AND 100 AND allocation_percent % 5 = 0)
);
