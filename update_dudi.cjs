const fs = require('fs');
const path = './src/schedule.json';

const rawData = fs.readFileSync(path, 'utf8');
const schedule = JSON.parse(rawData);

const cat = 'בייגל';
const role = ''; // Not specified
const emp = 'דודי(חזי)';
const morningStart = '07:00';
const morningEnd = '16:00';

function scheduleShift(day) {
  let assigned = false;
  // Morning slots are 0 to 9 in our logical pool (based on index)
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

['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'].forEach(day => {
  scheduleShift(day);
});

fs.writeFileSync(path, JSON.stringify(schedule, null, 2), 'utf8');
console.log('Schedule updated for דודי(חזי)');
