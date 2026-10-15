const https = require('https');

function loginReq(identifier, password, role) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ identifier, password, role });
    const req = https.request('https://ats-project-backend.onrender.com/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('Testing Accounts on Live Render Backend:\n');

  // 1. New Demo Student
  const r1 = await loginReq('kavitha.demo@ats.edu', 'student123', 'student');
  console.log('1. kavitha.demo@ats.edu (New Demo Student):', r1.status, r1.body.message || (r1.body.success ? 'SUCCESS' : 'FAILED'));

  // 2. New Demo Faculty
  const r2 = await loginReq('senthil.demo@ats.edu', 'faculty123', 'faculty');
  console.log('2. senthil.demo@ats.edu (New Demo Faculty):', r2.status, r2.body.message || (r2.body.success ? 'SUCCESS' : 'FAILED'));

  // 3. New Demo HOD
  const r3 = await loginReq('anand.demo@ats.edu', 'hod123', 'hod');
  console.log('3. anand.demo@ats.edu (New Demo HOD):', r3.status, r3.body.message || (r3.body.success ? 'SUCCESS' : 'FAILED'));

  // 4. Original Seeded Student BITD0001
  const r4 = await loginReq('BITD0001', 'student123', 'student');
  console.log('4. BITD0001 (Original Seed Student):', r4.status, r4.body.success ? `SUCCESS - User: ${r4.body.user?.name}` : r4.body.message);

  // 5. Original Seeded Faculty FAC-CSE
  const r5 = await loginReq('FAC-CSE', 'faculty123', 'faculty');
  console.log('5. FAC-CSE (Original Seed Faculty):', r5.status, r5.body.success ? `SUCCESS - User: ${r5.body.user?.name}, Role: ${r5.body.user?.role}` : r5.body.message);

  // 6. Original Seeded Admin admin@ats.com
  const r6 = await loginReq('admin@ats.com', 'admin123', 'admin');
  console.log('6. admin@ats.com (Original Seed Admin):', r6.status, r6.body.success ? `SUCCESS - User: ${r6.body.user?.name}` : r6.body.message);
}

run().catch(console.error);
