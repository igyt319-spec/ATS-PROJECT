-- Drop the existing database to clear out old data and start fresh
DROP DATABASE IF EXISTS ats_database;

-- Create a brand new database and select it
CREATE DATABASE ats_database;
USE ats_database;

CREATE TABLE IF NOT EXISTS departments (
  department_id INT PRIMARY KEY,
  department_code VARCHAR(10) NOT NULL UNIQUE,
  department_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS semesters (
  semester_id INT PRIMARY KEY,
  semester_number TINYINT NOT NULL UNIQUE,
  academic_year VARCHAR(9) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS students (
  student_id INT PRIMARY KEY,
  register_number VARCHAR(20) NOT NULL UNIQUE,
  first_name VARCHAR(60) NOT NULL,
  last_name VARCHAR(60) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  department_id INT NOT NULL,
  semester_id INT NOT NULL,
  admission_year SMALLINT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_students_department FOREIGN KEY (department_id) REFERENCES departments(department_id),
  CONSTRAINT fk_students_semester FOREIGN KEY (semester_id) REFERENCES semesters(semester_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subjects (
  subject_id INT PRIMARY KEY,
  subject_code VARCHAR(20) NOT NULL UNIQUE,
  subject_name VARCHAR(100) NOT NULL,
  department_id INT NOT NULL,
  semester_id INT NOT NULL,
  credits TINYINT NOT NULL DEFAULT 3,
  CONSTRAINT fk_subjects_department FOREIGN KEY (department_id) REFERENCES departments(department_id),
  CONSTRAINT fk_subjects_semester FOREIGN KEY (semester_id) REFERENCES semesters(semester_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS marks (
  mark_id INT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  internal_marks DECIMAL(5,2) NOT NULL,
  exam_marks DECIMAL(5,2) NOT NULL,
  total_marks DECIMAL(5,2) NOT NULL,
  grade VARCHAR(2) NOT NULL,
  assessment_date DATE NOT NULL,
  UNIQUE KEY uq_marks_student_subject (student_id, subject_id),
  CONSTRAINT fk_marks_student FOREIGN KEY (student_id) REFERENCES students(student_id),
  CONSTRAINT fk_marks_subject FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attendance (
  attendance_id INT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  classes_held SMALLINT NOT NULL,
  classes_attended SMALLINT NOT NULL,
  attendance_percentage DECIMAL(5,2) NOT NULL,
  UNIQUE KEY uq_attendance_student_subject (student_id, subject_id),
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students(student_id),
  CONSTRAINT fk_attendance_subject FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS achievements (
  achievement_id INT PRIMARY KEY,
  student_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  category VARCHAR(60) NOT NULL,
  achievement_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,
  CONSTRAINT fk_achievements_student FOREIGN KEY (student_id) REFERENCES students(student_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  user_id INT PRIMARY KEY,
  username VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL COMMENT 'Set using the existing backend password-hashing method before login is enabled',
  role ENUM('admin','student') NOT NULL DEFAULT 'student',
  student_id INT NULL UNIQUE,
  must_set_password TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_users_student FOREIGN KEY (student_id) REFERENCES students(student_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recommendations (
  recommendation_id INT PRIMARY KEY,
  student_id INT NOT NULL,
  recommendation_text VARCHAR(255) NOT NULL,
  category VARCHAR(60) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recommendations_student FOREIGN KEY (student_id) REFERENCES students(student_id)
) ENGINE=InnoDB;

INSERT IGNORE INTO departments (department_id, department_code, department_name) VALUES
(1,'CSE','Computer Science and Engineering'),
(2,'ECE','Electronics and Communication Engineering'),
(3,'EEE','Electrical and Electronics Engineering'),
(4,'IT','Information Technology'),
(5,'MECH','Mechanical Engineering');

INSERT IGNORE INTO semesters (semester_id, semester_number, academic_year) VALUES
(1,1,'2023-24'),
(2,2,'2023-24'),
(3,3,'2024-25'),
(4,4,'2024-25'),
(5,5,'2025-26'),
(6,6,'2025-26'),
(7,7,'2026-27'),
(8,8,'2026-27');

INSERT IGNORE INTO subjects (subject_id, subject_code, subject_name, department_id, semester_id, credits) VALUES
(1,'CSE101','Programming in Python',1,1,3),
(2,'CSE102','Data Structures',1,2,3),
(3,'CSE103','Database Management Systems',1,3,3),
(4,'CSE104','Computer Networks',1,4,3),
(5,'CSE105','Artificial Intelligence',1,5,4),
(6,'ECE101','Electronic Devices',2,1,3),
(7,'ECE102','Digital Electronics',2,2,3),
(8,'ECE103','Signals and Systems',2,3,3),
(9,'ECE104','Communication Systems',2,4,3),
(10,'ECE105','Embedded Systems',2,5,4),
(11,'EEE101','Circuit Theory',3,1,3),
(12,'EEE102','Electrical Machines',3,2,3),
(13,'EEE103','Power Systems',3,3,3),
(14,'EEE104','Control Systems',3,4,3),
(15,'EEE105','Power Electronics',3,5,4),
(16,'IT101','Web Technologies',4,1,3),
(17,'IT102','Software Engineering',4,2,3),
(18,'IT103','Cloud Computing',4,3,3),
(19,'IT104','Cyber Security',4,4,3),
(20,'IT105','Data Analytics',4,5,4),
(21,'MECH101','Engineering Mechanics',5,1,3),
(22,'MECH102','Thermodynamics',5,2,3),
(23,'MECH103','Manufacturing Technology',5,3,3),
(24,'MECH104','Fluid Mechanics',5,4,3),
(25,'MECH105','CAD and Design',5,5,4);

INSERT IGNORE INTO students (student_id, register_number, first_name, last_name, email, department_id, semester_id, admission_year, is_active) VALUES
(1,'DEMO2026001','Arun','Kumar','student001@ats-demo.example',1,1,2026,1),
(2,'DEMO2026002','Priya','S','student002@ats-demo.example',2,2,2026,1),
(3,'DEMO2026003','Karthik','R','student003@ats-demo.example',3,3,2025,1),
(4,'DEMO2026004','Divya','M','student004@ats-demo.example',4,4,2025,1),
(5,'DEMO2026005','Rahul','Raj','student005@ats-demo.example',5,5,2024,1),
(6,'DEMO2026006','Nila','Devi','student006@ats-demo.example',1,6,2024,1),
(7,'DEMO2026007','Vignesh','Krish','student007@ats-demo.example',2,7,2023,1),
(8,'DEMO2026008','Meena','Priya','student008@ats-demo.example',3,8,2023,1),
(9,'DEMO2026009','Sanjay','B','student009@ats-demo.example',4,1,2026,1),
(10,'DEMO2026010','Anitha','K','student010@ats-demo.example',5,2,2026,1),
(11,'DEMO2026011','Hari','Kumar','student011@ats-demo.example',1,3,2025,1),
(12,'DEMO2026012','Kavya','S','student012@ats-demo.example',2,4,2025,1),
(13,'DEMO2026013','Surya','R','student013@ats-demo.example',3,5,2024,1),
(14,'DEMO2026014','Deepa','M','student014@ats-demo.example',4,6,2024,1),
(15,'DEMO2026015','Mohan','Raj','student015@ats-demo.example',5,7,2023,1),
(16,'DEMO2026016','Aishwarya','Devi','student016@ats-demo.example',1,8,2023,1),
(17,'DEMO2026017','Rohit','Krish','student017@ats-demo.example',2,1,2026,1),
(18,'DEMO2026018','Janani','Priya','student018@ats-demo.example',3,2,2026,1),
(19,'DEMO2026019','Bala','B','student019@ats-demo.example',4,3,2025,1),
(20,'DEMO2026020','Keerthi','K','student020@ats-demo.example',5,4,2025,1),
(21,'DEMO2026021','Arun','Kumar','student021@ats-demo.example',1,5,2024,1),
(22,'DEMO2026022','Priya','S','student022@ats-demo.example',2,6,2024,1),
(23,'DEMO2026023','Karthik','R','student023@ats-demo.example',3,7,2023,1),
(24,'DEMO2026024','Divya','M','student024@ats-demo.example',4,8,2023,1),
(25,'DEMO2026025','Rahul','Raj','student025@ats-demo.example',5,1,2026,1),
(26,'DEMO2026026','Nila','Devi','student026@ats-demo.example',1,2,2026,1),
(27,'DEMO2026027','Vignesh','Krish','student027@ats-demo.example',2,3,2025,1),
(28,'DEMO2026028','Meena','Priya','student028@ats-demo.example',3,4,2025,1),
(29,'DEMO2026029','Sanjay','B','student029@ats-demo.example',4,5,2024,1),
(30,'DEMO2026030','Anitha','K','student030@ats-demo.example',5,6,2024,1),
(31,'DEMO2026031','Hari','Kumar','student031@ats-demo.example',1,7,2023,1),
(32,'DEMO2026032','Kavya','S','student032@ats-demo.example',2,8,2023,1),
(33,'DEMO2026033','Surya','R','student033@ats-demo.example',3,1,2026,1),
(34,'DEMO2026034','Deepa','M','student034@ats-demo.example',4,2,2026,1),
(35,'DEMO2026035','Mohan','Raj','student035@ats-demo.example',5,3,2025,1),
(36,'DEMO2026036','Aishwarya','Devi','student036@ats-demo.example',1,4,2025,1),
(37,'DEMO2026037','Rohit','Krish','student037@ats-demo.example',2,5,2024,1),
(38,'DEMO2026038','Janani','Priya','student038@ats-demo.example',3,6,2024,1),
(39,'DEMO2026039','Bala','B','student039@ats-demo.example',4,7,2023,1),
(40,'DEMO2026040','Keerthi','K','student040@ats-demo.example',5,8,2023,1),
(41,'DEMO2026041','Arun','Kumar','student041@ats-demo.example',1,1,2026,1),
(42,'DEMO2026042','Priya','S','student042@ats-demo.example',2,2,2026,1),
(43,'DEMO2026043','Karthik','R','student043@ats-demo.example',3,3,2025,1),
(44,'DEMO2026044','Divya','M','student044@ats-demo.example',4,4,2025,1),
(45,'DEMO2026045','Rahul','Raj','student045@ats-demo.example',5,5,2024,1),
(46,'DEMO2026046','Nila','Devi','student046@ats-demo.example',1,6,2024,1),
(47,'DEMO2026047','Vignesh','Krish','student047@ats-demo.example',2,7,2023,1),
(48,'DEMO2026048','Meena','Priya','student048@ats-demo.example',3,8,2023,1),
(49,'DEMO2026049','Sanjay','B','student049@ats-demo.example',4,1,2026,1),
(50,'DEMO2026050','Anitha','K','student050@ats-demo.example',5,2,2026,1),
(51,'DEMO2026051','Hari','Kumar','student051@ats-demo.example',1,3,2025,1),
(52,'DEMO2026052','Kavya','S','student052@ats-demo.example',2,4,2025,1),
(53,'DEMO2026053','Surya','R','student053@ats-demo.example',3,5,2024,1),
(54,'DEMO2026054','Deepa','M','student054@ats-demo.example',4,6,2024,1),
(55,'DEMO2026055','Mohan','Raj','student055@ats-demo.example',5,7,2023,1),
(56,'DEMO2026056','Aishwarya','Devi','student056@ats-demo.example',1,8,2023,1),
(57,'DEMO2026057','Rohit','Krish','student057@ats-demo.example',2,1,2026,1),
(58,'DEMO2026058','Janani','Priya','student058@ats-demo.example',3,2,2026,1),
(59,'DEMO2026059','Bala','B','student059@ats-demo.example',4,3,2025,1),
(60,'DEMO2026060','Keerthi','K','student060@ats-demo.example',5,4,2025,1),
(61,'DEMO2026061','Arun','Kumar','student061@ats-demo.example',1,5,2024,1),
(62,'DEMO2026062','Priya','S','student062@ats-demo.example',2,6,2024,1),
(63,'DEMO2026063','Karthik','R','student063@ats-demo.example',3,7,2023,1),
(64,'DEMO2026064','Divya','M','student064@ats-demo.example',4,8,2023,1),
(65,'DEMO2026065','Rahul','Raj','student065@ats-demo.example',5,1,2026,1),
(66,'DEMO2026066','Nila','Devi','student066@ats-demo.example',1,2,2026,1),
(67,'DEMO2026067','Vignesh','Krish','student067@ats-demo.example',2,3,2025,1),
(68,'DEMO2026068','Meena','Priya','student068@ats-demo.example',3,4,2025,1),
(69,'DEMO2026069','Sanjay','B','student069@ats-demo.example',4,5,2024,1),
(70,'DEMO2026070','Anitha','K','student070@ats-demo.example',5,6,2024,1),
(71,'DEMO2026071','Hari','Kumar','student071@ats-demo.example',1,7,2023,1),
(72,'DEMO2026072','Kavya','S','student072@ats-demo.example',2,8,2023,1),
(73,'DEMO2026073','Surya','R','student073@ats-demo.example',3,1,2026,1),
(74,'DEMO2026074','Deepa','M','student074@ats-demo.example',4,2,2026,1),
(75,'DEMO2026075','Mohan','Raj','student075@ats-demo.example',5,3,2025,1),
(76,'DEMO2026076','Aishwarya','Devi','student076@ats-demo.example',1,4,2025,1),
(77,'DEMO2026077','Rohit','Krish','student077@ats-demo.example',2,5,2024,1),
(78,'DEMO2026078','Janani','Priya','student078@ats-demo.example',3,6,2024,1),
(79,'DEMO2026079','Bala','B','student079@ats-demo.example',4,7,2023,1),
(80,'DEMO2026080','Keerthi','K','student080@ats-demo.example',5,8,2023,1),
(81,'DEMO2026081','Arun','Kumar','student081@ats-demo.example',1,1,2026,1),
(82,'DEMO2026082','Priya','S','student082@ats-demo.example',2,2,2026,1),
(83,'DEMO2026083','Karthik','R','student083@ats-demo.example',3,3,2025,1),
(84,'DEMO2026084','Divya','M','student084@ats-demo.example',4,4,2025,1),
(85,'DEMO2026085','Rahul','Raj','student085@ats-demo.example',5,5,2024,1),
(86,'DEMO2026086','Nila','Devi','student086@ats-demo.example',1,6,2024,1),
(87,'DEMO2026087','Vignesh','Krish','student087@ats-demo.example',2,7,2023,1),
(88,'DEMO2026088','Meena','Priya','student088@ats-demo.example',3,8,2023,1),
(89,'DEMO2026089','Sanjay','B','student089@ats-demo.example',4,1,2026,1),
(90,'DEMO2026090','Anitha','K','student090@ats-demo.example',5,2,2026,1),
(91,'DEMO2026091','Hari','Kumar','student091@ats-demo.example',1,3,2025,1),
(92,'DEMO2026092','Kavya','S','student092@ats-demo.example',2,4,2025,1),
(93,'DEMO2026093','Surya','R','student093@ats-demo.example',3,5,2024,1),
(94,'DEMO2026094','Deepa','M','student094@ats-demo.example',4,6,2024,1),
(95,'DEMO2026095','Mohan','Raj','student095@ats-demo.example',5,7,2023,1),
(96,'DEMO2026096','Aishwarya','Devi','student096@ats-demo.example',1,8,2023,1),
(97,'DEMO2026097','Rohit','Krish','student097@ats-demo.example',2,1,2026,1),
(98,'DEMO2026098','Janani','Priya','student098@ats-demo.example',3,2,2026,1),
(99,'DEMO2026099','Bala','B','student099@ats-demo.example',4,3,2025,1),
(100,'DEMO2026100','Keerthi','K','student100@ats-demo.example',5,4,2025,1);

INSERT IGNORE INTO marks (mark_id, student_id, subject_id, internal_marks, exam_marks, total_marks, grade, assessment_date) VALUES
(1,1,1,17,36,53,'B','2026-09-30'),
(2,1,2,22,50,72,'A','2026-09-30'),
(3,1,3,21,43,64,'B+','2026-09-30'),
(4,1,4,17,69,86,'A+','2026-09-30'),
(5,1,5,16,62,78,'A','2026-09-30'),
(6,2,6,15,36,51,'B','2026-09-30'),
(7,2,7,16,48,64,'B+','2026-09-30'),
(8,2,8,21,67,88,'A+','2026-09-30'),
(9,2,9,14,70,84,'A+','2026-09-30'),
(10,2,10,20,69,89,'A+','2026-09-30'),
(11,3,11,27,49,76,'A','2026-09-30'),
(12,3,12,28,52,80,'A+','2026-09-30'),
(13,3,13,14,45,59,'B','2026-09-30'),
(14,3,14,27,56,83,'A+','2026-09-30'),
(15,3,15,22,44,66,'B+','2026-09-30'),
(16,4,16,20,56,76,'A','2026-09-30'),
(17,4,17,17,40,57,'B','2026-09-30'),
(18,4,18,26,41,67,'B+','2026-09-30'),
(19,4,19,25,57,82,'A+','2026-09-30'),
(20,4,20,22,37,59,'B','2026-09-30'),
(21,5,21,28,69,97,'O','2026-09-30'),
(22,5,22,17,59,76,'A','2026-09-30'),
(23,5,23,16,70,86,'A+','2026-09-30'),
(24,5,24,23,58,81,'A+','2026-09-30'),
(25,5,25,20,39,59,'B','2026-09-30'),
(26,6,1,15,49,64,'B+','2026-09-30'),
(27,6,2,23,40,63,'B+','2026-09-30'),
(28,6,3,21,41,62,'B+','2026-09-30'),
(29,6,4,26,52,78,'A','2026-09-30'),
(30,6,5,28,58,86,'A+','2026-09-30'),
(31,7,6,19,58,77,'A','2026-09-30'),
(32,7,7,25,48,73,'A','2026-09-30'),
(33,7,8,22,39,61,'B+','2026-09-30'),
(34,7,9,19,69,88,'A+','2026-09-30'),
(35,7,10,21,45,66,'B+','2026-09-30'),
(36,8,11,28,59,87,'A+','2026-09-30'),
(37,8,12,22,70,92,'O','2026-09-30'),
(38,8,13,21,55,76,'A','2026-09-30'),
(39,8,14,15,49,64,'B+','2026-09-30'),
(40,8,15,15,55,70,'A','2026-09-30'),
(41,9,16,26,52,78,'A','2026-09