# ⚡ Connecting Power BI to Neon DB for LIVE Real-Time Dashboards

> **Target Audience:** Data Analytics & BI Students / Instructors  
> **Goal:** Connect Power BI Desktop to a Cloud **Neon PostgreSQL Database** using **DirectQuery** mode to display real-time, live-updating dashboards.

---

## 🔑 1. Extracting Your Connection Credentials from Neon DB

Your Neon DB connection string looks like this:
```
postgresql://<USER>:<PASSWORD>@<HOST>/<DATABASE>?sslmode=require
```

### Example Breakdown:
* Connection URL: `postgresql://alex:Abc123Xyz@ep-cool-flower-123456.us-east-2.aws.neon.tech/neondb?sslmode=require`

| Field | Value for Power BI | Description |
| :--- | :--- | :--- |
| **Server / Host** | `ep-cool-flower-123456.us-east-2.aws.neon.tech` | Neon Host URL (omit `postgresql://` and trailing path) |
| **Database** | `neondb` | Your Neon Database Name |
| **User Name** | `alex` | Your Neon DB User |
| **Password** | `Abc123Xyz` | Your Neon DB Password |

---

## 🚀 2. Step-by-Step Instructions for Students in Power BI Desktop

### Step 1: Open PostgreSQL Connector
1. Launch **Power BI Desktop**.
2. On the **Home** tab ribbon, click **Get Data** $\rightarrow$ **More...**
3. Search for **PostgreSQL database** $\rightarrow$ Click **Connect**.

---

### Step 2: Configure DirectQuery Mode for LIVE Data Updates
In the PostgreSQL connection dialog:
1. **Server:** Paste your Neon Hostname (e.g. `ep-cool-flower-123456.us-east-2.aws.neon.tech`)
2. **Database:** Type your Database name (e.g. `neondb`)
3. **Data Connectivity mode:** Select **⚡ DirectQuery**
   > ⚠️ **CRITICAL:** Selecting **DirectQuery** ensures that Power BI queries Neon DB live every time a user views or interacts with a visual. New leads, attendance logins, or fee payments appear **instantly**!
4. Click **OK**.

---

### Step 3: Enter Credentials
1. In the left sidebar of the authentication window, click **Database**.
2. Enter:
   * **User name:** *(Your Neon Username)*
   * **Password:** *(Your Neon Password)*
3. Click **Connect**.

---

### Step 4: Select Tables & Build Live Visuals
1. In the **Navigator** popup window, check the boxes for your LMS tables:
   * `users`
   * `batches`
   * `registrations`
   * `attendance`
   * `leads`
   * `lead_activities`
   * `tasks`
   * `job_applications`
2. Click **Load**.

---

## ⏱️ 3. Setting Up Auto-Page Refresh for Live Dashboard Displays

To make student dashboards refresh automatically on screen when new data arrives:

1. Click on any blank area of your Power BI canvas.
2. In the **Visualizations** pane on the right, click the **Format Page** (Paint Roller / Canvas Settings) icon.
3. Scroll down and turn ON **Page Refresh**.
4. Set:
   * **Refresh Type:** Auto Page Refresh
   * **Duration:** Every `5` or `10` seconds.
5. Now, whenever someone punches attendance, registers, or updates a lead, the visual updates **live** on screen!

---

## 🔒 4. Best Practice for Instructors: Create a Student Read-Only Role in Neon DB

To prevent students from accidentally altering or deleting database records, create a **Read-Only SQL Role** in your Neon DB SQL Editor:

```sql
-- 1. Create a dedicated student analyst user
CREATE ROLE student_analyst WITH LOGIN PASSWORD 'StudentLive2026!';

-- 2. Grant connection rights
GRANT CONNECT ON DATABASE neondb TO student_analyst;

-- 3. Grant schema usage rights
GRANT USAGE ON SCHEMA public TO student_analyst;

-- 4. Grant SELECT-ONLY privileges on all current and future tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO student_analyst;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO student_analyst;
```

> 💡 *Share the `student_analyst` username and password with students. They will have 100% live read access to build dashboards safely!*

---

## 💡 Troubleshooting Common Issues

* **Error: "Npgsql connector is missing"**
  * Download and install the Npgsql PostgreSQL provider v4.0.x for Windows if Power BI prompts for it.
* **Error: "SSL connection failed"**
  * Neon requires SSL. Power BI automatically negotiates SSL over port 5432. Ensure your network allows outbound traffic on TCP port `5432`.

---
> 🎉 *Your students can now build live-updating Power BI dashboards directly backed by your Neon Cloud PostgreSQL Database!*
