import sqlite3
import os
import glob

db_files = glob.glob("**/*.db", recursive=True)
print("Found DB files:", db_files)

for db_file in db_files:
    print(f"\n--- Checking {db_file} ---")
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall() if not row[0].startswith("sqlite_")]
        for t in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {t}")
            cnt = cursor.fetchone()[0]
            if cnt > 0:
                print(f"  Table '{t}': {cnt} rows")
        conn.close()
    except Exception as e:
        print(f"  Error reading {db_file}: {e}")
