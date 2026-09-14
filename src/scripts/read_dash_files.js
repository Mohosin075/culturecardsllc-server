const fs = require('fs');
const path = require('path');

const partnersPage = fs.readFileSync('D:/Mohosin/projects/dashboard/culture_dash/app/(dashboard)/partners/page.tsx', 'utf8');
console.log('=== PARTNERS PAGE ===\n');
console.log(partnersPage);

const partnerDashPage = fs.readFileSync('D:/Mohosin/projects/dashboard/culture_dash/app/partner/dashboard/page.tsx', 'utf8');
console.log('\n=== PARTNER DASHBOARD PAGE ===\n');
console.log(partnerDashPage);
