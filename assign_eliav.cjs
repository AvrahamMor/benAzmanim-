const fs = require('fs');
const path = require('path');

const schedulePath = path.join(__dirname, 'src', 'schedule.json');
const data = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
const restaurant = data['מסעדה'];

// כל השבוע חוץ משני (ובמסעדה גם אין שישי ומוצ"ש)
const days = ['ראשון', 'שלישי', 'רביעי', 'חמישי']; 

// נקצה לאליהב שריקי את אינדקס 9 כדי שיישאר באותה שורה תמיד
const eliavIndex = 9;

days.forEach(day => {
  if (restaurant[day] && restaurant[day][eliavIndex]) {
    restaurant[day][eliavIndex].start = "17:00";
    restaurant[day][eliavIndex].end = "01:00";
    restaurant[day][eliavIndex].employee = "אליהב שריקי";
  }
});

fs.writeFileSync(schedulePath, JSON.stringify(data, null, 2) + '\n');
console.log('Assigned Eliav Shriki successfully.');
