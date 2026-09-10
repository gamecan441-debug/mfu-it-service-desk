# ระบบแจ้งและติดตามปัญหาด้านเทคโนโลยีสารสนเทศ มหาวิทยาลัยแม่ฟ้าหลวง
## University IT Service Request & Issue Tracking Prototype

ระบบต้นแบบ (Prototype) สำหรับแจ้งและติดตามปัญหาด้านเทคโนโลยีสารสนเทศของมหาวิทยาลัย ออกแบบและพัฒนาขึ้นเพื่อรองรับกระบวนการทำงานร่วมกันระหว่าง **ผู้แจ้งปัญหา (นักศึกษา/อาจารย์/บุคลากร)**, **เจ้าหน้าที่ดำเนินงาน (IT Staff)**, และ **หัวหน้าผู้มอบหมายงาน (Supervisor)** พร้อมระบบยืนยันตัวตน (Authentication & Login) และหน้าจอการใช้งานที่เรียบง่าย ไม่ซับซ้อน

---

## 1. ภาพรวมระบบและข้อกำหนด (System Overview & Requirements)

### 👥 1.1 กลุ่มผู้ใช้งานหลัก 3 กลุ่ม (Actors)
1. **กลุ่ม 1 ผู้แจ้งปัญหา (Requester)**: นักศึกษา อาจารย์ หรือบุคลากร ที่ประสบปัญหาด้านไอที สามารถสร้างคำร้อง ตรวจสอบสถานะ และยกเลิกคำร้องของตนเองได้
2. **กลุ่ม 2 เจ้าหน้าที่ดำเนินงาน (IT Staff / Technician)**: เจ้าหน้าที่ผู้รับผิดชอบการแก้ไขปัญหา ดูคิวงานที่ได้รับมอบหมาย เปลี่ยนสถานะการดำเนินงาน และบันทึกหมายเหตุการทำงาน (Work Notes / Resolution Notes)
3. **กลุ่ม 3 หัวหน้าผู้มอบหมายงาน (Supervisor / IT Manager)**: ดูภาพรวมคำร้องทั้งหมด มอบหมายงาน (Assign) ให้แก่เจ้าหน้าที่ ติดตามประวัติ และวิเคราะห์ภาระงานเจ้าหน้าที่ (Workload Ranking)

### 🔄 1.2 วงจรชีวิตของสถานะคำร้อง 6 สถานะ (Status Lifecycle)
- `NEW`: คำร้องสร้างใหม่ รอหัวหน้างานมอบหมาย
- `ASSIGNED`: มอบหมายเจ้าหน้าที่ผู้รับผิดชอบแล้ว
- `IN_PROGRESS`: เจ้าหน้าที่เริ่มดำเนินการตรวจสอบ/ซ่อมแซม
- `RESOLVED`: ปัญหาได้รับการแก้ไขเรียบร้อยแล้ว (ระบุวิธีแก้)
- `CLOSED`: คำร้องถูกตรวจสอบและปิดงานสมบูรณ์ (Terminal State)
- `CANCELLED`: คำร้องถูกยกเลิกโดยผู้แจ้ง (Terminal State)

