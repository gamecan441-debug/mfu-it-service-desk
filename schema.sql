-- ====================================================================
-- University IT Service Request System - Database Schema & Seed Data
-- Database: SQLite 3
-- File: schema.sql
-- ====================================================================

PRAGMA foreign_keys = ON;

-- 1. DROP EXISTING TABLES (In correct dependency order)
DROP TABLE IF EXISTS request_histories;
DROP TABLE IF EXISTS service_requests;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS statuses;
DROP TABLE IF EXISTS users;

-- 2. USERS TABLE (Includes salted hash password for Security)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('REQUESTER', 'STAFF', 'SUPERVISOR')),
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    department TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. CATEGORIES TABLE
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. STATUSES TABLE
CREATE TABLE statuses (
    code TEXT PRIMARY KEY,
    name_th TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description TEXT,
    is_terminal INTEGER NOT NULL DEFAULT 0 CHECK(is_terminal IN (0, 1)),
    sort_order INTEGER NOT NULL
);

-- 5. SERVICE REQUESTS TABLE
CREATE TABLE service_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_no TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    priority TEXT NOT NULL CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status_code TEXT NOT NULL DEFAULT 'NEW',
    requester_id INTEGER NOT NULL,
    assigned_to_id INTEGER,
    location TEXT,
    contact_phone TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,
    closed_at TEXT,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (status_code) REFERENCES statuses(code) ON DELETE RESTRICT,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (assigned_to_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 6. REQUEST HISTORIES (Audit Trail)
CREATE TABLE request_histories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    action TEXT NOT NULL,
    notes TEXT,
    changed_by_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (old_status) REFERENCES statuses(code),
    FOREIGN KEY (new_status) REFERENCES statuses(code),
    FOREIGN KEY (changed_by_id) REFERENCES users(id)
);

-- 7. INDEXES FOR PERFORMANCE
CREATE INDEX idx_requests_status ON service_requests(status_code);
CREATE INDEX idx_requests_category ON service_requests(category_id);
CREATE INDEX idx_requests_requester ON service_requests(requester_id);
CREATE INDEX idx_requests_assigned ON service_requests(assigned_to_id);
CREATE INDEX idx_histories_request ON request_histories(request_id);

-- ====================================================================
-- SEED DATA
-- ====================================================================

-- Seed Statuses
INSERT INTO statuses (code, name_th, name_en, description, is_terminal, sort_order) VALUES
('NEW', 'รับแจ้งใหม่', 'New', 'คำร้องถูกสร้างขึ้นใหม่ รอหัวหน้างานมอบหมาย', 0, 1),
('ASSIGNED', 'มอบหมายแล้ว', 'Assigned', 'มอบหมายให้เจ้าหน้าที่ผู้รับผิดชอบแล้ว', 0, 2),
('IN_PROGRESS', 'กำลังดำเนินการ', 'In Progress', 'เจ้าหน้าที่กำลังตรวจสอบหรือแก้ไขปัญหา', 0, 3),
('RESOLVED', 'แก้ไขเสร็จสิ้น', 'Resolved', 'เจ้าหน้าที่แก้ไขปัญหาเสร็จสิ้น รอการยืนยันปิดงาน', 0, 4),
('CLOSED', 'ปิดงานแล้ว', 'Closed', 'คำร้องถูกตรวจสอบและปิดงานเรียบร้อยแล้ว', 1, 5),
('CANCELLED', 'ยกเลิกคำร้อง', 'Cancelled', 'คำร้องถูกยกเลิกโดยผู้แจ้ง', 1, 6);

