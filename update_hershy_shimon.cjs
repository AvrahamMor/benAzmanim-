const fs = require('fs');
const path = './src/schedule.json';

const rawData = fs.readFileSync(path, 'utf8');
const schedule = JSON.parse(rawData);

const cat = 'בייגל';
const role = 'מנהל משמרת';
const morningStart = '07:00';
const morningEnd = '16:00';
const eveningStart = '16:00';
const eveningEnd = '01:00';

function scheduleShift(emp, day, timeOfDay) {
  let start, end, startIndex, endIndex;
  if (timeOfDay === 'morning') {
    start = morningStart;
    end = morningEnd;
    startIndex = 0;
    endIndex = 10;
  } else {
    start = eveningStart;
    end = eveningEnd;
    startIndex = 10; // based on our earlier division
    endIndex = 20;
  }

  let assigned = false;
  // Let's try slots 0 to 19 and see if start matches or is empty
  for (let i = 0; i < 20; i++) {
    // If it's an empty slot or has no employee
    if (!schedule[cat][day][i].employee) {
      // make sure it's the right pool based on our sorting logic
      // In App.jsx: index < 10 is morning pool for empty.
      if (timeOfDay === 'morning' && i >= 10) continue;
      if (timeOfDay === 'evening' && i < 10) continue;

      schedule[cat][day][i].employee = emp;
      schedule[cat][day][i].role = role;
      schedule[cat][day][i].start = start;
      schedule[cat][day][i].end = end;
      assigned = true;
      break;
    }
  }
  if (!assigned) console.log(`Could not find empty slot for ${emp} on ${day} ${timeOfDay}`);
}

// הרשי בלומברג
const empHershy = 'הרשי בלומברג';
['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'].forEach(day => {
  scheduleShift(empHershy, day, 'evening');
});
scheduleShift(empHershy, 'שישי', 'morning');

// שמעון עזרא
const empShimon = 'שמעון עזרא';
scheduleShift(empShimon, 'מוצ"ש', 'evening');

fs.writeFileSync(path, JSON.stringify(schedule, null, 2), 'utf8');
console.log('Schedule updated for Hershy and Shimon');
