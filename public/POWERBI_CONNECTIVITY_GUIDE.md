# 📊 How to Connect Power BI to the LMS Database

> **Target Audience:** Data Analytics & BI Students / Instructors  
> **Scope:** Connecting Microsoft Power BI Desktop to the AppTechno LMS Database for Dashboard Creation & Business Intelligence.

---

## ⚡ Quick Start: 3 Ways to Connect Power BI

Depending on your classroom environment, you can connect Power BI using any of the 3 methods below:

| Method | Setup Time | Best For | Connection Type |
| :--- | :--- | :--- | :--- |
| **Method 1: One-Click Folder CSV Import** | 1 Minute | Immediate Student Labs & Practice | Instant Local Data |
| **Method 2: ODBC Driver to SQLite (`.db`)** | 5 Minutes | Live Local Database Querying | Direct Local Connection |
| **Method 3: PostgreSQL Cloud DB Connection** | 3 Minutes | Production & Staging Analytics | Cloud DirectQuery / Import |

---

## 🟢 METHOD 1: One-Click CSV Folder Import (Recommended for Students)

We have provided an automated script `export_tables_for_powerbi.py` in your project folder that exports all database tables into `.csv` files inside the `powerbi_data/` folder.

### Step-by-Step Instructions:

1. **Export Latest Data:**
   Open terminal in project root and run:
   ```bash
   python export_tables_for_powerbi.py
   ```
   *This creates/updates 37 CSV files in `powerbi_data/`.*

2. **Open Power BI Desktop:**
   * Launch **Power BI Desktop**.
   * Click **Get Data** (Home Tab) $\rightarrow$ Select **Folder** $\rightarrow$ Click **Connect**.

3. **Select `powerbi_data` Folder:**
   * Browse and select the project folder path:
     `C:\Users\devan\OneDrive\Desktop\lmsproject\powerbi_data`
   * Click **OK**.

4. **Combine & Load:**
   * Click **Combine** $\rightarrow$ **Combine & Load**.
   * Power BI will automatically import all 37 tables (`users`, `batches`, `attendance`, `registrations`, `leads`, `tasks`, etc.) with headers!

---

## 🟡 METHOD 2: Direct Connection via SQLite ODBC Driver (Live Local DB)

If you want Power BI to connect directly to the live `backend/apptech_lms.db` file:

### Step 1: Install SQLite ODBC Driver
1. Download the free 64-bit SQLite ODBC driver:  
   [Download SQLite ODBC 64-bit Driver](http://www.ch-werner.de/sqliteodbc/sqliteodbc_w64.exe)
2. Run installer with default settings.

### Step 2: Configure Windows ODBC Data Source
1. In Windows Search, type **ODBC Data Sources (64-bit)** and open it.
2. Under the **User DSN** tab, click **Add...**
3. Select **SQLite3 ODBC Driver** $\rightarrow$ Click **Finish**.
4. Set Configuration properties:
   * **Data Source Name (DSN):** `LMS_Database`
   * **Database Name:** Browse and select your local DB file:  
     `C:\Users\devan\OneDrive\Desktop\lmsproject\backend\apptech_lms.db`
5. Click **OK**.

### Step 3: Connect in Power BI
1. In Power BI Desktop, click **Get Data** $\rightarrow$ **More...** $\rightarrow$ search for **ODBC**.
2. Select **ODBC** $\rightarrow$ Click **Connect**.
3. In the DSN dropdown, choose **`LMS_Database`**.
4. Click **OK** $\rightarrow$ Select all LMS tables in Navigator $\rightarrow$ Click **Load**!

---

## 🔵 METHOD 3: Connecting to Production PostgreSQL / Cloud DB

When your LMS is deployed with PostgreSQL (e.g. Render, Supabase, AWS RDS, Neon):

1. In Power BI Desktop, click **Get Data** $\rightarrow$ **PostgreSQL database**.
2. Enter connection details:
   * **Server:** `your-db-host.render.com` (or IP address)
   * **Database:** `lms_db`
   * **Data Connectivity mode:** Choose **Import** or **DirectQuery**.
3. Enter credentials:
   * **Username** & **Password** from your production `.env` file.
4. Click **Connect** $\rightarrow$ Select your schemas & tables $\rightarrow$ Click **Load**.

---

## 📊 Suggested Power BI Dashboards for Students

Once data is loaded, students can build these 4 core dashboards:

1. 🎯 **Sales & Lead Conversion Dashboard:**  
   * Visuals: Funnel Chart (`leads.status`), Bar Chart (`source` vs LCR %), Card (`Total Leads`).
2. 💳 **Financial Revenue Realization Dashboard:**  
   * Visuals: Gauge (`feePaid` / `feeAmount`), Donut Chart (`registrations.status`), Table (Outstanding fee by batch).
3. 📈 **Student Attendance & Churn Risk Dashboard:**  
   * Visuals: Line Chart (`attendance.date` vs Present %), Matrix (Student vs Overdue Tasks).
4. 💼 **Placement & Job Funnel Dashboard:**  
   * Visuals: Bar Chart (`mock_interviews.score` vs Placement Rate), Funnel (`job_applications.status`).

---

> 💡 *All CSV files are ready in `powerbi_data/`. Open Power BI and start analyzing!*
