const fs = require('fs');
const path = require('path');

const schedulePath = path.join(__dirname, 'src', 'schedule.json');
const data = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
const restaurant = data['מסעדה'];
const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'מוצ"ש'];

const employeeIndexMap = {
  "ישי אביטל": 0,
  "אביתר": 1,
  // index 2 is empty morning slot
  "נועם חדד": 3,
  "מאיר ישראל": 4,
  "אסף דבוש": 5,
  "אוראל לגזיאל": 6,
  "אליה עזרא": 7,
  "יוסף": 8
};

days.forEach(day => {
  if (!restaurant[day]) return;
  
  const oldShifts = [...restaurant[day]];
  // Create 20 empty slots
  const newShifts = Array(20).fill(null).map(() => ({ employee: "", role: "", start: "", end: "" }));
  
  // Setup default times for the known slots so that if they are empty, they render correctly in their section
  for(let i=0; i<=2; i++) {
    newShifts[i].start = "10:00"; newShifts[i].end = "17:00";
  }
  for(let i=3; i<=15; i++) {
    newShifts[i].start = "17:00"; newShifts[i].end = "01:00";
  }
  
  let unmappedCount = 9;
  
  oldShifts.forEach(shift => {
    if (shift.employee) {
      if (employeeIndexMap.hasOwnProperty(shift.employee)) {
        const idx = employeeIndexMap[shift.employee];
        newShifts[idx] = { ...shift };
      } else {
        if (unmappedCount < 20) {
          newShifts[unmappedCount] = { ...shift };
          unmappedCount++;
        }
      }
    }
  });
  
  restaurant[day] = newShifts;
});

fs.writeFileSync(schedulePath, JSON.stringify(data, null, 2) + '\n');
console.log('Restaurant shifts aligned perfectly!');
