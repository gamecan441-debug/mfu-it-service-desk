const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const crypto = require('node:crypto');
const { getDatabase, initializeDatabase } = require('./db.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// -------------------------------------------------------------
// SECURITY HELPERS (PBKDF2 Password Hashing & Rate Limiting)
// -------------------------------------------------------------
function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
}

const loginAttempts = new Map(); // key -> { count, lockedUntil }
const activeSessions = new Map(); // token -> { userId, role, expiresAt }

function checkRateLimit(key) {
    const record = loginAttempts.get(key);
    if (!record) return { allowed: true };
    if (record.lockedUntil && Date.now() < record.lockedUntil) {
        const secondsLeft = Math.ceil((record.lockedUntil - Date.now()) / 1000);
        return { allowed: false, error: `พยายามเข้าสู่ระบบผิดพลาดเกินกำหนด กรุณารออีก ${secondsLeft} วินาทีเพื่อความปลอดภัย` };
    }
    return { allowed: true };
}

function recordFailedAttempt(key) {
    const record = loginAttempts.get(key) || { count: 0, lockedUntil: null };
    record.count += 1;
    if (record.count >= 5) {
        record.lockedUntil = Date.now() + 30000; // 30 seconds lock
        record.count = 0;
    }
    loginAttempts.set(key, record);
}

function resetFailedAttempts(key) {
    loginAttempts.delete(key);
}

// Ensure database is initialized
let db;
try {
    db = getDatabase();
    // Quick test if tables exist
    db.prepare('SELECT COUNT(*) FROM users').get();
} catch (e) {
    console.log('Database not ready, initializing now...');
    db = initializeDatabase();
}

