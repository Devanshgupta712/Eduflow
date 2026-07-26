import sqlite3
import os

db_path = os.path.join("backend", "apptech_lms.db")
if not os.path.exists(db_path):
    print("Database file not found.")
    exit()

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [row[0] for row in cursor.fetchall() if not row[0].startswith("sqlite_")]

print(f"=== DB Inspection: {db_path} ===")
for table in tables:
    cursor.execute(f"SELECT COUNT(*) FROM {table}")
    count = cursor.fetchone()[0]
    print(f"Table '{table}': {count} rows")
    if table == "users":
        cursor.execute("SELECT id, email, role, created_at FROM users" if "created_at" in [c[1] for c in cursor.execute("PRAGMA table_info(users)").fetchall()] else "SELECT id, email, role FROM users")
        users = cursor.fetchall()
        for u in users:
            print(f"   User -> {u}")

conn.close()
