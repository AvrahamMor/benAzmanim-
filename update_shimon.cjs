const fs = require('fs');
const path = './src/schedule.json';

const rawData = fs.readFileSync(path, 'utf8');
const schedule = JSON.parse(rawData);

const cat = 'בייגל';
const role = 'מנהל משמרת';
const emp = 'שמעון עזרא';
const morningStart = '07:00';
const morningEnd = '16:00';

function scheduleShift(day) {
  let assigned = false;
  // Morning slots are 0 to 9
  for (let i = 0; i < 10; i++) {
    if (!schedule[cat][day][i].employee) {
      schedule[cat][day][i].employee = emp;
      schedule[cat][day][i].role = role;
      schedule[cat][day][i].start = morningStart;
      schedule[cat][day][i].end = morningEnd;
      assigned = true;
      break;
    }
  }
  if (!assigned) console.log(`Could not find empty morning slot for ${day}`);
}

scheduleShift('ראשון');
scheduleShift('שלישי');
scheduleShift('חמישי');

fs.writeFileSync(path, JSON.stringify(schedule, null, 2), 'utf8');
console.log('Schedule updated for שמעון עזרא');
