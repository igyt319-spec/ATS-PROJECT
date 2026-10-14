# AI-Based Academic Progress and Achievement Tracking System (ATS)

An enterprise-grade, modern, full-stack academic monitoring and achievement portfolio system developed as a College Semester Mini Project. The system integrates real-time continuous assessment analytics, compliance risk tracking, co-curricular achievement verification, explainable scoring heuristics, and a conversational AI academic assistant.

---

## 🌟 Key Highlights & Features

1. **Premium AI SaaS User Interface**:
   - Dark theme glassmorphism aesthetic with responsive sidebar, micro-animations, glowing accents, and Chart.js dynamic visualizations.
   - Separate, dedicated interfaces for **Students** and **Faculty / Administrators**.

2. **Multi-Role Authentication & Protected Routing**:
   - JWT-based authorization with bcrypt password hashing.
   - Role verification guards on all protected client routes and REST endpoints.
   - Quick one-click demo account auto-fill on the sign-in portal.

3. **Holistic Student Dashboard**:
   - 5 Real-Time KPI Cards: **GPA/CGPA**, **Attendance %**, **Verified Achievements**, **Composite Academic Score**, and **Academic Risk Level**.
   - 4 Dynamic Chart.js Analytics: Subject Performance Bar Chart, 5-Semester GPA Trajectory, Monthly Attendance vs 75% Risk Line, and Extracurricular Distribution.

4. **Continuous Assessment & Performance Tracking**:
   - Detailed course breakdown (Internal /20, Assignment /20, Exam /60, Total /100).
   - Dynamic classification: **Strong (80+)**, **Average (60-79)**, and **Weak (<60)**.
   - Admin marks recording and updating modal.

5. **Institutional Attendance Compliance & Shortage Calculator**:
   - Threshold monitoring: **Good (>=85%)**, **Monitor (75-84%)**, and **Risk (<75%)**.
   - Automatic critical alert banner whenever attendance breaches university examination eligibility.
   - Mathematical calculator showing exact number of upcoming consecutive lectures required to recover to the 85% safe zone.

6. **Verified Co-Curricular Achievement Portfolio**:
   - Categorized tracking: Hackathons, Paper Presentations, Industry Certifications, Technical Workshops, Sports, and Competitions.
   - Interactive category filtering pills and credential URL verification.

7. **Explainable AI Analytics & Heuristic Scoring Engine**:
   - Multi-Criteria Decision Analysis (MCDA) formula:
     $$\text{Academic Score} = (70\% \times \text{Marks}) + (20\% \times \text{Attendance}) + (10\% \times \text{Achievements})$$
   - Transparent, mathematical breakdown accessible via interactive explanation modal.
   - Zero fabricated or unverified "black-box" machine learning claims.

8. **Intelligent Academic Monitoring Agent**:
   - Autonomous heuristics scanning for downward grade trajectories, weak subject clusters, and co-curricular gaps.
   - Dispatches prioritized **HIGH**, **MEDIUM**, and **LOW** intervention alerts.

9. **Conversational AI Academic Assistant (Chatbot)**:
   - Queries student's real-time academic records (current marks, weak subjects, attendance percentage).
   - Generates contextual answers for GPA improvement plans, weak subject revision strategies, and personalized 7-day study timetables.
   - Instant suggested prompt chips and full chat history persistence.

10. **Faculty & Admin Console (`admin-dashboard.html` & `students.html`)**:
    - Class-wide averages, risk distribution graphs, and student directory with live search & multi-field filtering.
    - Full CRUD operations: Enroll new students, update profiles, remove records, and log semester marks.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3 (Glassmorphism & SaaS Design System), Vanilla JavaScript (ES6+), Chart.js |
| **Backend** | Node.js, Express.js REST API, cors, dotenv, bcryptjs, jsonwebtoken |
| **Database** | MySQL 8.x (`mysql2/promise` connection pooling) + Resilient In-Memory Fallback Store |
| **AI / Analytics** | Python 3.12 (Explainable Statistics & Multi-Criteria Decision Analysis), Rule-Based NLP Fallback |

---

## 📁 Project Structure