### 📋 1.3 ความต้องการทางธุรกิจและฟังก์ชันที่พัฒนา (Business Requirements Implemented)
1. **ระบบ Login เข้าใช้งานจริงตามมาตรฐานความปลอดภัย (Security & Authentication)**: ตรวจสอบ Username / Password ด้วยการเข้ารหัส **Salted PBKDF2 (SHA-256)**, ป้องกัน Brute Force ด้วย Rate Limiting, และไม่แสดงรหัสผ่านในหน้า Login
2. **หน้าจอใช้งานง่าย ไม่ซับซ้อน (Simplified User Interface)**: แสดงเฉพาะเครื่องมือและปุ่มที่สอดคล้องกับบทบาทของผู้ใช้ขณะนั้น เช่น Requester จะเห็นเฉพาะปุ่มแจ้งปัญหาและยกเลิก ส่วน Supervisor จะเห็นปุ่มมอบหมายงาน
3. **ผู้ใช้งานสามารถสร้างคำร้องได้**: ระบุหัวข้อ, รายละเอียด, หมวดหมู่, ระดับความเร่งด่วน, สถานที่เกิดปัญหา, และเบอร์โทร
4. **การกรอง (Filter)**: สามารถ Filter ตาม **Status**, **Priority**, และ **Category** รวมถึงค้นหาตาม Keyword
5. **Supervisor มอบหมายงานได้**: เลือกเจ้าหน้าที่และบันทึกหมายเหตุการมอบหมาย
6. **เจ้าหน้าที่เปลี่ยน Status ได้**: เปลี่ยนเป็น `IN_PROGRESS`, `RESOLVED`, หรือ `CLOSED` ตามลำดับขั้นตอน
7. **บันทึกหมายเหตุดำเนินงาน**: เจ้าหน้าที่สามารถบันทึก Work Notes และบังคับกรอกเมื่อเปลี่ยนเป็น `RESOLVED`
8. **บันทึกประวัติการเปลี่ยน Status (Audit Trail)**: ระบบบันทึกสถานะเดิม สถานะใหม่ ผู้ทำรายการ และวันเวลาอัตโนมัติ
9. **ผู้แจ้งสามารถยกเลิกคำร้องได้**: เปลี่ยนเป็นสถานะ `CANCELLED` (เฉพาะคำร้องที่ยังไม่เริ่มงาน)
10. **ระบบตรวจสอบข้อมูลก่อนบันทึก (Validation)**: ตรวจสอบความยาวของข้อมูล, Foreign Keys, และ State Transition
11. **ศูนย์รายงานและสถิติสารสนเทศ (Reports & Analytics)**: นำเสนอรายงานเชิงธุรกิจ 3 รูปแบบ (คำร้องใหม่รอดำเนินการ, สรุปสถิติตามหมวดหมู่, และจัดอันดับภาระงานเจ้าหน้าที่) พร้อมซ่อนคำสั่ง SQL ทางเทคนิคไว้ในกล่องพับสำหรับผู้ตรวจประเมิน

---

## 2. โครงสร้างไฟล์ในโครงการ (Project Structure)

```text
E:\test_MFU/
├── ANALYSIS.md              # [เอกสาร] วิเคราะห์ความต้องการ (Actor, FR, BR, Ambiguities, Assumptions)
├── DATABASE.md              # [เอกสาร] ออกแบบฐานข้อมูล (ERD, Data Dictionary, Schema, SQL 1, 2, 3)
├── README.md                # [เอกสาร] คู่มือระบบ, บัญชีทดสอบ, Testing และ AI Usage
├── Dockerfile               # [Docker] สคริปต์สร้าง Container Image (Node 22 Alpine)
├── docker-compose.yml       # [Docker] Compose config สำหรับรัน Container + Mount Data Volume
├── .dockerignore            # [Docker] กำหนดไฟล์ที่ไม่ต้องส่งเข้า Image Context
├── schema.sql               # [DDL] สคริปต์สร้างตาราง, Seed Data (รหัสผ่านแฮช), และคำสั่ง SQL
├── db.js                    # [Database] โมดูลจัดการ SQLite ด้วย Native node:sqlite (รองรับ Docker Volume)
├── server.js                # [Backend] RESTful API Server ปลอดภัย ไร้ Dependency ภายนอก
├── test_queries.js          # [Script] สคริปต์ทดสอบรันคำสั่ง SQL 1, SQL 2, และ SQL 3
├── check_integration.js     # [Script] สคริปต์ทดสอบ Integration End-to-End ผ่าน HTTP
├── tests/
│   └── system.test.js       # [Automated Tests] ชุดทดสอบ 16 Test Cases ผ่าน 100%
└── public/                  # [Frontend UI] ส่วนต่อประสานผู้ใช้งานที่เรียบง่าย ใช้งานสะดวก
    ├── index.html           # โครงสร้างหน้าเว็บ Login Screen, Dashboard, Reports & Analytics, Guide
    ├── style.css            # สไตล์ที่ปรับแต่งให้สะอาดตา รองรับทั้งหน้า Login, Dashboard, และ Reports
    └── app.js               # ตรรกะ Session, การแสดงผลตารางรายงานสรุป, ตัวกรอง, Timeline และ Modal
```

---

## 3. คำสั่ง SQL สำคัญตามโจทย์ (Required SQL Queries)

### 📌 SQL 1: ค้นหาคำร้องที่มีสถานะ 'NEW'
ค้นหารายการคำร้องใหม่ที่ยังไม่ได้รับการมอบหมายงาน เรียงลำดับตามความเร่งด่วน (`URGENT` -> `HIGH` -> `MEDIUM` -> `LOW`) และวันที่แจ้ง:

