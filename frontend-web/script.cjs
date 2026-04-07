const fs = require('fs');
const path = 'src/app/components/LabTestManagementNew.tsx';
const content = fs.readFileSync(path, 'utf8');

const startStr = '<div className="p-4 space-y-3">';
const endStr = '<div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">';

const start = content.lastIndexOf(startStr, content.indexOf('New Lab Test Order'));
const actualStart = content.indexOf(startStr, content.indexOf('New Lab Test Order'));
const end = content.indexOf(endStr, actualStart);

const oldString = content.slice(actualStart, end);
fs.writeFileSync('oldString.txt', oldString);
console.log('done saving');
