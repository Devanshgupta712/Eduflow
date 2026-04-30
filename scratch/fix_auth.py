
import os
path = 'backend/app/routers/auth.py'
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    # Fix attendance scan
    content = content.replace('"student_id": user.student_id or user.id,', '"user_id": user.id,')
    # Fix registration
    content = content.replace('student_id=student_id,', '# student_id=student_id,')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS")
else:
    print("FILE NOT FOUND")
