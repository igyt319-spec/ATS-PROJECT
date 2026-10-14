USE ats_database;
INSERT IGNORE INTO grading_rules(minimum_mark,grade,grade_point,performance_status) VALUES
(0,'F',0,'Weak'),(50,'C',6,'Weak'),(60,'B',7,'Average'),(70,'B+',8,'Average'),(80,'A',9,'Strong'),(90,'A+',10,'Strong');
INSERT IGNORE INTO attendance_thresholds(status,minimum_percentage) VALUES ('RISK',0),('MONITOR',75),('GOOD',85);
-- Publicly listed BIT department names; programs/subjects below are demo catalogue records.
INSERT INTO colleges(name,code,city,state,data_notice) VALUES
('Bannari Amman Institute of Technology','BIT','Sathyamangalam','Tamil Nadu','Publicly listed institution and departments; all student records are synthetic demo data.')
ON DUPLICATE KEY UPDATE name=VALUES(name);
INSERT IGNORE INTO departments(college_id,code,name) VALUES
(1,'AGR','Agricultural Engineering'),(1,'AIDS','Artificial Intelligence and Data Science'),(1,'AIML','Artificial Intelligence and Machine Learning'),
(1,'BME','Biomedical Engineering'),(1,'BT','Biotechnology'),(1,'CHEM','Chemistry'),(1,'CIV','Civil Engineering'),
(1,'CSBS','Computer Science and Business Systems'),(1,'CSD','Computer Science and Design'),(1,'CSE','Computer Science and Engineering'),
(1,'CT','Computer Technology'),(1,'EEE','Electrical and Electronics Engineering'),(1,'ECE','Electronics and Communication Engineering'),
(1,'EIE','Electronics and Instrumentation Engineering'),(1,'FT','Fashion Technology'),(1,'FOOD','Food Technology'),
(1,'HUM','Humanities'),(1,'ISE','Information Science and Engineering'),(1,'IT','Information Technology'),
(1,'MATH','Mathematics'),(1,'MECH','Mechanical Engineering'),(1,'MTR','Mechatronics Engineering'),
(1,'PE','Physical Education'),(1,'PHY','Physics'),(1,'SMS','School of Management Studies');
INSERT IGNORE INTO programs(department_id,code,name,award,duration_years)
SELECT id,'BTECH-AGR','B.Tech. - Agricultural Engineering','B.Tech.',4 FROM departments WHERE code='AGR';
INSERT IGNORE INTO programs(department_id,code,name,award,duration_years)
SELECT id,'BTECH-AIDS','B.Tech. - Artificial Intelligence and Data Science','B.Tech.',4 FROM departments WHERE code='AIDS';
INSERT IGNORE INTO programs(department_id,code,name,award,duration_years)
SELECT id,'BTECH-BT','B.Tech. - Biotechnology','B.Tech.',4 FROM departments WHERE code='BT';
INSERT IGNORE INTO programs(department_id,code,name,award,duration_years)
SELECT id,'BE-CSE','B.E. - Computer Science and Engineering','B.E.',4 FROM departments WHERE code='CSE';
INSERT IGNORE INTO programs(department_id,code,name,award,duration_years)
SELECT id,'BE-EEE','B.E. - Electrical and Electronics Engineering','B.E.',4 FROM departments WHERE code='EEE';
INSERT IGNORE INTO programs(department_id,code,name,award,duration_years)
SELECT id,'BE-ECE','B.E. - Electronics and Communication Engineering','B.E.',4 FROM departments WHERE code='ECE';
INSERT IGNORE INTO programs(department_id,code,name,award,duration_years)
SELECT id,'BE-EIE','B.E. - Electronics and Instrumentation Engineering','B.E.',4 FROM departments WHERE code='EIE';
INSERT IGNORE INTO programs(department_id,code,name,award,duration_years)
SELECT id,'BTECH-IT','B.Tech. - Information Technology','B.Tech.',4 FROM departments WHERE code='IT';
INSERT IGNORE INTO programs(department_id,code,name,award,duration_years)
SELECT id,'BE-MECH','B.E. - Mechanical Engineering','B.E.',4 FROM departments WHERE code='MECH';
INSERT IGNORE INTO programs(department_id,code,name,award,duration_years)
SELECT id,'BE-MTR','B.E. - Mechatronics Engineering','B.E.',4 FROM departments WHERE code='MTR';
INSERT IGNORE INTO programs(department_id,code,name,award,duration_years)
SELECT id,'ME-CSE','M.E. - Computer Science and Engineering','M.E.',2 FROM departments WHERE code='CSE';
INSERT IGNORE INTO programs(department_id,code,name,award,duration_years)
SELECT id,'ME-ISE','M.E. - Industrial Safety Engineering','M.E.',2 FROM departments WHERE code='MECH';
INSERT IGNORE INTO programs(department_id,code,name,award,duration_years)
SELECT id,'ME-VLSI','M.E. - VLSI Design','M.E.',2 FROM departments WHERE code='ECE';
INSERT IGNORE INTO programs(department_id,code,name,award,duration_years)
SELECT id,'MBA-SMS','M.B.A. - Master of Business Administration','M.B.A.',2 FROM departments WHERE code='SMS';
INSERT IGNORE INTO academic_years(label,start_date,end_date) VALUES
('2023-2024','2023-06-01','2024-05-31'),('2024-2025','2024-06-01','2025-05-31'),('2025-2026','2025-06-01','2026-05-31'),('2026-2027','2026-06-01','2027-05-31');
INSERT IGNORE INTO semesters(academic_year_id,semester_number,label,start_date,end_date,status)
SELECT y.id,(CAST(SUBSTRING(y.label,1,4) AS UNSIGNED)-2023)*2+n.n,CONCAT('Semester ',(CAST(SUBSTRING(y.label,1,4) AS UNSIGNED)-2023)*2+n.n),
DATE_ADD(y.start_date,INTERVAL (n.n-1)*6 MONTH),DATE_ADD(y.start_date,INTERVAL n.n*6 MONTH),
CASE WHEN y.label='2026-2027' AND n.n=1 THEN 'active' WHEN y.start_date<'2026-06-01' THEN 'completed' ELSE 'planned' END
FROM academic_years y JOIN (SELECT 1 n UNION SELECT 2) n;
-- The course catalogue is a synthetic demonstration catalogue, not a claim about BIT's official syllabi.
INSERT IGNORE INTO subjects(subject_code,subject_name,department_id,semester_number,credits,subject_type)
SELECT CONCAT(d.code,LPAD(s.n,3,'0')), CONCAT(s.title,' (',d.name,')'), d.id, s.sem, s.credits, s.kind
FROM departments d JOIN (
 SELECT 1 n,1 sem,'Engineering Mathematics I' title,4 credits,'Theory' kind UNION ALL
 SELECT 2,1,'Programming Fundamentals',4,'Integrated' UNION ALL
 SELECT 3,1,'Engineering Physics',3,'Theory' UNION ALL
 SELECT 4,3,'Data Structures and Algorithms',4,'Integrated' UNION ALL
 SELECT 5,3,'Digital Systems',3,'Theory' UNION ALL
 SELECT 6,5,'Database Systems',3,'Theory' UNION ALL
 SELECT 7,5,'Department Core Laboratory',2,'Practical' UNION ALL
 SELECT 8,5,'Professional Elective I',3,'Elective' UNION ALL
 SELECT 9,7,'Capstone Project',4,'Project'
 UNION ALL SELECT 10,3,'Embedded Systems Fundamentals',3,'Integrated'
 UNION ALL SELECT 11,7,'Industry Internship',2,'Practical'
 UNION ALL SELECT 12,7,'Technical Elective II',3,'Elective'
 UNION ALL SELECT 13,2,'Engineering Mathematics II',4,'Theory'
 UNION ALL SELECT 14,2,'Engineering Design Studio',2,'Practical'
 UNION ALL SELECT 15,4,'Operating Systems Fundamentals',3,'Theory'
 UNION ALL SELECT 16,4,'Electronics and Instrumentation Laboratory',2,'Practical'
 UNION ALL SELECT 17,2,'Engineering Science Laboratory',2,'Practical'
 UNION ALL SELECT 18,4,'Professional Communication',2,'Integrated'
 UNION ALL SELECT 19,6,'Software Engineering',3,'Theory'
 UNION ALL SELECT 20,6,'Discipline Core II',3,'Theory'
 UNION ALL SELECT 21,6,'Applied Project Laboratory',2,'Practical'
 UNION ALL SELECT 22,8,'Major Project',6,'Project'
 UNION ALL SELECT 23,8,'Open Elective',3,'Elective'
 UNION ALL SELECT 24,8,'Professional Practice',2,'Integrated'
) s;
-- Deterministic demo faculty identities; they are fictional and use reserved example.test addresses.
INSERT IGNORE INTO faculty(faculty_code,name,email,department_id,designation)
SELECT CONCAT('DF',LPAD(id,3,'0')),CONCAT('Demo Faculty ',name),CONCAT('faculty.',LOWER(code),'@example.test'),id,'Assistant Professor'
FROM departments WHERE code IN ('AIDS','CSE','ECE','EEE','IT','MECH','CIV');
INSERT IGNORE INTO subject_allocations(subject_id,semester_id,faculty_id,section_code)
SELECT sb.id,se.id,f.id,'A' FROM subjects sb JOIN semesters se ON se.semester_number=sb.semester_number
LEFT JOIN faculty f ON f.department_id=sb.department_id
WHERE se.academic_year_id=(SELECT id FROM academic_years WHERE label='2026-2027') AND (f.id IS NULL OR f.id=(SELECT MIN(f2.id) FROM faculty f2 WHERE f2.department_id=sb.department_id));