```sql
SELECT 
    r.id AS request_id,
    r.ticket_no,
    r.title,
    c.name AS category_name,
    r.priority,
    r.status_code AS status,
    u.full_name AS requester_name,
    u.department AS requester_dept,
    r.location,
    r.contact_phone,
    r.created_at
FROM service_requests r
JOIN categories c ON r.category_id = c.id
JOIN users u ON r.requester_id = u.id
WHERE r.status_code = 'NEW'
ORDER BY 
    CASE r.priority 
        WHEN 'URGENT' THEN 1 
        WHEN 'HIGH' THEN 2 
        WHEN 'MEDIUM' THEN 3 
        WHEN 'LOW' THEN 4 
    END, 
    r.created_at ASC;
```

---

### 📌 SQL 2: แสดงคำร้องแยกตาม Category
แสดงสถิติจำนวนคำร้องทั้งหมดในแต่ละหมวดหมู่ปัญหา พร้อมจำแนกนับจำนวนตามสถานะสำคัญ:

```sql
SELECT 
    c.id AS category_id,
    c.name AS category_name,
    COUNT(r.id) AS total_requests,
    SUM(CASE WHEN r.status_code = 'NEW' THEN 1 ELSE 0 END) AS count_new,
    SUM(CASE WHEN r.status_code = 'ASSIGNED' THEN 1 ELSE 0 END) AS count_assigned,
    SUM(CASE WHEN r.status_code = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS count_in_progress,
    SUM(CASE WHEN r.status_code = 'RESOLVED' THEN 1 ELSE 0 END) AS count_resolved,
    SUM(CASE WHEN r.status_code = 'CLOSED' THEN 1 ELSE 0 END) AS count_closed,
    SUM(CASE WHEN r.status_code = 'CANCELLED' THEN 1 ELSE 0 END) AS count_cancelled
FROM categories c
LEFT JOIN service_requests r ON c.id = r.category_id
GROUP BY c.id, c.name
ORDER BY total_requests DESC, c.id ASC;
```

---

### 📌 SQL 3: เพิ่มชื่อเจ้าหน้าที่จากคำร้องรับผิดชอบจากมากไปน้อย (Staff Workload Ranking)
แสดงรายชื่อเจ้าหน้าที่ไอทีทั้งหมด พร้อมนับจำนวนคำร้องที่ได้รับมอบหมาย โดยเรียงลำดับจาก **เจ้าหน้าที่ที่มีคำร้องรับผิดชอบมากที่สุดไปหาน้อยที่สุด (DESC)**:

```sql
SELECT 
    u.id AS staff_id,
    u.full_name AS staff_name,
    u.email AS staff_email,
    u.department AS staff_dept,
    COUNT(r.id) AS total_assigned_requests,
    SUM(CASE WHEN r.status_code = 'ASSIGNED' THEN 1 ELSE 0 END) AS count_assigned,
    SUM(CASE WHEN r.status_code = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS count_in_progress,
    SUM(CASE WHEN r.status_code = 'RESOLVED' THEN 1 ELSE 0 END) AS count_resolved,
    SUM(CASE WHEN r.status_code = 'CLOSED' THEN 1 ELSE 0 END) AS count_closed
FROM users u
LEFT JOIN service_requests r ON u.id = r.assigned_to_id
WHERE u.role = 'STAFF'
GROUP BY u.id, u.full_name, u.email, u.department
ORDER BY total_assigned_requests DESC, u.id ASC;
```

*(บนหน้าเว็บ มีแท็บ **"คำสั่ง SQL ตามโจทย์ (SQL 1, 2, 3)"** ให้กดรันดูผลลัพธ์จากฐานข้อมูลจริงได้ทั้ง 3 คำสั่ง)*

---

## 4. วิธีการติดตั้งและเข้าใช้งานระบบ (Getting Started)

### ความต้องการของระบบ (Prerequisites)
- **Node.js**: เวอร์ชัน 20 หรือ 24 ขึ้นไป

### ขั้นตอนการรันระบบ (Run Options)

#### วิธีที่ 1: รันด้วย Node.js โดยตรง (Direct Run)
1. เปิด Command Prompt หรือ PowerShell แล้วไปที่โฟลเดอร์ของโครงการ:
   ```powershell
   cd E:\test_MFU
   ```
2. สั่งเริ่มการทำงานของเซิร์ฟเวอร์:
   ```powershell
   node server.js
   ```
