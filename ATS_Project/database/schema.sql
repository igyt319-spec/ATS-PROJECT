-- ATS relational schema (MySQL 8). Existing UI-facing columns are retained where
-- needed for backward compatibility; normalized IDs are the source of truth.
CREATE DATABASE IF NOT EXISTS ats_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ats_database;

CREATE TABLE IF NOT EXISTS colleges (
 id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(180) NOT NULL UNIQUE, code VARCHAR(24) NOT NULL UNIQUE,
 city VARCHAR(100) NOT NULL, state VARCHAR(100) NOT NULL, data_notice VARCHAR(255) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS departments (
 id INT AUTO_INCREMENT PRIMARY KEY, college_id INT NOT NULL, code VARCHAR(20) NOT NULL UNIQUE, name VARCHAR(160) NOT NULL UNIQUE,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(college_id) REFERENCES colleges(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS programs (
 id INT AUTO_INCREMENT PRIMARY KEY, department_id INT NOT NULL, code VARCHAR(24) NOT NULL UNIQUE, name VARCHAR(160) NOT NULL,
 award VARCHAR(40) NOT NULL DEFAULT 'B.E.', duration_years TINYINT NOT NULL DEFAULT 4,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_program_department_name(department_id,name), FOREIGN KEY(department_id) REFERENCES departments(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS academic_years (
 id INT AUTO_INCREMENT PRIMARY KEY, label VARCHAR(20) NOT NULL UNIQUE, start_date DATE NOT NULL, end_date DATE NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS semesters (
 id INT AUTO_INCREMENT PRIMARY KEY, academic_year_id INT NOT NULL, semester_number TINYINT NOT NULL, label VARCHAR(24) NOT NULL,
 start_date DATE NOT NULL, end_date DATE NOT NULL, status ENUM('planned','active','completed') NOT NULL DEFAULT 'active',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_semester_year_number(academic_year_id,semester_number), FOREIGN KEY(academic_year_id) REFERENCES academic_years(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS grading_rules (
 minimum_mark TINYINT UNSIGNED PRIMARY KEY, grade VARCHAR(5) NOT NULL UNIQUE, grade_point DECIMAL(4,2) NOT NULL,
 performance_status ENUM('Strong','Average','Weak') NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS attendance_thresholds (
 status ENUM('GOOD','MONITOR','RISK') PRIMARY KEY, minimum_percentage DECIMAL(5,2) NOT NULL UNIQUE,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS users (
 id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(160) NOT NULL UNIQUE,
 register_number VARCHAR(50) UNIQUE, password VARCHAR(255) NOT NULL, role ENUM('student','faculty','admin') NOT NULL DEFAULT 'student',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_users_role(role)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS faculty (
 id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NULL UNIQUE, faculty_code VARCHAR(32) NOT NULL UNIQUE, name VARCHAR(100) NOT NULL,
 email VARCHAR(160) NOT NULL UNIQUE, department_id INT NOT NULL, designation VARCHAR(100) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL, FOREIGN KEY(department_id) REFERENCES departments(id), INDEX idx_faculty_dept(department_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS students (
 id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL UNIQUE, register_number VARCHAR(50) NOT NULL UNIQUE, name VARCHAR(100) NOT NULL,
 email VARCHAR(160) NOT NULL UNIQUE, phone VARCHAR(20) NULL, department_id INT NULL, program_id INT NULL, current_semester_id INT NULL,
 year VARCHAR(20) NOT NULL, semester VARCHAR(24) NOT NULL DEFAULT 'Semester 1', academic_year VARCHAR(20) NULL,
 date_of_birth DATE NULL, status ENUM('active','inactive','graduated','withdrawn') NOT NULL DEFAULT 'active',
 gpa DECIMAL(4,2) NOT NULL DEFAULT 0, cgpa DECIMAL(4,2) NOT NULL DEFAULT 0, attendance_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
 academic_score INT NOT NULL DEFAULT 0, risk_level ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'LOW',
 avatar VARCHAR(255) NULL, bio TEXT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(department_id) REFERENCES departments(id),
 FOREIGN KEY(program_id) REFERENCES programs(id), FOREIGN KEY(current_semester_id) REFERENCES semesters(id),
 INDEX idx_students_department(department_id), INDEX idx_students_program(program_id), INDEX idx_students_semester(current_semester_id), INDEX idx_students_status(status)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS subjects (
 id INT AUTO_INCREMENT PRIMARY KEY, subject_code VARCHAR(24) NOT NULL UNIQUE, subject_name VARCHAR(140) NOT NULL,
 department_id INT NULL, semester_number TINYINT NOT NULL DEFAULT 1, credits TINYINT UNSIGNED NOT NULL DEFAULT 3,
 subject_type ENUM('Theory','Practical','Integrated','Project','Elective') NOT NULL DEFAULT 'Theory',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(department_id) REFERENCES departments(id), INDEX idx_subject_dept_sem(department_id,semester_number)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS subject_allocations (
 id INT AUTO_INCREMENT PRIMARY KEY, subject_id INT NOT NULL, semester_id INT NOT NULL, faculty_id INT NULL, section_code VARCHAR(12) NOT NULL DEFAULT 'A',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_allocation(subject_id,semester_id,section_code), FOREIGN KEY(subject_id) REFERENCES subjects(id), FOREIGN KEY(semester_id) REFERENCES semesters(id), FOREIGN KEY(faculty_id) REFERENCES faculty(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS student_subjects (
 id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL, subject_id INT NOT NULL, semester_id INT NOT NULL,
 enrollment_status ENUM('enrolled','completed','withdrawn') NOT NULL DEFAULT 'enrolled',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_enrollment(student_id,subject_id,semester_id), FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
 FOREIGN KEY(subject_id) REFERENCES subjects(id), FOREIGN KEY(semester_id) REFERENCES semesters(id), INDEX idx_enrollment_semester(semester_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS marks (
 id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL, subject_id INT NOT NULL, semester_id INT NULL,
 internal_marks DECIMAL(5,2) NOT NULL DEFAULT 0, assignment_marks DECIMAL(5,2) NOT NULL DEFAULT 0, exam_marks DECIMAL(5,2) NOT NULL DEFAULT 0,
 total_marks DECIMAL(5,2) NOT NULL DEFAULT 0, grade VARCHAR(5) NOT NULL DEFAULT 'F', grade_point DECIMAL(4,2) NOT NULL DEFAULT 0,
 performance_status ENUM('Strong','Average','Weak') NOT NULL DEFAULT 'Average', status ENUM('Strong','Average','Weak') NOT NULL DEFAULT 'Average', semester VARCHAR(24) NOT NULL DEFAULT 'Semester 1',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_marks(student_id,subject_id,semester_id), FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
 FOREIGN KEY(subject_id) REFERENCES subjects(id), FOREIGN KEY(semester_id) REFERENCES semesters(id), INDEX idx_marks_student_semester(student_id,semester_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS attendance (
 id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL, subject_id INT NOT NULL, semester_id INT NULL,
 classes_conducted INT UNSIGNED NOT NULL DEFAULT 0, classes_attended INT UNSIGNED NOT NULL DEFAULT 0,
 attendance_percentage DECIMAL(5,2) NOT NULL DEFAULT 0, attendance_status ENUM('GOOD','MONITOR','RISK') NOT NULL DEFAULT 'GOOD',
 total_classes INT UNSIGNED NOT NULL DEFAULT 0, attended_classes INT UNSIGNED NOT NULL DEFAULT 0,
 percentage DECIMAL(5,2) NOT NULL DEFAULT 0, status ENUM('GOOD','MONITOR','RISK') NOT NULL DEFAULT 'GOOD', month VARCHAR(20) NOT NULL DEFAULT 'Overall',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_attendance(student_id,subject_id,semester_id), FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
 FOREIGN KEY(subject_id) REFERENCES subjects(id), FOREIGN KEY(semester_id) REFERENCES semesters(id), INDEX idx_attendance_student_semester(student_id,semester_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS achievements (
 id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL, title VARCHAR(150) NOT NULL,
 category ENUM('Hackathon','Paper Presentation','Workshop','Certification','Sports','Technical Competition') NOT NULL,
 achievement_date DATE NOT NULL, description TEXT NULL, certificate_url VARCHAR(255) NULL,
 status ENUM('Verified','Pending','Rejected') NOT NULL DEFAULT 'Pending',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE, INDEX idx_achievements_student_date(student_id,achievement_date)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS certifications (
 id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL, name VARCHAR(180) NOT NULL, issuer VARCHAR(120) NOT NULL,
 issue_date DATE NOT NULL, expiry_date DATE NULL, credential_url VARCHAR(255) NULL, status ENUM('active','expired','pending') NOT NULL DEFAULT 'active',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE, INDEX idx_certifications_student(student_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS recommendations (
 id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL, priority ENUM('HIGH','MEDIUM','LOW') NOT NULL DEFAULT 'MEDIUM',
 title VARCHAR(150) NOT NULL, reason TEXT NOT NULL, recommendation TEXT NOT NULL, category VARCHAR(50) NOT NULL DEFAULT 'Academic',
 status ENUM('Active','Completed','Dismissed') NOT NULL DEFAULT 'Active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE, INDEX idx_recommendations_student_status(student_id,status)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS risk_alerts (
 id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL, alert_type VARCHAR(40) NOT NULL, severity ENUM('HIGH','MEDIUM','LOW') NOT NULL,
 message VARCHAR(500) NOT NULL, resolved_at DATETIME NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
 INDEX idx_risk_alerts_student(student_id,resolved_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS notifications (
 id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL, type ENUM('attendance','marks','recommendation','achievement','faculty') NOT NULL DEFAULT 'faculty',
 title VARCHAR(150) NOT NULL, message TEXT NOT NULL, is_read BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE, INDEX idx_notifications_student_date(student_id,created_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS chat_history (
 id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL, sender ENUM('user','bot') NOT NULL, message TEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE, INDEX idx_chat_student_date(student_id,created_at)
) ENGINE=InnoDB;
