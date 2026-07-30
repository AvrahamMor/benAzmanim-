const fs = require('fs');
const path = './src/schedule.json';

const rawData = fs.readFileSync(path, 'utf8');
const schedule = JSON.parse(rawData);

const cat = 'בייגל';
const day = 'שישי';
const empName = 'שלמה מאור';

let removed = false;
for (let i = 0; i < 20; i++) {
  if (schedule[cat][day][i].employee === empName) {
    // Clear the slot
    schedule[cat][day][i].employee = '';
    schedule[cat][day][i].role = '';
    schedule[cat][day][i].start = '';
    schedule[cat][day][i].end = '';
    removed = true;
  }
}

if (removed) {
  fs.writeFileSync(path, JSON.stringify(schedule, null, 2), 'utf8');
  console.log(`Removed ${empName} from ${day}`);
} else {
  console.log(`Could not find ${empName} on ${day}`);
}
