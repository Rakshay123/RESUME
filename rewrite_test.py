import re
text = '''RAKSHA R NADIG
+91-6362928963 | raksharnadig27@gmail.com | https://www.linkedin.com/in/raksha-nadig-rnr/ | https://github.com/raksharnadig

SUMMARY
Computer Science undergraduate who is curious and eager to learn new technologies, with a strong interest in web development. Open to learn and improve skills through hands-on experience. A responsible and dedicated student who follows through and completes task effectively.
TECHNICAL SKILLS
Languages: C++, C, Python (basics)
Frontend: HTML, CSS Database: Mysql (basics) ACADEMIC PROJECTS
Integrated Emergency alert and Healthcare System
Tech Stack: HTML, CSS, JS, Python(Django),Google Maps API
●\tDesigned a system that alerts nearest ambulance using real time GPS location.
●\tDeveloped a user-friendly interface to simplify emergency reporting.
●\tImproved emergency response time through real time alert notification.

Interactive and Face Tracking Robot (DESKBOT)
Tech Stack: Python, PyCharm, OpenCV, Arduino Uno, Sensor Shield, Servo Motors.
●\tDeveloped robot capable of voice interaction using speech-to-text and text-to-speech modules.
●\tImplemented real-time face detection and head tracking using OpenCV.
●\tEnhanced robot interaction using voice recognition and gesture control.

EDUCATION
B.E in Computer Science & Engineering Jyothy Institute of Technology – VTU, Bangalore CGPA: 8.4/10 | Expected Graduation: June 2027
Class XII (PUC)
RNS PU College, Bangalore PERCENTAGE: 94.83 |Year:2023
Class X (SSLC)
Heritage Public School, Bangalore PERCENTAGE: 87.04 | Year:2021
ACHIEVEMENTS
•\tAwarded scholarship for academic excellence for two consecutive academic years.
•\tParticipated in ELEVATE program for student skill development.
•\tParticipated in Women’s Optive Hackathon
•\tVolunteered and took part in CSI Project Exhibition
'''

def rewrite_text(resumeText):
    lines = [l for l in re.split(r"[\r\n]+", resumeText) if l.strip()]
    rewritten_lines = []
    for line in lines:
        hasBullet = bool(re.match(r'^[-*\u2022]\s*', line))
        trimmed = re.sub(r'^[-*\u2022]\s*', '', line)
        isHeader = trimmed.strip() and trimmed == trimmed.upper() and re.search(r'[A-Z]', trimmed)
        if isHeader:
            if rewritten_lines and rewritten_lines[-1] != "":
                rewritten_lines.append("")
            rewritten_lines.append(trimmed)
            rewritten_lines.append("")
            continue
        if re.search(r"\d{4}", trimmed):
            if hasBullet: trimmed = "• " + trimmed
            rewritten_lines.append(trimmed)
            continue
        trimmed = trimmed[0].upper() + trimmed[1:] if trimmed else trimmed
        if hasBullet: trimmed = "• " + trimmed
        rewritten_lines.append(trimmed)
    return "\n".join(rewritten_lines) + "\n\n[AI‑Enhanced resume: headers separated and bullets normalized.]"

print(rewrite_text(text))