```
ATS_Project/
├── frontend/
│   ├── index.html              # Landing presentation page
│   ├── login.html              # Premium login interface with demo autofill
│   ├── dashboard.html          # Student dashboard with KPIs and 4 charts
│   ├── admin-dashboard.html    # Faculty admin console and risk matrix
│   ├── students.html           # Student directory & management CRUD
│   ├── performance.html        # Subject marks, grading, and breakdown table
│   ├── attendance.html         # Attendance tracking & shortage calculator
│   ├── achievements.html       # Verified co-curricular milestone cards
│   ├── recommendations.html    # AI study plans and agent scanner
│   ├── chatbot.html            # AI Academic Assistant chat interface
│   ├── notifications.html      # Inbox and alert dispatch center
│   ├── profile.html            # Scholar metadata & editable credentials
│   ├── style.css               # Cohesive dark SaaS glassmorphism styling
│   ├── api.js                  # Centralized client API helper & auth guards
│   ├── login.js                # Login authentication and validation logic
│   ├── dashboard.js            # Student dashboard Chart.js and KPI logic
│   ├── admin.js                # Admin dashboard metrics and risk matrix logic
│   ├── performance.js          # Marks calculations and chart rendering
│   ├── attendance.js           # Attendance tracking and progress bar logic
│   ├── achievements.js         # Achievement category filtering and logging
│   ├── recommendations.js      # AI recommendations controller
│   ├── chatbot.js              # Chatbot conversation stream and prompt chips
│   ├── notifications.js        # Notification inbox and unread badge sync
│   └── profile.js              # Profile editor and data persistence
│
├── backend/
│   ├── server.js               # Express application entry point & static server
│   ├── package.json            # Backend dependencies
│   ├── .env.example            # Environment configuration template
│   ├── .env                    # Active local environment variables
│   ├── config/
│   │   └── db.js               # MySQL pool & dual-mode resilient storage adapter
│   ├── middleware/
│   │   └── authMiddleware.js   # JWT verification & role authorization guards
│   ├── routes/                 # Express REST API routes
│   │   ├── authRoutes.js
│   │   ├── studentRoutes.js
│   │   ├── performanceRoutes.js
│   │   ├── attendanceRoutes.js
│   │   ├── achievementRoutes.js
│   │   ├── recommendationRoutes.js
│   │   ├── notificationRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── chatbotRoutes.js
│   │   └── aiRoutes.js
│   └── controllers/            # Modular business logic controllers
│       ├── authController.js
│       ├── studentController.js
│       ├── performanceController.js
│       ├── attendanceController.js
│       ├── achievementController.js
│       ├── recommendationController.js
│       ├── notificationController.js
│       ├── dashboardController.js
│       ├── chatbotController.js
│       └── aiController.js
│
├── database/
│   ├── schema.sql              # Normalized MySQL relational schema
│   ├── college_data.sql        # Public college structure and synthetic catalogue
│   ├── seed_data.sql           # 100 synthetic student academic records
│   └── generate_seed.js        # Rebuild deterministic demo seed data
│
├── ai/
│   ├── analysis.py             # Statistical regression and MCDA scoring
│   ├── recommendation.py       # Contextual priority recommendation generator
│   └── requirements.txt        # Optional AI runtime dependencies
│
├── agent/
│   └── academic_agent.py       # Autonomous academic monitoring agent
│
├── docs/
│   ├── architecture.md         # Mermaid system diagrams and sequence flows
│   └── project_notes.md        # Mathematical formulas and viva defense guide
│
├── package.json                # Project root runner
├── .gitignore                  # Git ignore specification
└── README.md                   # Comprehensive documentation
```

---

## 🚀 Setup & Execution Guide

### Prerequisites
- **Node.js**: v18 or later (v24.x LTS tested)
- **Python**: v3.10 or later (v3.12 tested)
- **MySQL** (Optional for local testing; built-in dual adapter operates out-of-the-box!)

### 1. Configure Environment Variables
Verify `.env` in `ATS_Project/backend/.env`:
```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=ats_database

JWT_SECRET=ats_super_secret_jwt_key_2026_demo
PYTHON_PATH=python
GEMINI_API_KEY=
```

### 2. Database Setup (MySQL)
Import from `ATS_Project` in Windows `cmd.exe`:
```cmd
mysql -u root -p < database\schema.sql
mysql -u root -p ats_database < database\college_data.sql
mysql -u root -p ats_database < database\seed_data.sql
```
All student, faculty, marks, attendance, achievement, and certification records are synthetic demonstration data. BIT department names and listed programs come from public official pages; all course catalogue rows are synthetic examples, not official syllabi. No private student data or college database is accessed. When MySQL is unavailable, the retained legacy in-memory fallback is ephemeral and the health endpoint reports MySQL as disconnected; use MySQL for the 100-student relational dataset.

### 3. Install Dependencies
From `ATS_Project/` (or `ATS_Project/backend/`):
```bash
npm install
```

### 4. Run the Application
Start the server using either:
```bash
npm start
```
or for development:
```bash
npm run dev
```

### 5. Access the Portal
Open your web browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 Demo Credentials

