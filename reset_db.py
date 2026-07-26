import sqlite3
import os
import uuid
import datetime
import bcrypt

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

db_path = os.path.join("backend", "apptech_lms.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Disable FK
cursor.execute("PRAGMA foreign_keys = OFF;")

# Fetch all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [row[0] for row in cursor.fetchall() if not row[0].startswith("sqlite_")]

for table in tables:
    cursor.execute(f"DELETE FROM {table};")
    print(f"  [OK] Cleared table '{table}'")

# Insert Super Admin
now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
super_id = str(uuid.uuid4())
pwd_hash = get_password_hash("admin123")

cursor.execute("""
    INSERT INTO users (id, email, password, name, phone, role, isActive, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 'SUPER_ADMIN', 1, ?, ?);
""", (super_id, "admin@apptech.com", pwd_hash, "Super Admin", "9000000001", now_str, now_str))

print("\n  [OK] Inserted Super Admin user:")
print("       Email: admin@apptech.com")
print("       Password: admin123")
print("       Role: SUPER_ADMIN")

cursor.execute("PRAGMA foreign_keys = ON;")
conn.commit()
conn.close()

print("\n[SUCCESS] Database reset complete! All courses, batches, leads, registrations, and test users removed. Only SUPER_ADMIN retained.")
