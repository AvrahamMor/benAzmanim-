const fs = require('fs');

// 1. Update staff.json
const staffPath = './src/staff.json';
const staffRaw = fs.readFileSync(staffPath, 'utf8');
const staffList = JSON.parse(staffRaw);

const empName = 'שלמה מאור';
staffList.push({
  id: Date.now(),
  name: empName
});
fs.writeFileSync(staffPath, JSON.stringify(staffList, null, 2), 'utf8');
console.log('Added שלמה מאור to staff.json');

// 2. Update schedule.json
const schedPath = './src/schedule.json';
const schedRaw = fs.readFileSync(schedPath, 'utf8');
const schedule = JSON.parse(schedRaw);

const cat = 'בייגל';
const role = 'פס קר';
const eveningStart = '16:00';
const eveningEnd = '01:00';

function scheduleShift(day) {
  let assigned = false;
  // Evening slots are 10 to 19 in our logical pool
  for (let i = 10; i < 20; i++) {
    if (!schedule[cat][day][i].employee) {
      schedule[cat][day][i].employee = empName;
      schedule[cat][day][i].role = role;
      schedule[cat][day][i].start = eveningStart;
      schedule[cat][day][i].end = eveningEnd;
      assigned = true;
      break;
    }
  }
  if (!assigned) console.log(`Could not find empty evening slot for ${day}`);
}

['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'מוצ"ש'].forEach(day => {
  scheduleShift(day);
});

fs.writeFileSync(schedPath, JSON.stringify(schedule, null, 2), 'utf8');
console.log('Schedule updated for שלמה מאור');
