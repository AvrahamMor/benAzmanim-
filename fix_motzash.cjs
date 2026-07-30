const fs = require('fs');
const path = './src/schedule.json';

const rawData = fs.readFileSync(path, 'utf8');
const schedule = JSON.parse(rawData);

// Update all motzash shifts to be 21:00 to 01:00
Object.keys(schedule).forEach(cat => {
  if (schedule[cat]['מוצ"ש']) {
    for (let i = 0; i < 20; i++) {
      let slot = schedule[cat]['מוצ"ש'][i];
      if (slot.employee || slot.role) {
        // If they were put in morning, maybe clear them or just fix their time
        slot.start = '21:00';
        slot.end = '01:00';
      }
    }
  }
});

fs.writeFileSync(path, JSON.stringify(schedule, null, 2), 'utf8');
console.log('Fixed Motzash times');
