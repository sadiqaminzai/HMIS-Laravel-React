const fs = require('fs');

let emp = fs.readFileSync('src/app/components/EmployeeManagement.tsx', 'utf8');
emp = emp.replace(
  /<div>\s*<label[^>]+>Status<\/label>\s*<select\s+value=\{formData\.status\}/g,
  '<div className="md:col-span-2">\n                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Status</label>\n                    <select\n                      value={formData.status}'
);
fs.writeFileSync('src/app/components/EmployeeManagement.tsx', emp);

let att = fs.readFileSync('src/app/components/AttendanceManagement.tsx', 'utf8');
att = att.replace(
  /<div className="md:col-span-2">\s*<label[^>]+>Department<\/label>\s*<select/g,
  '<div>\n                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Department</label>\n                <select'
);
att = att.replace(
  /<div className="md:col-span-2">\s*<label[^>]+>Employee<\/label>\s*<select/g,
  '<div>\n                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Employee</label>\n                <select'
);
att = att.replace(
  /<div className="md:col-span-2">\s*<label[^>]+>Shift<\/label>\s*<select/g,
  '<div>\n                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Shift</label>\n                <select'
);
fs.writeFileSync('src/app/components/AttendanceManagement.tsx', att);
console.log('Fixed HR forms!');
