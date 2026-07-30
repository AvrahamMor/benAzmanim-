const fs = require('fs');
const path = './src/schedule.json';

const rawData = fs.readFileSync(path, 'utf8');
const schedule = JSON.parse(rawData);

const cat = 'בייגל';
const role = 'פס קר';
const emp = 'שלום';
const eveningStart = '16:00';
const eveningEnd = '01:00';

function scheduleShift(day) {
  let assigned = false;
  // Evening slots are 3 to 20
  for (let i = 3; i < 20; i++) {
    if (!schedule[cat][day][i].employee) {
      schedule[cat][day][i].employee = emp;
      schedule[cat][day][i].role = role;
      schedule[cat][day][i].start = eveningStart;
      schedule[cat][day][i].end = eveningEnd;
      assigned = true;
      break;
    }
  }
  if (!assigned) console.log(`Could not find empty evening slot for ${day}`);
}

scheduleShift('שני');
scheduleShift('שלישי');
scheduleShift('רביעי');
scheduleShift('חמישי');

fs.writeFileSync(path, JSON.stringify(schedule, null, 2), 'utf8');
console.log('Schedule updated for שלום');
