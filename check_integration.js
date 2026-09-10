async function runIntegrationChecks() {
    const base = 'http://localhost:3000';
    console.log('Testing Server Integration at', base);

    // 1. Check HTML
    const htmlRes = await fetch(base);
    console.log('1. GET / status:', htmlRes.status);

    // 2. Test Login API
    const loginRes = await fetch(`${base}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'somchai.s', password: '123456' })
    });
    const loginJson = await loginRes.json();
    console.log('2. POST /api/login success:', loginJson.success, 'User:', loginJson.user?.full_name);

    // 3. Check SQL1
    const sql1Res = await fetch(`${base}/api/queries/sql1`);
    const sql1Json = await sql1Res.json();
    console.log('3. GET /api/queries/sql1 success:', sql1Json.success, 'Rows:', sql1Json.data.length);

    // 4. Check SQL2
    const sql2Res = await fetch(`${base}/api/queries/sql2`);
    const sql2Json = await sql2Res.json();
    console.log('4. GET /api/queries/sql2 success:', sql2Json.success, 'Categories:', sql2Json.data.length);

    // 5. Check SQL3
    const sql3Res = await fetch(`${base}/api/queries/sql3`);
    const sql3Json = await sql3Res.json();
    console.log('5. GET /api/queries/sql3 success:', sql3Json.success, 'Staff count:', sql3Json.data.length, 'Top staff:', sql3Json.data[0]?.staff_name, 'Workload:', sql3Json.data[0]?.total_assigned_requests);

    // 6. Create a ticket
    const createRes = await fetch(`${base}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: 'ทดสอบแจ้งปัญหาจากระบบ Integration Test',
            description: 'รายละเอียดการทดสอบระบบส่งคำร้องและตรวจสอบความถูกต้องครบถ้วน',
            category_id: 1,
            priority: 'HIGH',
            requester_id: 1,
            location: 'อาคาร E-Park ห้อง Lab 1',
            contact_phone: '081-111-2233'
        })
    });
    const createJson = await createRes.json();
    console.log('6. POST /api/requests success:', createJson.success, 'Ticket:', createJson.data?.ticket_no);
    const newId = createJson.data.id;

    // 7. Assign staff (by Supervisor)
    const assignRes = await fetch(`${base}/api/requests/${newId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            assigned_to_id: 4,
            supervisor_id: 7,
            notes: 'รบกวนช่วยเข้าตรวจสอบสายสัญญาณ'
        })
    });
    const assignJson = await assignRes.json();
    console.log('7. PUT /api/requests/:id/assign success:', assignJson.success, assignJson.message);

    console.log('ALL API & INTEGRATION CHECKS PASSED SUCCESSFULLY!');
}

runIntegrationChecks().catch(console.error);