3. เปิดเว็บเบราว์เซอร์แล้วเข้าไปที่:
   👉 **http://localhost:3000**

#### วิธีที่ 2: รันด้วย Docker & Docker Compose (Container Run)
ระบบถูกสร้างคอนฟิกสำหรับ Docker พร้อมใช้งานอย่างสมบูรณ์:
1. สั่ง Build และรัน Container ด้วย Docker Compose:
   ```bash
   docker compose up -d --build
   ```
   หรือใช้คำสั่ง npm:
   ```bash
   npm run docker:up
   ```
2. ตรวจสอบสถานะการทำงาน:
   ```bash
   docker ps
   ```
3. เปิดเว็บเบราว์เซอร์:
   👉 **http://localhost:3000**
4. สั่งหยุดการทำงานเมื่อใช้งานเสร็จ:
   ```bash
   docker compose down
   ```
   *(ข้อมูลฐานข้อมูล SQLite จะถูกบันทึกไว้ในโฟลเดอร์ `./data/` บนเครื่องจริงอย่างปลอดภัย ไม่สูญหายเมื่อปิด Container)*

### การเข้าสู่ระบบ (Login)
ระบบใช้หน้าจอ Login มาตรฐาน (Username & Password) โดยเมื่อเข้าสู่ระบบแล้ว ระบบจะล็อกสิทธิ์การใช้งานตามบัญชีนั้นอย่างแท้จริง และหากต้องการเปลี่ยนผู้ใช้ จะต้องกดปุ่ม **"🚪 ออกจากระบบ"** เพื่อกลับสู่หน้าจอ Login

#### 📋 รายชื่อบัญชีผู้ใช้และรหัสผ่านทั้งหมดในระบบ (Default Password: `123456`)

| กลุ่มผู้ใช้งาน (Role) | ชื่อ-นามสกุล | ชื่อผู้ใช้ (Username) | รหัสผ่าน (Password) | สิทธิ์การทำงานหลัก |
| :--- | :--- | :--- | :--- | :--- |
| **ผู้แจ้งปัญหา (Requester)** | อ.สมชาย สายลม | `somchai.s` | `123456` | สร้างคำร้อง, ตรวจสอบสถานะ, ยกเลิกคำร้องตนเอง |
| **ผู้แจ้งปัญหา (Requester)** | น.ส.กัญญา พรหมดี | `kanya.p` | `123456` | สร้างคำร้อง, ตรวจสอบสถานะ, ยกเลิกคำร้องตนเอง |
| **ผู้แจ้งปัญหา (Requester)** | นายวิชัย กิจการ | `wichai.k` | `123456` | สร้างคำร้อง, ตรวจสอบสถานะ, ยกเลิกคำร้องตนเอง |
| **เจ้าหน้าที่ไอที (Staff)** | นายมานพ ช่างคอม | `staff.manop` | `123456` | ดูคิวงานทั้งหมด, ปรับสถานะ (In Progress / Resolved), บันทึก Work Notes |
| **เจ้าหน้าที่ไอที (Staff)** | น.ส.สราลี ซ่อมเน็ต | `staff.sarah` | `123456` | ดูคิวงานทั้งหมด, ปรับสถานะ (In Progress / Resolved), บันทึก Work Notes |
| **เจ้าหน้าที่ไอที (Staff)** | นายสมเกียรติ ปฏิบัติการ | `staff.somkiat` | `123456` | ดูคิวงานทั้งหมด, ปรับสถานะ (In Progress / Resolved), บันทึก Work Notes |
| **หัวหน้างาน (Supervisor)** | ดร.ประสิทธิ์ ดูแลดี | `sup.prasit` | `123456` | ดูภาพรวมทั้งหมด, มอบหมายงาน (Assign Staff), จัดการงานได้ทุกสถานะ |

---

## 5. การทดสอบระบบ (Testing Guide & Verification)

### คำสั่งสำหรับรันการทดสอบ
```powershell
node --test tests/system.test.js
```