-- Seed Categories
INSERT INTO categories (code, name, description, is_active) VALUES
('NET', 'ระบบเครือข่ายและ Wi-Fi', 'ปัญหาการเชื่อมต่ออินเทอร์เน็ต เครือข่ายไร้สาย สัญญาณหลุด หรือ VPN มหาวิทยาลัย', 1),
('HW', 'อุปกรณ์คอมพิวเตอร์และฮาร์ดแวร์', 'เครื่องคอมพิวเตอร์เปิดไม่ติด จอภาพ อุปกรณ์ต่อพ่วง เครื่องพิมพ์ โปรเจกเตอร์ห้องเรียน', 1),
('SW', 'ซอฟต์แวร์และโปรแกรมประยุกต์', 'ติดตั้งโปรแกรม ใบอนุญาตลิขสิทธิ์ Windows, Office 365, ซอฟต์แวร์วิจัย', 1),
('ACC', 'บัญชีผู้ใช้และระบบสารสนเทศ', 'ลืมรหัสผ่าน บัญชี Google Workspace, REG, Moodle, บัญชีอีเมลมหาวิทยาลัย', 1),
('AV', 'ระบบโสตทัศนูปกรณ์ห้องเรียน', 'ไมโครโฟน ลำโพง ระบบควบคุมห้องสัมมนา และระบบถ่ายทอดสด', 1);

-- Seed Users (Passwords are securely hashed with PBKDF2/SHA-256 + salt)
INSERT INTO users (username, password_hash, password_salt, full_name, role, email, phone, department) VALUES
-- Role 1: Requesters (Default password: '123456')
('somchai.s', '1cca0d32fa529550b160acfb8f20f07c3dd73e75ad0cb51bc33228482324eb0b', 'mfu_secure_salt_2026', 'นายสมชาย สายลม (อาจารย์)', 'REQUESTER', 'somchai.s@mfu.ac.th', '081-111-2233', 'สำนักวิชาเทคโนโลยีสารสนเทศ'),
('kanya.p', '1cca0d32fa529550b160acfb8f20f07c3dd73e75ad0cb51bc33228482324eb0b', 'mfu_secure_salt_2026', 'นางสาวกัญญา พรหมดี (นักศึกษา)', 'REQUESTER', '6531501001@lamduan.mfu.ac.th', '089-222-3344', 'สำนักวิชาวิทยาศาสตร์เครื่องสำอาง'),
('wichai.k', '1cca0d32fa529550b160acfb8f20f07c3dd73e75ad0cb51bc33228482324eb0b', 'mfu_secure_salt_2026', 'นายวิชัย กิจการ (เจ้าหน้าที่ธุรการ)', 'REQUESTER', 'wichai.k@mfu.ac.th', '085-333-4455', 'ส่วนทะเบียนและประมวลผล'),

-- Role 2: IT Staff (Technicians)
('staff.manop', '1cca0d32fa529550b160acfb8f20f07c3dd73e75ad0cb51bc33228482324eb0b', 'mfu_secure_salt_2026', 'นายมานพ ช่างคอม (เจ้าหน้าที่ไอที)', 'STAFF', 'manop.c@mfu.ac.th', '084-555-6677', 'ศูนย์บริการเทคโนโลยีสารสนเทศ'),
('staff.sarah', '1cca0d32fa529550b160acfb8f20f07c3dd73e75ad0cb51bc33228482324eb0b', 'mfu_secure_salt_2026', 'นางสาวสราลี ซ่อมเน็ต (วิศวกรเครือข่าย)', 'STAFF', 'sarah.s@mfu.ac.th', '086-777-8899', 'ศูนย์บริการเทคโนโลยีสารสนเทศ'),
('staff.somkiat', '1cca0d32fa529550b160acfb8f20f07c3dd73e75ad0cb51bc33228482324eb0b', 'mfu_secure_salt_2026', 'นายสมเกียรติ ปฏิบัติการ (ผู้ช่วยไอที)', 'STAFF', 'somkiat.p@mfu.ac.th', '087-123-9900', 'ศูนย์บริการเทคโนโลยีสารสนเทศ'),

-- Role 3: IT Supervisor (Manager)
('sup.prasit', '1cca0d32fa529550b160acfb8f20f07c3dd73e75ad0cb51bc33228482324eb0b', 'mfu_secure_salt_2026', 'ดร.ประสิทธิ์ ดูแลดี (หัวหน้าฝ่ายบริการไอที)', 'SUPERVISOR', 'prasit.d@mfu.ac.th', '081-999-0011', 'ศูนย์บริการเทคโนโลยีสารสนเทศ');

