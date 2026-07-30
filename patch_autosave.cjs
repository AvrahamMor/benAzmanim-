const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src', 'App.jsx');
let appCode = fs.readFileSync(appPath, 'utf8');

// 1. Remove localStorage initialization for shifts
appCode = appCode.replace(
  /const \[shifts, setShifts\] = useState\(\(\) => \{[\s\S]*?\}\);/,
  `const [shifts, setShifts] = useState(initialSchedule);`
);

// 2. We need a helper to send the POST request whenever shifts change
// We can just add a useEffect that listens for changes to \`shifts\` and auto-saves it.
// However, since we do \`setShifts(initialSchedule)\` on hot reload, we don't want to save on initial mount.
// It's safer to patch updateShift and clearSlot.
// Let's find updateShift.
const autoSaveCode = `
    fetch('/api/save-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newShifts)
    }).catch(e => console.error('Failed to auto-save:', e));
`;

if (!appCode.includes("fetch('/api/save-schedule'")) {
  appCode = appCode.replace(
    /const updateShift = \(category, day, index, field, value\) => \{[\s\S]*?return newShifts;\n    \}\);/,
    `const updateShift = (category, day, index, field, value) => {
    setShifts(prev => {
      const newShifts = { ...prev };
      const newDayList = [...newShifts[category][day]];
      newDayList[index] = { ...newDayList[index], [field]: value };
      newShifts[category] = { ...newShifts[category], [day]: newDayList };
      
      // Auto-save
      fetch('/api/save-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShifts)
      }).catch(e => console.error('Failed to auto-save:', e));
      
      return newShifts;
    });`
  );

  appCode = appCode.replace(
    /const clearSlot = \(category, day, index\) => \{[\s\S]*?return newShifts;\n    \}\);/,
    `const clearSlot = (category, day, index) => {
    setShifts(prev => {
      const newShifts = { ...prev };
      const newDayList = [...newShifts[category][day]];
      
      let defaultStart = '';
      let defaultEnd = '';
      if (day === 'מוצ"ש') {
        defaultStart = '21:00';
        defaultEnd = '01:00';
      } else {
        if (index < 3) {
          defaultStart = '10:00';
          defaultEnd = '17:00';
        } else if (index >= 3 && index < 16) {
          defaultStart = '17:00';
          defaultEnd = '01:00';
        }
      }

      newDayList[index] = { employee: '', role: '', start: defaultStart, end: defaultEnd };
      newShifts[category] = { ...newShifts[category], [day]: newDayList };
      
      // Auto-save
      fetch('/api/save-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShifts)
      }).catch(e => console.error('Failed to auto-save:', e));
      
      return newShifts;
    });`
  );
}

fs.writeFileSync(appPath, appCode);
console.log('Patched App.jsx with Auto-Save logic.');
