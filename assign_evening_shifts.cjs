const fs = require('fs');
const path = require('path');

const schedulePath = path.join(__dirname, 'src', 'schedule.json');
const data = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
const restaurant = data['מסעדה'];

const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי']; // Friday and Motzash are off

function assignEvening(day, employee) {
  let assigned = false;
  
  // First, try to find an existing empty 17:00 slot
  for (const shift of restaurant[day]) {
    if (shift.start === "17:00" && !shift.employee) {
      shift.employee = employee;
      assigned = true;
      break;
    }
  }
  
  // If not found, use a completely empty slot and set its times to evening
  if (!assigned) {
    for (const shift of restaurant[day]) {
      if (shift.start === "" && !shift.employee) {
        shift.start = "17:00";
        shift.end = "01:00";
        shift.employee = employee;
        assigned = true;
        break;
      }
    }
  }
  
  if (!assigned) {
    console.warn(`Could not assign ${employee} on ${day} - no empty slots left!`);
  }
}

// 1. אסף דבוש - כל השבוע ערב במסעדה
days.forEach(day => assignEvening(day, 'אסף דבוש'));

// 2. אוראל לגזיאל - כל השבוע ערב במסעדה חוץ מ שני
days.forEach(day => {
  if (day !== 'שני') {
    assignEvening(day, 'אוראל לגזיאל');
  }
});

// 3. אליה עזרא - בשלישי רבעי וחמישי במסעדה בערב
['שלישי', 'רביעי', 'חמישי'].forEach(day => assignEvening(day, 'אליה עזרא'));

// 4. יוסף - כל השבוע ערב במסעדה
days.forEach(day => assignEvening(day, 'יוסף'));

fs.writeFileSync(schedulePath, JSON.stringify(data, null, 2) + '\n');
console.log('Assignments completed successfully.');