-- Seed Service Requests
-- 1. NEW (Pending Assignment)
INSERT INTO service_requests (id, ticket_no, title, description, category_id, priority, status_code, requester_id, assigned_to_id, location, contact_phone, created_at, updated_at)
VALUES (1, 'REQ-2026-0001', 'Wi-Fi ใช้งานไม่ได้ที่อาคาร C1 ห้อง 305', 'สัญญาณ MFU-WiFi หลุดบ่อยมาก ไม่สามารถเชื่อมต่อระบบสอนออนไลน์ได้', 1, 'URGENT', 'NEW', 1, NULL, 'อาคารเรียนรวม C1 ชั้น 3 ห้อง 305', '081-111-2233', '2026-09-10 08:30:00', '2026-09-10 08:30:00');

-- 2. NEW (Hardware Issue)
INSERT INTO service_requests (id, ticket_no, title, description, category_id, priority, status_code, requester_id, assigned_to_id, location, contact_phone, created_at, updated_at)
VALUES (2, 'REQ-2026-0002', 'เครื่องคอมพิวเตอร์ห้องปฏิบัติการเปิดไม่ติด', 'เครื่องหมายเลข PC-14 มีไฟสีส้มขึ้นแล้วดับ ไม่บูตเข้า Windows', 2, 'HIGH', 'NEW', 2, NULL, 'อาคาร E-Park ห้อง Lab 2', '089-222-3344', '2026-09-10 09:15:00', '2026-09-10 09:15:00');

-- 3. ASSIGNED to Manop (staff 4)
INSERT INTO service_requests (id, ticket_no, title, description, category_id, priority, status_code, requester_id, assigned_to_id, location, contact_phone, created_at, updated_at)
VALUES (3, 'REQ-2026-0003', 'ขอรีเซ็ตรหัสผ่านบัญชีอีเมลมหาวิทยาลัย', 'ลืมรหัสผ่าน ไม่สามารถเข้าระบบ Moodle เพื่อส่งงานได้', 4, 'MEDIUM', 'ASSIGNED', 2, 4, 'คณะวิทยาศาสตร์เครื่องสำอาง', '089-222-3344', '2026-09-09 14:00:00', '2026-09-09 14:30:00');

-- 4. IN_PROGRESS to Manop (staff 4)
INSERT INTO service_requests (id, ticket_no, title, description, category_id, priority, status_code, requester_id, assigned_to_id, location, contact_phone, created_at, updated_at)
VALUES (4, 'REQ-2026-0004', 'โปรเจกเตอร์ห้องสัมมนาภาพกระพริบและสีเพี้ยน', 'โปรเจกเตอร์ต่อ HDMI แล้วภาพออกสีเขียวและดับทุก 5 นาที', 5, 'HIGH', 'IN_PROGRESS', 3, 4, 'อาคาร M-Square ห้องสัมมนาใหญ่', '085-333-4455', '2026-09-09 10:00:00', '2026-09-09 11:00:00');

-- 5. RESOLVED to Manop (staff 4)
INSERT INTO service_requests (id, ticket_no, title, description, category_id, priority, status_code, requester_id, assigned_to_id, location, contact_phone, created_at, updated_at, resolved_at)
VALUES (5, 'REQ-2026-0005', 'ขอติดตั้งโปรแกรม SPSS สำหรับงานวิจัย', 'ต้องการติดตั้งซอฟต์แวร์ SPSS Version 29 พร้อม Activate License', 3, 'LOW', 'RESOLVED', 1, 4, 'อาคาร C2 ห้องพักอาจารย์ 401', '081-111-2233', '2026-09-08 09:00:00', '2026-09-08 16:00:00', '2026-09-08 16:00:00');

-- 6. CLOSED to Sarah (staff 5)
INSERT INTO service_requests (id, ticket_no, title, description, category_id, priority, status_code, requester_id, assigned_to_id, location, contact_phone, created_at, updated_at, resolved_at, closed_at)
VALUES (6, 'REQ-2026-0006', 'สาย LAN ขาดที่โต๊ะทำงานส่วนทะเบียน', 'สาย LAN โดนเก้าอี้ทับขาด เข้าเครือข่ายภายในไม่ได้', 1, 'MEDIUM', 'CLOSED', 3, 5, 'อาคารบริหาร ชั้น 1 ส่วนทะเบียน', '085-333-4455', '2026-09-07 13:00:00', '2026-09-07 17:00:00', '2026-09-07 16:30:00', '2026-09-07 17:00:00');

