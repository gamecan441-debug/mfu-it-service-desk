const { getDatabase } = require('./db.js');
const db = getDatabase();

console.log('=== SQL 1: Requests with status NEW ===');
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
const results1 = db.prepare(sql1).all();
console.table(results1);

console.log('\n=== SQL 2: Requests aggregated by Category ===');
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
const results2 = db.prepare(sql2).all();
console.table(results2);

console.log('\n=== SQL 3: Staff ranked by assigned requests count (DESC) ===');
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
const results3 = db.prepare(sql3).all();
console.table(results3);
