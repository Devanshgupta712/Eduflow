
import os
path = 'backend/app/routers/auth.py'
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    # Find the specific occurrences and replace them
    new_content = content.replace('"user_id": user.id,', '"student_id": user.student_id or user.id,')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("SUCCESS")
else:
    print("FILE NOT FOUND")
