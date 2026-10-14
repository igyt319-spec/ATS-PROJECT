# Academic Tracking System (ATS) - Project Notes & Viva Preparation

## 1. Mathematical Formulas & Heuristic Rules

### A. Academic Performance Score (Out of 100)
To combine varied qualitative and quantitative metrics into a single holistic indicator:

$$\text{Academic Score} = (0.70 \times \bar{M}) + (0.20 \times A) + (0.10 \times \text{Norm}(C))$$

Where:
- $\bar{M}$ = Average Subject Marks across enrolled courses (0 to 100).
- $A$ = Overall Attendance Percentage (0 to 100).
- $\text{Norm}(C) = \min\left(100, \frac{\text{Count of Verified Achievements}}{8} \times 100\right)$.

The landing page contains a labelled synthetic illustration. Live student dashboard scores are computed from the authenticated student's database records; the synthetic seed is not real BIT student data.

---

### B. Attendance Shortage Recovery Formula
If a student's attendance percentage $P = \frac{\text{Attended}}{\text{Total}} \times 100$ is below the target threshold $T$ (e.g. 75% or 85%):
$$\frac{\text{Attended} + x}{\text{Total} + x} \ge \frac{T}{100}$$
Solving for $x$ (consecutive upcoming lectures required):
$$x \ge \left\lceil \frac{T \times \text{Total} - 100 \times \text{Attended}}{100 - T} \right\rceil$$

---

### C. Academic Risk Classification Matrix
- **HIGH RISK**:
  - Overall Attendance $< 75\%$ OR
  - Cumulative GPA $< 6.0$ OR
  - Number of Weak Subjects ($\text{Marks} < 60$) $\ge 2$
- **MEDIUM RISK**:
  - Attendance between $75\%$ and $79.9\%$ OR
  - Cumulative GPA between $6.0$ and $7.49$ OR
  - Exactly 1 Weak Subject
- **LOW RISK**:
  - Attendance $\ge 80\%$, GPA $\ge 7.5$, and 0 Weak Subjects.

---

## 2. Key Viva Voce Questions & Answers

### Q1: Why didn't you use a deep learning model for the academic analysis?
**Answer**: In high-stakes educational decision making, explainability, determinism, and compliance with university academic regulations are critical. A deep learning black-box model can suffer from hallucination, training bias, and lack of justification when a student is denied an exam hall-ticket. Our system implements Multi-Criteria Decision Analysis (MCDA) and rule-based heuristics that provide exact mathematical breakdowns, ensuring transparent accountability for students, faculty mentors, and external auditors.

### Q2: How does the system handle network interruptions or database outages?
**Answer**: The backend attempts to connect to MySQL (`ats_database`). A retained legacy in-memory fallback supports limited UI demonstrations, but it is ephemeral, contains a small legacy sample, and is not equivalent to the 100-student SQL seed. `/api/health` reports MySQL as disconnected when the fallback is active. Use MySQL for persistent college-structure and synthetic academic records.

### Q3: How is student privacy and role authorization maintained?
**Answer**: The backend uses bcrypt password hashes and JWTs signed with a configured secret. The client stores the token in browser local storage and attaches it to request headers as `Authorization: Bearer <token>`. Role checks protect administrative and faculty actions, and student data reads are scoped to the authenticated student.

### Q4: How does the AI chatbot answer questions about the student's records?
**Answer**: When the user posts a message to `/api/chatbot/message`, the controller queries the student's real-time marks, subject attendance records, and verified achievements from the database. The NLP engine detects intents (e.g., weak subjects, attendance safety, study planning, GPA improvement) and injects actual data values into the contextual response.
