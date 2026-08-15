const fs = require('fs');
const file = 'src/app/components/PatientManagement.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix print styles
content = content.replace(/width: 86mm; height: 54mm; display: flex !important;\s*background: white;\s*box-shadow: none;\s*display: block !important;\s*border: none;/g, 
  'width: 86mm; height: 54mm; display: flex !important; background: white; padding: 0; box-shadow: none; border: none; overflow: hidden;');

// Remove any padding 4mm inside that block if any
content = content.replace(/padding: 4mm;\s*width: 86mm;/g, 'padding: 0; margin: 0; width: 86mm;');

fs.writeFileSync(file, content);
console.log('Fixed CSS');
