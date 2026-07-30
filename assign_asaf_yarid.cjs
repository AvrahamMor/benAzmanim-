const fs = require('fs');
const path = require('path');

const schedulePath = path.join(__dirname, 'src', 'schedule.json');
const data = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
const category = 'יריד אוכל מוכן';
const targetDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];

targetDays.forEach(day => {
  // Ensure we have at least 1 shift
  if (!data[category][day] || data[category][day].length === 0) {
    data[category][day] = [{ employee: '', role: '', start: '', end: '' }];
  }
  
  // Assign Asaf to the first slot for the morning shift.
  // Morning shifts typically use default hours 10:00 - 17:00
  data[category][day][0].employee = 'אסף דבוש';
  data[category][day][0].start = '10:00';
  data[category][day][0].end = '17:00';
});

fs.writeFileSync(schedulePath, JSON.stringify(data, null, 2) + '\n');
console.log('Successfully assigned Asaf Dabush to Food Fair morning shifts.');