-- 7. CANCELLED
INSERT INTO service_requests (id, ticket_no, title, description, category_id, priority, status_code, requester_id, assigned_to_id, location, contact_phone, created_at, updated_at)
VALUES (7, 'REQ-2026-0007', 'พิมพ์งานไม่ออก เครื่องพิมพ์ Network ไม่ตอบสนอง', 'สั่งพิมพ์แล้วเครื่องนิ่ง แจ้งผิดเครื่อง ขอยกเลิก', 2, 'LOW', 'CANCELLED', 2, NULL, 'อาคาร E-Park', '089-222-3344', '2026-09-08 11:00:00', '2026-09-08 11:30:00');

-- Seed Request Histories (Audit Trail)
INSERT INTO request_histories (request_id, old_status, new_status, action, notes, changed_by_id, created_at) VALUES
(1, NULL, 'NEW', 'CREATE', 'สร้างคำร้องแจ้งปัญหา Wi-Fi ขัดข้อง', 1, '2026-09-10 08:30:00'),
(2, NULL, 'NEW', 'CREATE', 'สร้างคำร้องแจ้งปัญหาคอมพิวเตอร์เปิดไม่ติด', 2, '2026-09-10 09:15:00'),
(3, NULL, 'NEW', 'CREATE', 'สร้างคำร้องขอรีเซ็ตรหัสผ่าน', 2, '2026-09-09 14:00:00'),
(3, 'NEW', 'ASSIGNED', 'ASSIGN', 'มอบหมายงานให้นายมานพ ช่างคอม ดำเนินการตรวจสอบ', 7, '2026-09-09 14:30:00'),
(4, NULL, 'NEW', 'CREATE', 'สร้างคำร้องโปรเจกเตอร์สีเพี้ยน', 3, '2026-09-09 10:00:00'),
(4, 'NEW', 'ASSIGNED', 'ASSIGN', 'มอบหมายงานให้นายมานพ ช่างคอม', 7, '2026-09-09 10:15:00'),
(4, 'ASSIGNED', 'IN_PROGRESS', 'STATUS_CHANGE', 'เข้าตรวจสอบหน้างาน พบสายสัญญาณ HDMI หลวมและขั้วต่อชำรุด กำลังเบิกสายสำรองเปลี่ยนใหม่', 4, '2026-09-09 11:00:00'),
(5, NULL, 'NEW', 'CREATE', 'สร้างคำร้องขอติดตั้งโปรแกรม SPSS', 1, '2026-09-08 09:00:00'),
(5, 'NEW', 'ASSIGNED', 'ASSIGN', 'มอบหมายให้นายมานพ ช่างคอม ดำเนินการ', 7, '2026-09-08 09:30:00'),
(5, 'ASSIGNED', 'IN_PROGRESS', 'STATUS_CHANGE', 'กำลังรีโมตเข้าเครื่องผู้ใช้เพื่อติดตั้งซอฟต์แวร์', 4, '2026-09-08 10:00:00'),
(5, 'IN_PROGRESS', 'RESOLVED', 'STATUS_CHANGE', 'ติดตั้ง SPSS v29 และ Activate Campus License เรียบร้อย ทดสอบรันโปรแกรมผ่าน', 4, '2026-09-08 16:00:00'),
(6, NULL, 'NEW', 'CREATE', 'สร้างคำร้องสาย LAN ขาด', 3, '2026-09-07 13:00:00'),
(6, 'NEW', 'ASSIGNED', 'ASSIGN', 'มอบหมายให้นางสาวสราลี ซ่อมเน็ต', 7, '2026-09-07 13:10:00'),
(6, 'ASSIGNED', 'IN_PROGRESS', 'STATUS_CHANGE', 'เข้าหน้างาน ทำการเข้าหัว RJ-45 และทดสอบสัญญาณสายเคเบิล', 5, '2026-09-07 14:00:00'),
(6, 'IN_PROGRESS', 'RESOLVED', 'STATUS_CHANGE', 'เปลี่ยนสาย Patch Cord เส้นใหม่และทดสอบความเร็วอินเทอร์เน็ตได้ 1 Gbps ปกติ', 5, '2026-09-07 16:30:00'),
(6, 'RESOLVED', 'CLOSED', 'STATUS_CHANGE', 'ผู้แจ้งตรวจรับงาน และหัวหน้างานปิดงานสมบูรณ์', 7, '2026-09-07 17:00:00'),
(7, NULL, 'NEW', 'CREATE', 'สร้างคำร้องพิมพ์งานไม่ออก', 2, '2026-09-08 11:00:00'),
(7, 'NEW', 'CANCELLED', 'CANCEL', 'ผู้แจ้งกดยกเลิกคำร้อง เนื่องจากเลือกเครื่องพิมพ์ผิดตัว ปัจจุบันพิมพ์ได้แล้ว', 2, '2026-09-08 11:30:00');