### ผลการทดสอบ (Automated Test Results)
```text
▶ IT Service Request System - Verification & Automated Tests
  ▶ FR-01 & FR-10: Ticket Creation & Data Validation
    ✔ Should successfully create a new service request with status NEW (7.8ms)
    ✔ FR-10: Should reject invalid priority via SQLite CHECK constraint (4.8ms)
    ✔ FR-10: Should reject non-existent category via Foreign Key constraint (4.1ms)
  ✔ FR-01 & FR-10: Ticket Creation & Data Validation (19.3ms)
  ▶ FR-04: Filter & Search Functionality
    ✔ Should filter requests by status_code correctly (4.5ms)
    ✔ Should filter requests by priority correctly (6.5ms)
    ✔ Should filter requests by category_id correctly (3.8ms)
  ✔ FR-04: Filter & Search Functionality (15.7ms)
  ▶ FR-05: Supervisor Assignment & State Transition
    ✔ Supervisor assigns NEW request to staff, changing status to ASSIGNED and logging history (5.2ms)
  ✔ FR-05: Supervisor Assignment & State Transition (5.6ms)
  ▶ FR-06 & FR-07: Staff Updates Status & Work Notes
    ✔ Staff changes status from ASSIGNED to IN_PROGRESS and then RESOLVED with notes (4.1ms)
  ✔ FR-06 & FR-07: Staff Updates Status & Work Notes (4.4ms)
  ▶ FR-08: Complete Audit History Trail
    ✔ History records are append-only and maintain chronological order (3.7ms)
  ✔ FR-08: Complete Audit History Trail (3.9ms)
  ▶ FR-09: Request Cancellation by Requester
    ✔ Requester can cancel a pending NEW request (5.7ms)
  ✔ FR-09: Request Cancellation by Requester (5.9ms)
  ▶ System Database Design - SQL Queries Verification
    ✔ SQL 1: Search requests with status NEW sorted by Priority then created_at (4.0ms)
    ✔ SQL 2: Group and aggregate requests by Category (3.8ms)
    ✔ SQL 3: List staff and total assigned requests sorted from highest to lowest (DESC) (3.6ms)
  ✔ System Database Design - SQL Queries Verification (11.9ms)
  ▶ FR-11: Authentication & Role Verification
    ✔ Should authenticate user with valid username and password (3.7ms)
    ✔ Should reject login with invalid password (3.3ms)
  ✔ FR-11: Authentication & Role Verification (7.4ms)
✔ IT Service Request System - Verification & Automated Tests (77.0ms)
ℹ tests 15
ℹ suites 9
ℹ pass 15
ℹ fail 0
```

---

## 6. การประยุกต์ใช้ AI ในการพัฒนาระบบ (AI Usage in Software Engineering)

1. **AI ในการออกแบบระบบ Authentication & Security**:
   - ช่วยวางโครงสร้างตาราง `users` เพิ่มคอลัมน์รหัสผ่านและสร้าง API ยืนยันตัวตน
   - ออกแบบหน้าจอ Quick Login ที่ช่วยให้ผู้ทดสอบระบบสามารถสลับ 3 บทบาทได้อย่างสะดวก รวดเร็ว โดยยังคงรักษาความถูกต้องตามหลักความปลอดภัย
2. **AI ในการปรับปรุง User Experience (UX/UI Simplification)**:
   - วิเคราะห์และตัดทอนความซับซ้อนของหน้าจอเดิม ทำให้ระบบอ่านง่าย มีการจัดกลุ่มข้อมูลที่ผู้ใช้แต่ละบทบาทจำเป็นต้องเห็นเท่านั้น
   - นำเสนอการ์ดสรุป KPI และตารางคำร้องที่มีปุ่ม Action สอดคล้องกับสิทธิ์จริงของผู้ใช้
3. **AI ในการสร้างคำสั่ง SQL 3 สำหรับจัดอันดับภาระงาน (Workload Ranking)**:
   - ใช้ `LEFT JOIN` ระหว่างตาราง `users` (เฉพาะ `role = 'STAFF'`) และ `service_requests`
   - ใช้ `COUNT(r.id)` และ `GROUP BY` เพื่อคำนวณจำนวนงานที่ได้รับมอบหมายทั้งหมด
   - สั่งจัดเรียงด้วย `ORDER BY total_assigned_requests DESC` ทำให้ได้ข้อมูลเจ้าหน้าที่ที่มีงานมากที่สุดไปน้อยที่สุดอย่างแม่นยำ
4. **AI ในการขยายชุดทดสอบอัตโนมัติ (Automated Testing)**:
   - เพิ่มชุดทดสอบตรวจสอบตรรกะการ Login (ทั้งกรณีสำเร็จและรหัสผ่านผิด)
   - เพิ่มชุดทดสอบเพื่อ Assert ค่าการเรียงลำดับจากมากไปน้อยของผลลัพธ์ SQL 3 แบบครอบคลุม 100%
