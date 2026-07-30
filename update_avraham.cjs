const fs = require('fs');
const path = './src/schedule.json';

const rawData = fs.readFileSync(path, 'utf8');
const schedule = JSON.parse(rawData);

const cat = 'בייגל';
const role = 'פס קר';
const emp = 'אברהם (חזי)';
const morningStart = '07:00';
const morningEnd = '16:00';
const eveningStart = '16:00';
const eveningEnd = '01:00';

function scheduleShift(day, timeOfDay) {
  let start, end, startIndex, endIndex;
  if (timeOfDay === 'morning') {
    start = morningStart;
    end = morningEnd;
    startIndex = 0;
    endIndex = 10;
  } else {
    start = eveningStart;
    end = eveningEnd;
    startIndex = 3;
    endIndex = 20;
  }

  // Find first empty slot in the preferred range
  let assigned = false;
  for (let i = startIndex; i < endIndex; i++) {
    if (!schedule[cat][day][i].employee) {
      schedule[cat][day][i].employee = emp;
      schedule[cat][day][i].role = role;
      schedule[cat][day][i].start = start;
      schedule[cat][day][i].end = end;
      assigned = true;
      break;
    }
  }
  if (!assigned) console.log(`Could not find empty slot for ${day} ${timeOfDay}`);
}

// 1. מוצ"ש: לילה
scheduleShift('מוצ"ש', 'evening');

// 2. ראשון: כפולה
scheduleShift('ראשון', 'morning');
scheduleShift('ראשון', 'evening');

// 3. שני: בוקר רגיל 
scheduleShift('שני', 'morning');

// 4. שלישי: כפולה
scheduleShift('שלישי', 'morning');
scheduleShift('שלישי', 'evening');

// 5. רביעי: בוקר
scheduleShift('רביעי', 'morning');

// 6. חמישי: כפולה
scheduleShift('חמישי', 'morning');
scheduleShift('חמישי', 'evening');

// 7. שישי: בוקר
scheduleShift('שישי', 'morning');

fs.writeFileSync(path, JSON.stringify(schedule, null, 2), 'utf8');
console.log('Schedule updated for אברהם (חזי)');