-- ====================================================================
-- REQUIRED QUERIES (SQL 1, SQL 2, and SQL 3)
-- ====================================================================

-- --------------------------------------------------------------------
-- SQL 1: ค้นหาคำร้องที่มีสถานะ NEW (เรียงตาม Priority และ วันที่สร้าง)
-- --------------------------------------------------------------------
-- SELECT 
--     r.id AS request_id,
--     r.ticket_no,
--     r.title,
--     c.name AS category_name,
--     r.priority,
--     r.status_code AS status,
--     u.full_name AS requester_name,
--     u.department AS requester_dept,
--     r.location,
--     r.contact_phone,
--     r.created_at
-- FROM service_requests r
-- JOIN categories c ON r.category_id = c.id
-- JOIN users u ON r.requester_id = u.id
-- WHERE r.status_code = 'NEW'
-- ORDER BY 
--     CASE r.priority 
--         WHEN 'URGENT' THEN 1 
--         WHEN 'HIGH' THEN 2 
--         WHEN 'MEDIUM' THEN 3 
--         WHEN 'LOW' THEN 4 
--     END, 
--     r.created_at ASC;

-- --------------------------------------------------------------------
-- SQL 2: แสดงคำร้องแยกตาม Category (สรุปจำนวนและสถานะ)
-- --------------------------------------------------------------------
-- SELECT 
--     c.id AS category_id,
--     c.name AS category_name,
--     COUNT(r.id) AS total_requests,
--     SUM(CASE WHEN r.status_code = 'NEW' THEN 1 ELSE 0 END) AS count_new,
--     SUM(CASE WHEN r.status_code = 'ASSIGNED' THEN 1 ELSE 0 END) AS count_assigned,
--     SUM(CASE WHEN r.status_code = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS count_in_progress,
--     SUM(CASE WHEN r.status_code = 'RESOLVED' THEN 1 ELSE 0 END) AS count_resolved,
--     SUM(CASE WHEN r.status_code = 'CLOSED' THEN 1 ELSE 0 END) AS count_closed,
--     SUM(CASE WHEN r.status_code = 'CANCELLED' THEN 1 ELSE 0 END) AS count_cancelled
-- FROM categories c
-- LEFT JOIN service_requests r ON c.id = r.category_id
-- GROUP BY c.id, c.name
-- ORDER BY total_requests DESC, c.id ASC;

-- --------------------------------------------------------------------
-- SQL 3: เพิ่มชื่อเจ้าหน้าที่จากคำร้องรับผิดชอบจากมากไปน้อย (Workload Ranking)
-- --------------------------------------------------------------------
-- SELECT 
--     u.id AS staff_id,
--     u.full_name AS staff_name,
--     u.email AS staff_email,
--     u.department AS staff_dept,
--     COUNT(r.id) AS total_assigned_requests,
--     SUM(CASE WHEN r.status_code = 'ASSIGNED' THEN 1 ELSE 0 END) AS count_assigned,
--     SUM(CASE WHEN r.status_code = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS count_in_progress,
--     SUM(CASE WHEN r.status_code = 'RESOLVED' THEN 1 ELSE 0 END) AS count_resolved,
--     SUM(CASE WHEN r.status_code = 'CLOSED' THEN 1 ELSE 0 END) AS count_closed
-- FROM users u
-- LEFT JOIN service_requests r ON u.id = r.assigned_to_id
-- WHERE u.role = 'STAFF'
-- GROUP BY u.id, u.full_name, u.email, u.department
-- ORDER BY total_assigned_requests DESC, u.id ASC;
