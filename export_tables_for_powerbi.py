import sqlite3
import pandas as pd
import os

def export_lms_db_to_csv(db_path, output_dir="powerbi_data"):
    if not os.path.exists(db_path):
        print(f"Error: Database file not found at '{db_path}'")
        return
    
    os.makedirs(output_dir, exist_ok=True)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Fetch all table names
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall() if not row[0].startswith("sqlite_")]
    
    print(f"Found {len(tables)} tables in '{db_path}'. Exporting to '{output_dir}/'...")
    
    exported_count = 0
    for table in tables:
        df = pd.read_sql_query(f"SELECT * FROM {table}", conn)
        csv_file = os.path.join(output_dir, f"{table}.csv")
        df.to_csv(csv_file, index=False)
        print(f"  [OK] Exported: {table}.csv ({len(df)} rows)")
        exported_count += 1
        
    conn.close()
    print(f"\nSuccessfully exported all {exported_count} tables for Power BI into '{output_dir}/'!")

if __name__ == "__main__":
    db_file = os.path.join("backend", "apptech_lms.db")
    export_lms_db_to_csv(db_file)
