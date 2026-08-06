const fs = require('fs');
const path = require('path');

const schedulePath = path.join(__dirname, 'src', 'schedule.json');
const data = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));

if (!data['מטבח']) {
  data['מטבח'] = {};
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'מוצ"ש'];
  days.forEach(day => {
    data['מטבח'][day] = [];
    for(let i=0; i<5; i++) {
      data['מטבח'][day].push({ employee: "", role: "", start: "10:00", end: "17:00" });
    }
    for(let i=0; i<10; i++) {
      data['מטבח'][day].push({ employee: "", role: "", start: "17:00", end: "01:00" });
    }
  });
  fs.writeFileSync(schedulePath, JSON.stringify(data, null, 2) + '\n');
  console.log('Added מטבח successfully.');
} else {
  console.log('מטבח already exists.');
}
