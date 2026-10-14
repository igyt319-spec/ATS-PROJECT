-- LEGACY SAMPLE DATA ONLY: all named people and records below are fictional.
-- Do not import this file into the college demo database. Use college_data.sql
-- followed by seed_data.sql for the 100 clearly labelled synthetic students.
-- ============================================================
-- Sample Data for AI-Based Academic Tracking System (ATS)
-- ============================================================

USE ats_database;

-- 1. INSERT USERS
-- (Passwords are stored as bcrypt hashes; for demo compatibility plain text fallback is also checked)
-- student123 -> $2b$10$wEkgmCsh0D5kMtzqU3qjKeq3Jv29d8a3O1VqQ3O9uCcm6Wb5NqAom (or verified via controller)
INSERT INTO users (id, name, email, register_number, password, role) VALUES
(1, 'Ishita', 'student@ats.com', 'ATS001', '$2b$10$7ZzM8l02Ekg5v4g2rJtK9eMeqv8F6gCsuvUu/kZqLzQvW4N6X8jmi', 'student'),
(2, 'Rahul Sharma', 'rahul@ats.com', 'ATS002', '$2b$10$7ZzM8l02Ekg5v4g2rJtK9eMeqv8F6gCsuvUu/kZqLzQvW4N6X8jmi', 'student'),
(3, 'Ananya Patel', 'ananya@ats.com', 'ATS003', '$2b$10$7ZzM8l02Ekg5v4g2rJtK9eMeqv8F6gCsuvUu/kZqLzQvW4N6X8jmi', 'student'),
(4, 'Vikram Singh', 'vikram@ats.com', 'ATS004', '$2b$10$7ZzM8l02Ekg5v4g2rJtK9eMeqv8F6gCsuvUu/kZqLzQvW4N6X8jmi', 'student'),
(5, 'Priya Nair', 'priya@ats.com', 'ATS005', '$2b$10$7ZzM8l02Ekg5v4g2rJtK9eMeqv8F6gCsuvUu/kZqLzQvW4N6X8jmi', 'student'),
(6, 'Dr. Rajesh Kumar', 'admin@ats.com', 'FAC001', '$2b$10$iT3J5r9f4yN8a1kL9m0uKeA5b9C8d7e6f5g4h3j2k1l0m9n8o7p6q', 'admin')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 2. INSERT STUDENTS
INSERT INTO students (id, user_id, register_number, name, email, phone, department, year, semester, gpa, cgpa, attendance_percentage, academic_score, risk_level, avatar, bio) VALUES
(1, 1, 'ATS001', 'Ishita', 'student@ats.com', '+91 9876543210', 'Electronics and Communication Engineering', 'III Year', 'Semester 5', 8.60, 8.45, 87.00, 84, 'LOW', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', 'Enthusiastic 3rd year ECE undergraduate with a keen focus on embedded AI systems, IoT firmware, and relational database architectures.'),
(2, 2, 'ATS002', 'Rahul Sharma', 'rahul@ats.com', '+91 9876543211', 'Computer Science and Engineering', 'III Year', 'Semester 5', 7.40, 7.30, 78.00, 72, 'MEDIUM', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150', 'CSE student passionate about full stack web development and cloud architectures.'),
(3, 3, 'ATS003', 'Ananya Patel', 'ananya@ats.com', '+91 9876543212', 'Information Technology', 'III Year', 'Semester 5', 9.20, 9.15, 94.00, 93, 'LOW', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', 'Top ranker exploring natural language processing and distributed systems.'),
(4, 4, 'ATS004', 'Vikram Singh', 'vikram@ats.com', '+91 9876543213', 'Electronics and Communication Engineering', 'III Year', 'Semester 5', 5.80, 6.10, 68.00, 56, 'HIGH', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'ECE student actively working to recover academic standing through remedial mentoring.'),
(5, 5, 'ATS005', 'Priya Nair', 'priya@ats.com', '+91 9876543214', 'Mechanical Engineering', 'III Year', 'Semester 5', 8.10, 8.05, 85.00, 80, 'LOW', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', 'Mechatronics and robotics enthusiast focusing on automation.')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 3. INSERT SUBJECTS
INSERT INTO subjects (id, code, name, department, credits) VALUES
(1, 'EC501', 'Mathematics', 'ECE', 4),
(2, 'EC502', 'Python', 'ECE', 4),
(3, 'EC503', 'Database Management', 'ECE', 4),
(4, 'EC504', 'Communication', 'ECE', 2),
(5, 'EC505', 'Electronics', 'ECE', 3)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 4. INSERT MARKS FOR ISHITA (id=1)
INSERT INTO marks (student_id, subject_id, internal_marks, assignment_marks, exam_marks, total_marks, grade, status, semester) VALUES
(1, 1, 18.00, 18.00, 49.00, 85.00, 'A', 'Strong', 'Semester 5'),
(1, 2, 16.00, 16.00, 46.00, 78.00, 'B+', 'Average', 'Semester 5'),
(1, 3, 14.00, 14.00, 40.00, 68.00, 'B', 'Weak', 'Semester 5'),
(1, 4, 19.00, 19.00, 52.00, 90.00, 'A+', 'Strong', 'Semester 5'),
(1, 5, 17.00, 17.00, 48.00, 82.00, 'A', 'Strong', 'Semester 5'),
-- Sample marks for Vikram Singh (High Risk demo)
(4, 1, 10.00, 11.00, 32.00, 53.00, 'D', 'Weak', 'Semester 5'),
(4, 2, 12.00, 11.00, 35.00, 58.00, 'D', 'Weak', 'Semester 5'),
(4, 3, 9.00, 10.00, 30.00, 49.00, 'E', 'Weak', 'Semester 5'),
(4, 4, 14.00, 14.00, 42.00, 70.00, 'B', 'Average', 'Semester 5'),
(4, 5, 11.00, 12.00, 36.00, 59.00, 'D', 'Weak', 'Semester 5');

-- 5. INSERT ATTENDANCE
INSERT INTO attendance (student_id, subject_id, total_classes, attended_classes, percentage, status, month) VALUES
(1, 1, 50, 45, 90.00, 'GOOD', 'Overall'),
(1, 2, 50, 38, 76.00, 'MONITOR', 'Overall'),
(1, 3, 50, 35, 70.00, 'RISK', 'Overall'),
(1, 4, 50, 48, 96.00, 'GOOD', 'Overall'),
(1, 5, 50, 44, 88.00, 'GOOD', 'Overall'),
-- Vikram Singh attendance (Low)
(4, 1, 50, 33, 66.00, 'RISK', 'Overall'),
(4, 2, 50, 36, 72.00, 'RISK', 'Overall'),
(4, 3, 50, 31, 62.00, 'RISK', 'Overall'),
(4, 4, 50, 39, 78.00, 'MONITOR', 'Overall'),
(4, 5, 50, 32, 64.00, 'RISK', 'Overall');

-- 6. INSERT ACHIEVEMENTS (8 items for Ishita per demo)
INSERT INTO achievements (student_id, title, category, achievement_date, description, certificate_url, status) VALUES
(1, 'Smart India Hackathon 2024 - 1st Runner Up', 'Hackathon', '2024-03-15', 'Built an edge IoT monitoring device for rural air quality tracking.', 'https://example.com/cert/sih2024', 'Verified'),
(1, 'IEEE International Conference Paper on Edge AI', 'Paper Presentation', '2024-05-20', 'Published peer-reviewed paper titled "Real-Time Microcontroller Inference Optimizations".', 'https://example.com/cert/ieee-paper', 'Verified'),
(1, 'AWS Certified Cloud Practitioner', 'Certification', '2024-06-10', 'Validated foundational understanding of cloud security, storage, and architectures.', 'https://example.com/cert/aws-ccp', 'Verified'),
(1, 'Deep Learning Specialization - Coursera', 'Certification', '2024-07-25', 'Mastered multi-layer neural networks, CNNs, Sequence models with Prof. Andrew Ng.', 'https://example.com/cert/dl-spec', 'Verified'),
(1, 'National Web Dev Hackathon Finalist', 'Hackathon', '2024-08-14', 'Developed real-time collaborative workspace using WebSockets and Node.js.', 'https://example.com/cert/web-hack', 'Verified'),
(1, 'Hands-on Docker & Kubernetes Workshop', 'Workshop', '2024-09-05', 'Completed 3-day intensive workshop on container orchestration and cloud microservices.', 'https://example.com/cert/k8s-work', 'Verified'),
(1, 'Inter-College Badminton Championship Gold Medalist', 'Sports', '2024-09-28', 'Represented college in zone level doubles badminton tournament and clinched gold.', 'https://example.com/cert/sports-gold', 'Verified'),
(1, 'State Level Code Debugging Contest 1st Place', 'Technical Competition', '2024-10-18', 'Ranked 1st among 250 participants in timed C++ and Python memory leak debugging.', 'https://example.com/cert/debug-first', 'Verified');

-- 7. INSERT RECOMMENDATIONS
INSERT INTO recommendations (student_id, priority, title, reason, recommendation, category, status) VALUES
(1, 'HIGH', 'Improve Attendance in Database Management', 'Your attendance in Database Management is 70.00%, which is below the safe institutional threshold of 75%.', 'Attend the next 5 consecutive DBMS lectures to pull attendance back above 76%. Meet the subject tutor if you missed labs.', 'Attendance', 'Active'),
(1, 'MEDIUM', 'Address Relational Normalization & SQL Queries', 'Database Management internal score is 68 (Weak status). Exam performance dropped by 12% compared to internal tests.', 'Dedicate 45 minutes daily to practicing BCNF/3NF decomposition exercises and complex nested subqueries.', 'Academic', 'Active'),
(1, 'LOW', 'Complete Cloud Microservices Certification', 'Strong programming foundation in Python (78%) and existing AWS Cloud Practitioner certification.', 'Consider undertaking the AWS Certified Developer Associate or Docker Certified Associate exam.', 'Career', 'Active');

-- 8. INSERT NOTIFICATIONS
INSERT INTO notifications (student_id, type, title, message, is_read) VALUES
(1, 'attendance', 'Attendance Alert', 'Your attendance in Database Management is 70%. Maintain regular attendance to avoid semester condonation fees.', FALSE),
(1, 'marks', 'DBMS Performance Warning', 'Your mid-semester score in Database Management (68/100) indicates extra practice is required for SQL.', FALSE),
(1, 'recommendation', 'AI Study Plan Generated', 'The AI Academic Monitoring Agent has generated 3 targeted recommendations to help elevate your GPA.', FALSE),
(1, 'achievement', 'Achievement Verified', 'Your IEEE International Conference Paper certificate has been verified by the department faculty.', TRUE),
(1, 'faculty', 'Faculty Announcement', 'Dr. Rajesh Kumar announced a DBMS remedial review lecture this Thursday at 3:30 PM in Hall B.', TRUE);

-- 9. INSERT INITIAL CHAT HISTORY
INSERT INTO chat_history (student_id, sender, message) VALUES
(1, 'user', 'What are my weak subjects?'),
(1, 'bot', 'Based on your Semester 5 records, your weakest subject is **Database Management** with a score of **68/100 (Status: Weak)**. Your attendance in this subject is also **70%**, which falls under the risk threshold. Would you like a prioritized 7-day study plan to improve this?');