// MIME types
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            if (body.length > 1e6) { // 1MB limit
                req.destroy();
                reject(new Error('Request entity too large'));
            }
        });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (err) {
                reject(new Error('Invalid JSON format: ' + err.message));
            }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    // CORS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;
    const query = Object.fromEntries(parsedUrl.searchParams.entries());

    try {
        // -------------------------------------------------------------
        // REST API ROUTES
        // -------------------------------------------------------------

        // 0. POST /api/login (Secure User Authentication)
        if (req.method === 'POST' && pathname === '/api/login') {
            const body = await parseJsonBody(req);
            const { username, password } = body;

            if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
                return sendJson(res, 400, { success: false, error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน' });
            }

            const cleanUsername = username.trim().toLowerCase();
            const rateCheck = checkRateLimit(cleanUsername);
            if (!rateCheck.allowed) {
                return sendJson(res, 429, { success: false, error: rateCheck.error });
            }

            const user = db.prepare('SELECT id, username, full_name, role, email, phone, department, password_hash, password_salt FROM users WHERE lower(username) = ?').get(cleanUsername);
            
            if (!user) {
                recordFailedAttempt(cleanUsername);
                return sendJson(res, 401, { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
            }

            const computedHash = hashPassword(password.trim(), user.password_salt);
            const isValid = crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(user.password_hash, 'hex'));

            if (!isValid) {
                recordFailedAttempt(cleanUsername);
                return sendJson(res, 401, { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
            }

            // Success: Reset rate limit counter and issue session token
            resetFailedAttempts(cleanUsername);
            const sessionToken = crypto.randomBytes(32).toString('hex');
            activeSessions.set(sessionToken, {
                userId: user.id,
                role: user.role,
                createdAt: Date.now(),
                expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            });

            const { password_hash: _, password_salt: __, ...userSafe } = user;
            return sendJson(res, 200, {
                success: true,
                message: 'เข้าสู่ระบบสำเร็จ',
                token: sessionToken,
                user: userSafe
            });
        }

        // 1. GET /api/users
        if (req.method === 'GET' && pathname === '/api/users') {
            let sql = 'SELECT id, username, full_name, role, email, phone, department FROM users';
            const params = [];
            if (query.role) {
                sql += ' WHERE role = ?';
                params.push(query.role.toUpperCase());
            }
            sql += ' ORDER BY id ASC';
            const users = db.prepare(sql).all(...params);
            return sendJson(res, 200, { success: true, data: users });
        }

        // 2. GET /api/categories
        if (req.method === 'GET' && pathname === '/api/categories') {
            const categories = db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY id ASC').all();
            return sendJson(res, 200, { success: true, data: categories });
        }

        // 3. GET /api/statuses
        if (req.method === 'GET' && pathname === '/api/statuses') {
            const statuses = db.prepare('SELECT * FROM statuses ORDER BY sort_order ASC').all();
            return sendJson(res, 200, { success: true, data: statuses });
        }

        // 4. GET /api/stats (Summary Dashboard)
        if (req.method === 'GET' && pathname === '/api/stats') {
            const stats = db.prepare(`
                SELECT 
                    COUNT(id) AS total,
                    SUM(CASE WHEN status_code = 'NEW' THEN 1 ELSE 0 END) AS total_new,
                    SUM(CASE WHEN status_code = 'ASSIGNED' THEN 1 ELSE 0 END) AS total_assigned,
                    SUM(CASE WHEN status_code = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS total_in_progress,
                    SUM(CASE WHEN status_code = 'RESOLVED' THEN 1 ELSE 0 END) AS total_resolved,
                    SUM(CASE WHEN status_code = 'CLOSED' THEN 1 ELSE 0 END) AS total_closed,
                    SUM(CASE WHEN status_code = 'CANCELLED' THEN 1 ELSE 0 END) AS total_cancelled
                FROM service_requests
            `).get();
            return sendJson(res, 200, { success: true, data: stats });
        }

        // 5. GET /api/requests (List with Filters)
        if (req.method === 'GET' && pathname === '/api/requests') {
            let sql = `
                SELECT 
                    r.id,
                    r.ticket_no,
                    r.title,
                    r.description,
                    r.category_id,
                    c.name AS category_name,
                    c.code AS category_code,
                    r.priority,
                    r.status_code,
                    s.name_th AS status_name_th,
                    r.requester_id,
                    req_u.full_name AS requester_name,
                    req_u.department AS requester_dept,
                    r.assigned_to_id,
                    staff_u.full_name AS assigned_to_name,
                    r.location,
                    r.contact_phone,
                    r.created_at,
                    r.updated_at,
                    r.resolved_at,
                    r.closed_at
                FROM service_requests r
                JOIN categories c ON r.category_id = c.id
                JOIN statuses s ON r.status_code = s.code
                JOIN users req_u ON r.requester_id = req_u.id
                LEFT JOIN users staff_u ON r.assigned_to_id = staff_u.id
                WHERE 1=1
            `;
            const params = [];

            if (query.status && query.status !== 'ALL') {
                sql += ' AND r.status_code = ?';
                params.push(query.status);
            }
            if (query.priority && query.priority !== 'ALL') {
                sql += ' AND r.priority = ?';
                params.push(query.priority);
            }
            if (query.category_id && query.category_id !== 'ALL') {
                sql += ' AND r.category_id = ?';
                params.push(Number(query.category_id));
            }
            if (query.requester_id) {
                sql += ' AND r.requester_id = ?';
                params.push(Number(query.requester_id));
            }
            if (query.assigned_to_id) {
                sql += ' AND r.assigned_to_id = ?';
                params.push(Number(query.assigned_to_id));
            }
            if (query.search) {
                sql += ' AND (r.ticket_no LIKE ? OR r.title LIKE ? OR r.description LIKE ? OR req_u.full_name LIKE ?)';
                const term = `%${query.search.trim()}%`;
                params.push(term, term, term, term);
            }

            sql += `
                ORDER BY 
                CASE r.status_code
                    WHEN 'NEW' THEN 1
                    WHEN 'ASSIGNED' THEN 2
                    WHEN 'IN_PROGRESS' THEN 3
                    WHEN 'RESOLVED' THEN 4
                    ELSE 5
                END,
                CASE r.priority
                    WHEN 'URGENT' THEN 1
                    WHEN 'HIGH' THEN 2
                    WHEN 'MEDIUM' THEN 3
                    WHEN 'LOW' THEN 4
                END,
                r.created_at DESC
            `;

            const requests = db.prepare(sql).all(...params);
            return sendJson(res, 200, { success: true, data: requests });
        }

        // 6. GET /api/requests/:id (Details & History)
        const matchRequestDetail = pathname.match(/^\/api\/requests\/(\d+)$/);
        if (req.method === 'GET' && matchRequestDetail) {
            const requestId = Number(matchRequestDetail[1]);
            const request = db.prepare(`
                SELECT 
                    r.*,
                    c.name AS category_name,
                    s.name_th AS status_name_th,
                    req_u.full_name AS requester_name,
                    req_u.email AS requester_email,
                    req_u.department AS requester_dept,
                    staff_u.full_name AS assigned_to_name,
                    staff_u.email AS assigned_to_email
                FROM service_requests r
                JOIN categories c ON r.category_id = c.id
                JOIN statuses s ON r.status_code = s.code
                JOIN users req_u ON r.requester_id = req_u.id
                LEFT JOIN users staff_u ON r.assigned_to_id = staff_u.id
                WHERE r.id = ?
            `).get(requestId);

            if (!request) {
                return sendJson(res, 404, { success: false, error: 'ไม่พบคำร้องที่ระบุ' });
            }

            const histories = db.prepare(`
                SELECT 
                    h.*,
                    u.full_name AS changed_by_name,
                    u.role AS changed_by_role,
                    s_old.name_th AS old_status_name,
                    s_new.name_th AS new_status_name
                FROM request_histories h
                JOIN users u ON h.changed_by_id = u.id
                LEFT JOIN statuses s_old ON h.old_status = s_old.code
                JOIN statuses s_new ON h.new_status = s_new.code
                WHERE h.request_id = ?
                ORDER BY h.id ASC
            `).all(requestId);

            return sendJson(res, 200, { success: true, data: { ...request, histories } });
        }

        // 7. POST /api/requests (Create Request - FR-01, FR-10)
        if (req.method === 'POST' && pathname === '/api/requests') {
            const body = await parseJsonBody(req);
            const { title, description, category_id, priority, requester_id, location, contact_phone } = body;

            // Data Validation (FR-10)
            const errors = [];
            if (!title || typeof title !== 'string' || title.trim().length < 5) {
                errors.push('หัวข้อปัญหาต้องมีความยาวอย่างน้อย 5 ตัวอักษร');
            }
            if (!description || typeof description !== 'string' || description.trim().length < 10) {
                errors.push('รายละเอียดปัญหาต้องมีความยาวอย่างน้อย 10 ตัวอักษร');
            }
            if (!category_id || isNaN(Number(category_id))) {
                errors.push('กรุณาเลือกหมวดหมู่ปัญหาที่ถูกต้อง');
            }
            const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
            if (!priority || !validPriorities.includes(priority)) {
                errors.push('ระดับความสำคัญไม่ถูกต้อง (ต้องเป็น LOW, MEDIUM, HIGH, URGENT)');
            }
            if (!requester_id) {
                errors.push('กรุณาระบุผู้แจ้งปัญหา');
            }

            if (errors.length > 0) {
                return sendJson(res, 400, { success: false, errors });
            }

            // Generate ticket number: REQ-2026-XXXX
            const maxRow = db.prepare('SELECT MAX(id) AS m FROM service_requests').get();
            const nextSeq = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
            const ticketNo = `REQ-2026-${String(nextSeq).padStart(4, '0')}`;

            const insertStmt = db.prepare(`
                INSERT INTO service_requests 
                (ticket_no, title, description, category_id, priority, status_code, requester_id, location, contact_phone, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'NEW', ?, ?, ?, datetime('now'), datetime('now'))
            `);

            const result = insertStmt.run(
                ticketNo,
                title.trim(),
                description.trim(),
                Number(category_id),
                priority,
                Number(requester_id),
                location ? location.trim() : null,
                contact_phone ? contact_phone.trim() : null
            );

            // Audit history (FR-08)
            db.prepare(`
                INSERT INTO request_histories (request_id, old_status, new_status, action, notes, changed_by_id, created_at)
                VALUES (?, NULL, 'NEW', 'CREATE', 'สร้างคำร้องแจ้งปัญหาใหม่', ?, datetime('now'))
            `).run(result.lastInsertRowid, Number(requester_id));

            return sendJson(res, 201, {
                success: true,
                message: 'สร้างคำร้องเรียบร้อยแล้ว',
                data: { id: result.lastInsertRowid, ticket_no: ticketNo }
            });
        }

        // 8. PUT /api/requests/:id/assign (Supervisor Assigns - FR-05)
        const matchAssign = pathname.match(/^\/api\/requests\/(\d+)\/assign$/);
        if (req.method === 'PUT' && matchAssign) {
            const requestId = Number(matchAssign[1]);
            const body = await parseJsonBody(req);
            const { assigned_to_id, supervisor_id, notes } = body;

            if (!assigned_to_id) {
                return sendJson(res, 400, { success: false, error: 'กรุณาเลือกเจ้าหน้าที่ผู้รับผิดชอบ' });
            }
            if (!supervisor_id) {
                return sendJson(res, 400, { success: false, error: 'กรุณาระบุหัวหน้างานผู้มอบหมาย' });
            }

            const reqRecord = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(requestId);
            if (!reqRecord) {
                return sendJson(res, 404, { success: false, error: 'ไม่พบคำร้องที่ระบุ' });
            }
            if (['CLOSED', 'CANCELLED'].includes(reqRecord.status_code)) {
                return sendJson(res, 400, { success: false, error: 'คำร้องนี้ปิดงานหรือถูกยกเลิกแล้ว ไม่สามารถมอบหมายได้' });
            }

            const staff = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'STAFF'").get(assigned_to_id);
            if (!staff) {
                return sendJson(res, 400, { success: false, error: 'เจ้าหน้าที่ที่เลือกไม่ถูกต้อง' });
            }

            const oldStatus = reqRecord.status_code;
            const newStatus = 'ASSIGNED';

            db.prepare(`
                UPDATE service_requests
                SET assigned_to_id = ?, status_code = ?, updated_at = datetime('now')
                WHERE id = ?
            `).run(assigned_to_id, newStatus, requestId);

            const noteText = notes && notes.trim() 
                ? `มอบหมายงานให้นาย/นางสาว ${staff.full_name}: ${notes.trim()}`
                : `มอบหมายงานให้นาย/นางสาว ${staff.full_name}`;

            db.prepare(`
                INSERT INTO request_histories (request_id, old_status, new_status, action, notes, changed_by_id, created_at)
                VALUES (?, ?, ?, 'ASSIGN', ?, ?, datetime('now'))
            `).run(requestId, oldStatus, newStatus, noteText, supervisor_id);

            return sendJson(res, 200, { success: true, message: 'มอบหมายงานให้เจ้าหน้าที่สำเร็จ' });
        }

        // 9. PUT /api/requests/:id/status (Update Status & Work Notes - FR-06, FR-07)
        const matchStatus = pathname.match(/^\/api\/requests\/(\d+)\/status$/);
        if (req.method === 'PUT' && matchStatus) {
            const requestId = Number(matchStatus[1]);
            const body = await parseJsonBody(req);
            const { new_status, changed_by_id, notes } = body;

            if (!new_status) {
                return sendJson(res, 400, { success: false, error: 'กรุณาระบุสถานะใหม่' });
            }
            if (!changed_by_id) {
                return sendJson(res, 400, { success: false, error: 'กรุณาระบุผู้ทำรายการ' });
            }

            const reqRecord = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(requestId);
            if (!reqRecord) {
                return sendJson(res, 404, { success: false, error: 'ไม่พบคำร้องที่ระบุ' });
            }

            // Terminal status check
            if (['CLOSED', 'CANCELLED'].includes(reqRecord.status_code)) {
                return sendJson(res, 400, { success: false, error: `คำร้องอยู่ในสถานะ ${reqRecord.status_code} ซึ่งเป็นสถานะสิ้นสุดแล้ว` });
            }

            // State transition validation (BR-02)
            const VALID_TRANSITIONS = {
                'NEW': ['ASSIGNED', 'CANCELLED'],
                'ASSIGNED': ['IN_PROGRESS', 'CANCELLED'],
                'IN_PROGRESS': ['RESOLVED', 'ASSIGNED'],
                'RESOLVED': ['CLOSED', 'IN_PROGRESS'],
                'CLOSED': [],
                'CANCELLED': []
            };

            if (!VALID_TRANSITIONS[reqRecord.status_code] || !VALID_TRANSITIONS[reqRecord.status_code].includes(new_status)) {
                return sendJson(res, 400, {
                    success: false,
                    error: `ไม่สามารถเปลี่ยนสถานะจาก ${reqRecord.status_code} เป็น ${new_status} ได้ตามลำดับขั้นตอนกระบวนการทำงาน`
                });
            }

            // Validation for RESOLVED status (Must require notes)
            if (new_status === 'RESOLVED' && (!notes || notes.trim().length < 5)) {
                return sendJson(res, 400, { success: false, error: 'การแก้ไขปัญหาเสร็จสิ้น (RESOLVED) ต้องระบุหมายเหตุ/วิธีการแก้ไขปัญหาอย่างน้อย 5 ตัวอักษร' });
            }

            let resolvedAt = reqRecord.resolved_at;
            let closedAt = reqRecord.closed_at;

            if (new_status === 'RESOLVED' && !resolvedAt) {
                resolvedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
            }
            if (new_status === 'CLOSED' && !closedAt) {
                closedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
            }

            db.prepare(`
                UPDATE service_requests
                SET status_code = ?, resolved_at = ?, closed_at = ?, updated_at = datetime('now')
                WHERE id = ?
            `).run(new_status, resolvedAt, closedAt, requestId);

            db.prepare(`
                INSERT INTO request_histories (request_id, old_status, new_status, action, notes, changed_by_id, created_at)
                VALUES (?, ?, ?, 'STATUS_CHANGE', ?, ?, datetime('now'))
            `).run(requestId, reqRecord.status_code, new_status, notes ? notes.trim() : null, changed_by_id);

            return sendJson(res, 200, { success: true, message: `เปลี่ยนสถานะเป็น ${new_status} เรียบร้อยแล้ว` });
        }

        // 10. POST /api/requests/:id/cancel (Requester Cancels - FR-09)
        const matchCancel = pathname.match(/^\/api\/requests\/(\d+)\/cancel$/);
        if (req.method === 'POST' && matchCancel) {
            const requestId = Number(matchCancel[1]);
            const body = await parseJsonBody(req);
            const { requester_id, reason } = body;

            const reqRecord = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(requestId);
            if (!reqRecord) {
                return sendJson(res, 404, { success: false, error: 'ไม่พบคำร้องที่ระบุ' });
            }

            // Only NEW or ASSIGNED can be cancelled
            if (['IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'].includes(reqRecord.status_code)) {
                return sendJson(res, 400, { success: false, error: `ไม่สามารถยกเลิกคำร้องที่อยู่ในสถานะ ${reqRecord.status_code} ได้` });
            }

            const cancelNote = reason && reason.trim() ? reason.trim() : 'ผู้แจ้งขอยกเลิกคำร้อง';

            db.prepare(`
                UPDATE service_requests
                SET status_code = 'CANCELLED', updated_at = datetime('now')
                WHERE id = ?
            `).run(requestId);

            db.prepare(`
                INSERT INTO request_histories (request_id, old_status, new_status, action, notes, changed_by_id, created_at)
                VALUES (?, ?, 'CANCELLED', 'CANCEL', ?, ?, datetime('now'))
            `).run(requestId, reqRecord.status_code, cancelNote, requester_id || reqRecord.requester_id);

            return sendJson(res, 200, { success: true, message: 'ยกเลิกคำร้องเรียบร้อยแล้ว' });
        }

        // 11. GET /api/queries/sql1 (โจทย์ SQL 1: ค้นหาสถานะ NEW)
        if (req.method === 'GET' && pathname === '/api/queries/sql1') {
            const sql1 = `
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
            `;
            const rows = db.prepare(sql1).all();
            return sendJson(res, 200, { success: true, query: sql1, data: rows });
        }

        // 12. GET /api/queries/sql2 (โจทย์ SQL 2: แสดงคำร้องแยกตาม Category)
        if (req.method === 'GET' && pathname === '/api/queries/sql2') {
            const sql2 = `
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
            `;
            const rows = db.prepare(sql2).all();
            return sendJson(res, 200, { success: true, query: sql2, data: rows });
        }

        // 13. GET /api/queries/sql3 (โจทย์ SQL 3: เพิ่มชื่อเจ้าหน้าที่จากคำร้องรับผิดชอบจากมากไปน้อย)
        if (req.method === 'GET' && pathname === '/api/queries/sql3') {
            const sql3 = `
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
            `;
            const rows = db.prepare(sql3).all();
            return sendJson(res, 200, { success: true, query: sql3, data: rows });
        }

        // 13. POST /api/reset-db (Reset to Seed Data for Interactive Testing)
        if (req.method === 'POST' && pathname === '/api/reset-db') {
            initializeDatabase();
            return sendJson(res, 200, { success: true, message: 'รีเซ็ตฐานข้อมูลเป็นค่าเริ่มต้นเรียบร้อยแล้ว' });
        }

        // -------------------------------------------------------------
        // STATIC FILE SERVING
        // -------------------------------------------------------------
        let safePath = pathname === '/' ? '/index.html' : pathname;
        let filePath = path.join(PUBLIC_DIR, safePath);

        if (!filePath.startsWith(PUBLIC_DIR)) {
            res.writeHead(403);
            return res.end('Forbidden');
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    // Fallback to index.html for SPA or 404
                    const indexPath = path.join(PUBLIC_DIR, 'index.html');
                    fs.readFile(indexPath, (indexErr, indexContent) => {
                        if (indexErr) {
                            res.writeHead(404);
                            return res.end('Not Found');
                        }
                        res.writeHead(200, {
                            'Content-Type': 'text/html; charset=utf-8',
                            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                            'Pragma': 'no-cache',
                            'Expires': '0'
                        });
                        res.end(indexContent);
                    });
                } else {
                    res.writeHead(500);
                    res.end('Server Error: ' + err.code);
                }
            } else {
                const ext = path.extname(filePath).toLowerCase();
                const contentType = MIME_TYPES[ext] || 'application/octet-stream';
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                });
                res.end(content);
            }
        });

    } catch (err) {
        console.error('API Error:', err);
        return sendJson(res, 500, { success: false, error: err.message });
    }
});

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`🎓 MFU IT Service Request Prototype running on:`);
        console.log(`👉 http://localhost:${PORT}`);
        console.log(`=======================================================`);
    });
}

module.exports = server;

