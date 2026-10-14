"""
Academic Tracking System (ATS) - Intelligent Academic Monitoring Agent
====================================================================
Role: Autonomous heuristic diagnostic agent that continuously scans student
      academic profiles to proactively flag risks, detect downward trends,
      and dispatch prioritized actionable intervention alerts.
"""

import sys
import json
from datetime import datetime

class AcademicMonitoringAgent:
    def __init__(self, student_profile):
        self.profile = student_profile
        self.student_name = student_profile.get("name", "Student")
        self.register_number = student_profile.get("register_number", "N/A")
        self.all_marks = student_profile.get("marks", [])
        self.current_semester = int(student_profile.get("current_semester_number", 0) or 0)
        self.marks = [m for m in self.all_marks if int(m.get("semester_number") or 0) == self.current_semester] if self.current_semester else self.all_marks
        self.attendance = student_profile.get("attendance", [])
        self.achievements = student_profile.get("achievements", [])
        self.alerts = []

    def evaluate_attendance(self):
        """Monitors attendance compliance against university regulations."""
        for record in self.attendance:
            pct = float(record.get("percentage", 0))
            subject = record.get("subject_name", record.get("name", "Subject"))
            total = int(record.get("total_classes", 0))
            attended = int(record.get("attended_classes", 0))

            if pct < 75.0:
                shortage = max(1, math_shortage(total, attended, 75))
                self.alerts.append({
                    "priority": "HIGH",
                    "type": "ATTENDANCE_CRITICAL",
                    "title": f"Attendance Below Mandatory 75% in {subject}",
                    "alert": f"Attendance is currently at {pct}%, below the ATS configured 75% risk threshold.",
                    "recommendation": f"Must attend the next {shortage} consecutive classes to cross the 75% eligibility mark.",
                    "explainable_reason": f"Observed {attended}/{total} classes attended; configured threshold is 75%."
                })
            elif pct < 80.0:
                self.alerts.append({
                    "priority": "MEDIUM",
                    "type": "ATTENDANCE_WARNING",
                    "title": f"Borderline Attendance in {subject}",
                    "alert": f"Attendance is {pct}%, within the ATS configured 75-84% monitor band.",
                    "recommendation": "Maintain strict attendance in forthcoming theory hours and lab modules.",
                    "explainable_reason": f"Only a {round(pct - 75, 1)}% safety buffer remains before falling into detention zone."
                })

    def evaluate_performance(self):
        """Detects low marks, weak subjects, and internal exam shortfalls."""
        for m in self.marks:
            subject = m.get("subject_name", m.get("name", "Subject"))
            tot = float(m.get("total_marks", 0))
            internal = float(m.get("internal_marks", 0))
            exam = float(m.get("exam_marks", 0))

            if tot < 60.0 or m.get("status") == "Weak":
                self.alerts.append({
                    "priority": "HIGH" if tot < 50 else "MEDIUM",
                    "type": "ACADEMIC_DEFICIT",
                    "title": f"Performance Shortfall Detected in {subject}",
                    "alert": f"Scored {tot}/100 in {subject} (Classification: Weak).",
                    "recommendation": f"Enroll in the weekly departmental tutorial sessions and request revision problem sheets.",
                    "explainable_reason": f"Internal score ({internal}/20) or Exam aggregate ({exam}/60) is below standard pass/average distribution."
                })

        by_subject = {}
        for record in self.all_marks:
            by_subject.setdefault(record.get("subject_name", "Subject"), []).append(record)
        for subject, records in by_subject.items():
            records.sort(key=lambda r: int(r.get("semester_number") or 0))
            if len(records) > 1:
                previous = float(records[-2].get("total_marks", 0))
                latest = float(records[-1].get("total_marks", 0))
                if latest < previous:
                    self.alerts.append({
                        "priority": "MEDIUM", "type": "FALLING_TREND",
                        "title": f"Falling performance trend in {subject}",
                        "alert": f"Score changed from {previous:g} to {latest:g} in the most recent recorded semesters.",
                        "recommendation": "Review feedback and agree on a practice plan with subject faculty.",
                        "explainable_reason": "Compared stored subject totals in ascending semester order."
                    })

        semester_scores = {}
        for record in self.all_marks:
            semester = int(record.get("semester_number") or 0)
            credits = float(record.get("credits") or 1)
            points = float(record.get("grade_point") or 0) * credits
            bucket = semester_scores.setdefault(semester, {"points": 0.0, "credits": 0.0})
            bucket["points"] += points
            bucket["credits"] += credits
        ordered = [(n, v["points"] / v["credits"]) for n, v in sorted(semester_scores.items()) if v["credits"]]
        if len(ordered) > 1 and ordered[-1][1] < ordered[-2][1]:
            self.alerts.append({
                "priority": "MEDIUM", "type": "FALLING_SEMESTER_TREND",
                "title": "Recent semester performance trend has declined",
                "alert": f"Credit-weighted semester GPA declined from {ordered[-2][1]:.2f} to {ordered[-1][1]:.2f}.",
                "recommendation": "Review the latest marks with an academic advisor and plan focused support.",
                "explainable_reason": "Compared grade-point averages calculated from stored semester marks and subject credits."
            })

    def evaluate_achievement_gaps(self):
        """Scans co-curricular portfolio for holistic graduate attributes."""
        categories = {a.get("category") for a in self.achievements}
        total_achievements = len(self.achievements)

        if total_achievements == 0:
            self.alerts.append({
                "priority": "MEDIUM",
                "type": "PORTFOLIO_EMPTY",
                "title": "No Co-Curricular Achievements Recorded",
                "alert": "Your profile lacks documented certifications, workshops, or competitions.",
                "recommendation": "Participate in an upcoming departmental seminar or enroll in an online technical course.",
                "explainable_reason": "Academic Score formula dedicates 10% weight to verified extracurricular achievements."
            })
        elif "Certification" not in categories:
            self.alerts.append({
                "priority": "LOW",
                "type": "CERTIFICATION_GAP",
                "title": "Industry Certification Opportunity",
                "alert": "No verified industry technical certifications detected in your profile.",
                "recommendation": "Consider acquiring an entry-level professional credential (e.g. AWS Cloud Practitioner, Python Institute).",
                "explainable_reason": "Improves competitive edge for campus placement interviews and reinforces theoretical coursework."
            })

    def run_agent_diagnostics(self):
        self.evaluate_attendance()
        self.evaluate_performance()
        self.evaluate_achievement_gaps()

        # Sort alerts by priority
        p_map = {"HIGH": 1, "MEDIUM": 2, "LOW": 3}
        self.alerts.sort(key=lambda x: p_map.get(x["priority"], 4))

        return {
            "agent_name": "ATS Intelligent Academic Monitoring Agent v2.4",
            "execution_timestamp": datetime.now().isoformat(),
            "target_student": {
                "name": self.student_name,
                "register_number": self.register_number
            },
            "alerts_generated": len(self.alerts),
            "alerts": self.alerts,
            "overall_status": "Intervention Needed" if any(a["priority"] == "HIGH" for a in self.alerts) else "Stable Monitoring"
        }

def math_shortage(total, attended, target_pct=75):
    # (attended + x) / (total + x) >= target_pct / 100
    target = target_pct / 100.0
    denom = 1 - target
    if denom <= 0: return 0
    needed = (target * total - attended) / denom
    return int(needed) + 1 if needed > 0 else 0

def main():
    try:
        raw = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
        data = json.loads(raw)
        agent = AcademicMonitoringAgent(data)
        report = agent.run_agent_diagnostics()
        print(json.dumps(report, indent=2))
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "alerts": []
        }))

if __name__ == "__main__":
    main()
