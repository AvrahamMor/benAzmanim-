const fs = require('fs');
const path = require('path');

const schedulePath = path.join(__dirname, 'src', 'schedule.json');
const data = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));

// We want to add more empty slots. 
// For each day in each category, if length is less than 40, add empty slots.
Object.keys(data).forEach(category => {
  const days = Object.keys(data[category]);
  days.forEach(day => {
    const shifts = data[category][day];
    
    // Check how many we have. Let's add 5 morning and 10 evening slots.
    // Default morning: 10:00 - 17:00, evening: 17:00 - 01:00
    for(let i=0; i<5; i++) {
      shifts.push({ employee: "", role: "", start: "10:00", end: "17:00" });
    }
    for(let i=0; i<10; i++) {
      shifts.push({ employee: "", role: "", start: "17:00", end: "01:00" });
    }
  });
});

fs.writeFileSync(schedulePath, JSON.stringify(data, null, 2) + '\n');
console.log('Successfully expanded slots for all departments.');
