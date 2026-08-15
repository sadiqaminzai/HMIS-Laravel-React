const fs = require('fs');
let code = fs.readFileSync('src/app/components/AttendanceManagement.tsx', 'utf8');

// The overall bulk grid
code = code.replace(
  '<h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Bulk Configuration</h3>\\n                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">',
  '<h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Bulk Configuration</h3>\\n                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">'
);
// Hmm replace might fail with exact whitespace, let's use regex:
code = code.replace(
  /className="grid grid-cols-1 md:grid-cols-2 gap-4"/,
  'className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"'
);

// We need to drop "Status" since it's redundant here!
code = code.replace(/<div>[\s\S]*?<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1\.5">Status<\/label>[\s\S]*?<\/select>\s*<\/div>/, '');

/* We want to make the child divs span nicely for 6 columns grid!
Department: col-span-1 sm:col-span-2
Shift: col-span-1 sm:col-span-2
Attendance Date: col-span-1 sm:col-span-2
Check In Time: col-span-1 sm:col-span-3
Check Out Time: col-span-1 sm:col-span-3
Notes: col-span-1 sm:col-span-6
Table: col-span-1 sm:col-span-6 
*/

// Department column wrap:
code = code.replace(/<div>\s*<label[^>]+>Department<\/label>\s*<select[^>]+title="Bulk department"/, 
  '<div className="sm:col-span-2">\\n                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Department</label>\\n                <select title="Bulk department"');

// Shift column wrap:
code = code.replace(/<div>\s*<label[^>]+>Shift<\/label>\s*<select[^>]+title="Bulk shift"/, 
  '<div className="sm:col-span-2">\\n                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Shift</label>\\n                <select title="Bulk shift"');

// Date column wrap:
code = code.replace(/<div>\s*<label[^>]+>Attendance Date<\/label>\s*<input[^>]+title="Bulk attendance date"/, 
  '<div className="sm:col-span-2">\\n                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Attendance Date</label>\\n                <input title="Bulk attendance date"');

// Check In Time column wrap:
code = code.replace(/<div>\s*<label[^>]+>Check In Time<\/label>\s*<input[^>]+title="Bulk check-in time"/, 
  '<div className="sm:col-span-3">\\n                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Check In Time</label>\\n                <input title="Bulk check-in time"');

// Check Out Time column wrap:
code = code.replace(/<div>\s*<label[^>]+>Check Out Time<\/label>\s*<input[^>]+title="Bulk check-out time"/, 
  '<div className="sm:col-span-3">\\n                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Check Out Time</label>\\n                <input title="Bulk check-out time"');

// Notes column wrap:
code = code.replace(/<div className="md:col-span-2">\s*<label[^>]+>Notes<\/label>\s*<textarea[^>]+title="Bulk attendance notes"/, 
  '<div className="sm:col-span-6 lg:col-span-6">\\n                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>\\n                <textarea title="Bulk attendance notes"');

// The Table wrapper:
code = code.replace(/<div className="md:col-span-2 space-y-2">/, '<div className="sm:col-span-6 lg:col-span-6 space-y-2">');

fs.writeFileSync('src/app/components/AttendanceManagement.tsx', code);
console.log('Patched');