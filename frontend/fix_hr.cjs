const fs = require('fs');

const empFile = 'src/app/components/EmployeeManagement.tsx';
let emp = fs.readFileSync(empFile, 'utf8');
emp = emp.replace(
  /<div([^>]+)>[\s]*<label[^>]+>Status<\/label>[\s]*<select[\s]+value=\{formData\.status\}/g,
  '<div className="md:col-span-2">\n                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Status</label>\n                    <select\n                      value={formData.status}'
);
fs.writeFileSync(empFile, emp);

const attFile = 'src/app/components/AttendanceManagement.tsx';
let att = fs.readFileSync(attFile, 'utf8');
att = att.replace(
  /<div className="md:col-span-2">\s*<label[^>]+>Shift<\/label>/,
  '<div>\n                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Shift</label>'
);
fs.writeFileSync(attFile, att);

console.log('Fixed HR layouts');