| Role | Identifier / Email | Password | Intended Landing Page |
|---|---|---|---|
| **Synthetic Student Demo** | `BITD0001` | `student123` | `dashboard.html` |
| **Synthetic Faculty** | `FAC-CSE` | `faculty123` | `admin-dashboard.html` |
| **Admin** | `admin@ats.com` | `admin123` | `admin-dashboard.html` |

*Tip: Click the quick demo autofill chips on the login page to sign in with one click.*

---

## 📡 REST API Reference

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/auth/login` | Authenticate user & issue JWT | Public |
| `POST` | `/api/auth/logout` | Invalidate user session | Public |
| `GET` | `/api/auth/me` | Fetch authenticated profile | Token Required |
| `POST` | `/api/auth/forgot-password`| Submit password reset request | Public |
| `GET` | `/api/dashboard/:studentId` | Full student dashboard KPI & chart payload | Token Required |
| `GET` | `/api/dashboard/admin/summary`| Department statistics & risk matrix | Admin Only |
| `GET` | `/api/students` | List all students with search & filters | Token Required |
| `GET` | `/api/students/:id` | Student detailed academic profile | Token Required |
| `POST` | `/api/students` | Enroll new student | Admin Only |
| `PUT` | `/api/students/:id` | Update student profile metadata | Token Required |
| `DELETE`| `/api/students/:id` | Remove student record | Admin Only |
| `GET` | `/api/performance/:studentId`| Course marks & grades | Token Required |
| `POST` | `/api/performance` | Add/update semester marks | Admin Only |
| `GET` | `/api/attendance/:studentId` | Attendance records & shortage deficit | Token Required |
| `POST` | `/api/attendance` | Log subject attendance | Admin Only |
| `GET` | `/api/achievements/:studentId`| Verified co-curricular milestones | Token Required |
| `POST` | `/api/achievements` | Log new student achievement | Token Required |
| `GET` | `/api/recommendations/:studentId`| Active prioritized AI recommendations | Token Required |
| `PUT` | `/api/recommendations/:id` | Mark recommendation as completed | Token Required |
| `GET` | `/api/notifications/:studentId`| Notification alerts stream | Token Required |
| `PUT` | `/api/notifications/:id/read` | Mark individual notification as read | Token Required |
| `POST` | `/api/chatbot/message` | Send query to AI Academic Assistant | Token Required |
| `DELETE`| `/api/chatbot/history/:studentId`| Clear conversation history | Token Required |
| `GET` | `/api/ai/analysis/:studentId` | Run explainable statistical analysis | Token Required |
| `POST` | `/api/ai/run-agent` | Execute Autonomous Academic Monitoring Agent | Token Required |
| `GET` | `/api/health` | System & database connectivity check | Public |

---

## 🎓 Viva Voce Demonstration Points

1. **Explainable Intelligence**:
   Explain that the composite Academic Score is derived transparently (70% marks, 20% attendance, 10% achievements) rather than through an opaque black-box neural network, aligning with strict educational accountability standards.
2. **Attendance Monitoring**:
   Attendance uses configurable ATS thresholds: GOOD at 85%+, MONITOR at 75–84.99%, and RISK below 75%.
3. **Contextual Chatbot**:
   Ask *"What are my weak subjects?"* and verify the answer against the logged-in student's synthetic database records.
4. **Database Status**:
   Check `/api/health`; it reports MySQL status separately from the legacy offline fallback.

## College Structure and Synthetic Records

BIT's 25 publicly listed departments are loaded from the [official departments page](https://www.bitsathy.ac.in/department/). The listed program names and awards are based on BIT's [official programs page](https://www.bitsathy.ac.in/programmes-offered/): 10 undergraduate programs and four postgraduate/MBA programs. The database contains 24 clearly synthetic example subjects per department (600 catalogue rows), academic years 2023–2024 to 2026–2027, and eight semesters. The course catalogue is not claimed to match BIT syllabi.

`database/seed_data.sql` contains 100 synthetic students (`BITD0001`–`BITD0100`), seven synthetic faculty logins, enrollments, multiple-semester marks and attendance, and synthetic achievement/certification records; synthetic email addresses use `example.test`. Student accounts use `student123`, faculty accounts use `faculty123`, and the admin account is `admin@ats.com` / `admin123`. SQL stores bcrypt hashes. Dashboard GPA, attendance, academic score, and risk are calculated from saved marks and attendance.

Existing endpoints remain available, with `/api/departments` and `/api/subjects` added. Student academic records require a bearer token and enforce ownership; admin writes require an admin/faculty token.

### Run the application

Configure `backend/.env` using `backend/.env.example`, set MySQL credentials and a random `JWT_SECRET` (at least 32 characters), then from `ATS_Project` run `npm install` and `npm start`. Open [http://localhost:3000](http://localhost:3000); database status is at [http://localhost:3000/api/health](http://localhost:3000/api/health).
