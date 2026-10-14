// Rebuild database/seed_data.sql with deterministic, clearly synthetic demo records.
// Run: node database/generate_seed.js (from ATS_Project)
const fs = require('fs');
const bcrypt = require('bcryptjs');
const path = require('path');

const depts = [
  ['CSE','Computer Science and Engineering','BE-CSE'], ['IT','Information Technology','BTECH-IT'],
  ['ECE','Electronics and Communication Engineering','BE-ECE'], ['EEE','Electrical and Electronics Engineering','BE-EEE'],
  ['MECH','Mechanical Engineering','BE-MECH'], ['AIDS','Artificial Intelligence and Data Science','BTECH-AIDS']
];
const first = ['Aarav','Aditi','Aditya','Akash','Amara','Anika','Arjun','Diya','Ira','Ishaan','Kavya','Kiran','Mira','Neel','Nila','Rohan','Sana','Tara','Vihaan','Zoya'];
const last = ['Anand','Bala','Chandra','Das','Devi','Iyer','Jain','Kumar','Menon','Nair','Patel','Rao','Reddy','Shah','Singh','Subramanian','Verma','Pillai','Joseph','Prakash'];
let state=20261005;
const rand=()=>{ state=(state*1664525+1013904223)>>>0; return state/4294967296; };
const pick=a=>a[Math.floor(rand()*a.length)];
const q=s=>`'${String(s).replace(/'/g,"''")}'`;
const rows=[];
rows.push("USE ats_database;", "-- Entire roster, marks, attendance and achievements in this file are synthetic demonstration data.", "-- Demo password for all seeded accounts is documented in README; hashes are bcrypt.");
const studentHash=bcrypt.hashSync('student123',10); const adminHash=bcrypt.hashSync('admin123',10);
const facultyHash=bcrypt.hashSync('faculty123',10);
rows.push(`INSERT INTO users(name,email,register_number,password,role) VALUES ('ATS Demo Administrator','admin@ats.com','FAC001',${q(adminHash)},'admin') ON DUPLICATE KEY UPDATE name=VALUES(name),password=VALUES(password),role='admin';`);
for (const [code,name] of [['AIDS','Artificial Intelligence and Data Science'],['CSE','Computer Science and Engineering'],['ECE','Electronics and Communication Engineering'],['EEE','Electrical and Electronics Engineering'],['IT','Information Technology'],['MECH','Mechanical Engineering'],['EIE','Electronics and Instrumentation Engineering']]) {
 const facultyEmail=`faculty.${code.toLowerCase()}@example.test`, facultyCode=`FAC-${code}`;
 rows.push(`INSERT INTO users(name,email,register_number,password,role) VALUES (${q('Demo Faculty '+name)},${q(facultyEmail)},${q(facultyCode)},${q(facultyHash)},'faculty') ON DUPLICATE KEY UPDATE password=VALUES(password),role='faculty';`);
 rows.push(`UPDATE faculty SET user_id=(SELECT id FROM users WHERE register_number=${q(facultyCode)}) WHERE email=${q(facultyEmail)};`);
}
for(let i=0;i<100;i++){
 const n=i+1, reg=`BITD${String(n).padStart(4,'0')}`, name=`${pick(first)} ${pick(last)}`, email=`${reg.toLowerCase()}@example.test`, dept=depts[i%depts.length];
 const sem=1+Math.floor(rand()*8), year=Math.ceil(sem/2), startYear=2023+Math.floor((sem-1)/2), academicYear=`${startYear}-${startYear+1}`, gpa=(5.1+rand()*4.7);
 rows.push(`INSERT INTO users(name,email,register_number,password,role) VALUES (${q(name)},${q(email)},${q(reg)},${q(studentHash)},'student') ON DUPLICATE KEY UPDATE name=VALUES(name),password=VALUES(password);`);
 rows.push(`INSERT INTO students(user_id,register_number,name,email,department_id,program_id,current_semester_id,year,semester,academic_year,status) SELECT u.id,${q(reg)},${q(name)},${q(email)},d.id,p.id,se.id,${q(['I','II','III','IV'][year-1]+' Year')},${q('Semester '+sem)},${q(academicYear)},'active' FROM users u JOIN departments d ON d.code=${q(dept[0])} JOIN programs p ON p.code=${q(dept[2])} JOIN semesters se ON se.semester_number=${sem} AND se.academic_year_id=(SELECT id FROM academic_years WHERE label=${q(academicYear)}) WHERE u.register_number=${q(reg)} ON DUPLICATE KEY UPDATE name=VALUES(name),department_id=VALUES(department_id),program_id=VALUES(program_id),current_semester_id=VALUES(current_semester_id),year=VALUES(year),semester=VALUES(semester),academic_year=VALUES(academic_year);`);
 for(const recordSemester of [1,2,3,4,5,6,7,8].filter(value => value <= sem)){
  const recordYear=2023+Math.floor((recordSemester-1)/2), recordAcademicYear=`${recordYear}-${recordYear+1}`;
  const subjectNos={1:[1,2,3],2:[13,14,17],3:[4,5,10],4:[15,16,18],5:[6,7,8],6:[19,20,21],7:[9,11,12],8:[22,23,24]}[recordSemester];
  for(const subjectNo of subjectNos){
  const raw=Math.max(30,Math.min(99,Math.round(34+gpa*5.4+(rand()-.5)*42)));
  const internal=Math.round(raw*.2), assignment=Math.round(raw*.2), exam=Math.max(0,Math.min(60,raw-internal-assignment)), total=internal+assignment+exam;
  const grade=total>=90?'A+':total>=80?'A':total>=70?'B+':total>=60?'B':total>=50?'C':'F', gp=total>=90?10:total>=80?9:total>=70?8:total>=60?7:total>=50?6:0, status=total>=80?'Strong':total>=60?'Average':'Weak';
  const attendance=35+Math.floor(rand()*16), classes=50, pct=+(attendance/classes*100).toFixed(2), ast=pct>=85?'GOOD':pct>=75?'MONITOR':'RISK';
  rows.push(`INSERT INTO student_subjects(student_id,subject_id,semester_id) SELECT st.id,su.id,se.id FROM students st JOIN subjects su ON su.subject_code=CONCAT(${q(dept[0])},LPAD(${subjectNo},3,'0')) JOIN semesters se ON se.semester_number=${recordSemester} AND se.academic_year_id=(SELECT id FROM academic_years WHERE label=${q(recordAcademicYear)}) WHERE st.register_number=${q(reg)} ON DUPLICATE KEY UPDATE enrollment_status='enrolled';`);
  rows.push(`INSERT INTO marks(student_id,subject_id,semester_id,internal_marks,assignment_marks,exam_marks,total_marks,grade,grade_point,performance_status,status,semester) SELECT st.id,su.id,se.id,${internal},${assignment},${exam},${total},${q(grade)},${gp},${q(status)},${q(status)},${q('Semester '+recordSemester)} FROM students st JOIN subjects su ON su.subject_code=CONCAT(${q(dept[0])},LPAD(${subjectNo},3,'0')) JOIN semesters se ON se.semester_number=${recordSemester} AND se.academic_year_id=(SELECT id FROM academic_years WHERE label=${q(recordAcademicYear)}) WHERE st.register_number=${q(reg)} ON DUPLICATE KEY UPDATE internal_marks=VALUES(internal_marks),assignment_marks=VALUES(assignment_marks),exam_marks=VALUES(exam_marks),total_marks=VALUES(total_marks),grade=VALUES(grade),grade_point=VALUES(grade_point),performance_status=VALUES(performance_status),status=VALUES(status);`);
  rows.push(`INSERT INTO attendance(student_id,subject_id,semester_id,classes_conducted,classes_attended,attendance_percentage,attendance_status,total_classes,attended_classes,percentage,status) SELECT st.id,su.id,se.id,${classes},${attendance},${pct},${q(ast)},${classes},${attendance},${pct},${q(ast)} FROM students st JOIN subjects su ON su.subject_code=CONCAT(${q(dept[0])},LPAD(${subjectNo},3,'0')) JOIN semesters se ON se.semester_number=${recordSemester} AND se.academic_year_id=(SELECT id FROM academic_years WHERE label=${q(recordAcademicYear)}) WHERE st.register_number=${q(reg)} ON DUPLICATE KEY UPDATE classes_conducted=VALUES(classes_conducted),classes_attended=VALUES(classes_attended),attendance_percentage=VALUES(attendance_percentage),attendance_status=VALUES(attendance_status),total_classes=VALUES(total_classes),attended_classes=VALUES(attended_classes),percentage=VALUES(percentage),status=VALUES(status);`);
  }
 }
 if(n%4===0){
  const category=['Hackathon','Paper Presentation','Workshop','Certification','Sports','Technical Competition'][n%6];
  rows.push(`INSERT INTO achievements(student_id,title,category,achievement_date,description,status) SELECT id,${q('Synthetic demo: '+category+' participation')},${q(category)},'2026-08-15','Synthetic example record for ATS demonstration; not a BIT student achievement.','Pending' FROM students WHERE register_number=${q(reg)} AND NOT EXISTS(SELECT 1 FROM achievements a JOIN students s ON a.student_id=s.id WHERE s.register_number=${q(reg)} AND a.title=${q('Synthetic demo: '+category+' participation')});`);
  if(category==='Certification') rows.push(`INSERT INTO certifications(student_id,name,issuer,issue_date,status) SELECT id,'Synthetic demo course completion','Demo issuer','2026-08-15','pending' FROM students WHERE register_number=${q(reg)} AND NOT EXISTS(SELECT 1 FROM certifications c JOIN students s ON c.student_id=s.id WHERE s.register_number=${q(reg)} AND c.name='Synthetic demo course completion');`);
 }
 if(n%10===0) rows.push(`INSERT INTO certifications(student_id,name,issuer,issue_date,status) SELECT id,'Synthetic demo learning certificate','Demo issuer','2026-08-15','pending' FROM students WHERE register_number=${q(reg)} AND NOT EXISTS(SELECT 1 FROM certifications c JOIN students s ON c.student_id=s.id WHERE s.register_number=${q(reg)} AND c.name='Synthetic demo learning certificate');`);
}
const out=path.join(__dirname,'seed_data.sql'); fs.writeFileSync(out,rows.join('\n')+'\n','utf8'); console.log(`Wrote ${out} with 100 synthetic students.`);
