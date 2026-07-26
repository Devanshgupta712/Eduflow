import sqlite3

conn = sqlite3.connect("backend/apptech_lms.db")
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(users)")
cols = cursor.fetchall()
print("users columns:", [c[1] for c in cols])
cursor.execute("SELECT * FROM users")
print("users rows:", cursor.fetchall())
conn.close()
