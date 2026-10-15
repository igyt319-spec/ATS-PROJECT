-- Phase 5 Migration: Expand avatar column to TEXT for users, students, and faculty
-- Prevents ER_DATA_TOO_LONG (MySQL 1406) errors while ensuring full backward compatibility.

ALTER TABLE users MODIFY COLUMN avatar TEXT;
ALTER TABLE students MODIFY COLUMN avatar TEXT;
ALTER TABLE faculty MODIFY COLUMN avatar TEXT;
