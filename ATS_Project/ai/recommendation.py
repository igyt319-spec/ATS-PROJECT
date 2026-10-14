"""
Academic Tracking System (ATS) - AI Recommendation Engine
=========================================================
Generates prioritized, contextual, and actionable recommendations based on
weakness diagnostics, attendance compliance, and career milestones.
"""

import sys
import json

def generate_recommendations(student_data):
    marks = student_data.get("marks", [])
    attendance = student_data.get("attendance", [])
    achievements = student_data.get("achievements", [])

    results = []

    # 1. Attendance checks
    for att in attendance:
        pct = float(att.get("percentage", 0))
        name = att.get("subject_name", att.get("name", "Subject"))
        if pct < 75.0:
            results.append({
                "priority": "HIGH",
                "title": f"Critical Attendance Alert in {name}",
                "reason": f"Your current attendance in {name} is {pct}%, falling short of the required 75%.",
                "recommendation": f"Attend the next 5 consecutive classes without fail to prevent exam hall-ticket detention.",
                "category": "Attendance"
            })
        elif pct < 80.0:
            results.append({
                "priority": "MEDIUM",
                "title": f"Monitor Attendance in {name}",
                "reason": f"Attendance is currently {pct}%, which is close to the threshold boundary.",
                "recommendation": "Avoid discretionary leaves in upcoming practical and theory sessions.",
                "category": "Attendance"
            })

    # 2. Academic subject marks checks
    for m in marks:
        name = m.get("subject_name", m.get("name", "Subject"))
        tot = float(m.get("total_marks", 0))
        if tot < 60:
            results.append({
                "priority": "HIGH",
                "title": f"Urgent Revision Needed for {name}",
                "reason": f"Scored {tot}/100, which is in the Weak bracket (<60%).",
                "recommendation": f"Dedicate 45 minutes daily to solving textbook problem sets and request faculty clarification.",
                "category": "Academic"
            })
        elif tot < 75:
            results.append({
                "priority": "MEDIUM",
                "title": f"Boost Scoring Potential in {name}",
                "reason": f"Current performance is {tot}/100. Improving this subject can elevate your semester CGPA above 8.5.",
                "recommendation": "Focus on high-weightage topics and past semester model exam papers.",
                "category": "Academic"
            })

    # 3. Extracurricular & Skill Development checks
    cats = {a.get("category") for a in achievements}
    if "Certification" not in cats:
        results.append({
            "priority": "MEDIUM",
            "title": "Earn an Industry Recognized Certification",
            "reason": "Technical certifications provide a 10% boost to your holistic ATS academic score and resume visibility.",
            "recommendation": "Enroll in an accredited Cloud (AWS/Azure) or AI certification program.",
            "category": "Career"
        })
    elif "Hackathon" not in cats:
        results.append({
            "priority": "LOW",
            "title": "Participate in an Inter-College Hackathon",
            "reason": "Collaborative hackathons showcase applied problem-solving and rapid prototyping skills.",
            "recommendation": "Form a 4-person team and register for upcoming college hackathons.",
            "category": "Competition"
        })
    else:
        results.append({
            "priority": "LOW",
            "title": "Publish or Present a Research Paper",
            "reason": "Strong academic score enables high potential for undergraduate research publications.",
            "recommendation": "Draft an IEEE or Scopus conference manuscript under your department mentor.",
            "category": "Research"
        })

    # Sort: HIGH first, then MEDIUM, then LOW
    priority_order = {"HIGH": 1, "MEDIUM": 2, "LOW": 3}
    results.sort(key=lambda x: priority_order.get(x["priority"], 4))

    return {
        "success": True,
        "count": len(results),
        "recommendations": results
    }

def main():
    try:
        raw = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
        data = json.loads(raw)
        print(json.dumps(generate_recommendations(data), indent=2))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
