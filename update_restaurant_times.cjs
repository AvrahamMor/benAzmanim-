const fs = require('fs');
const path = require('path');

const schedulePath = path.join(__dirname, 'src', 'schedule.json');
const data = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));

const restaurant = data['מסעדה'];
const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'מוצ"ש'];

if (restaurant) {
  for (const day of days) {
    if (day === 'שישי' || day === 'מוצ"ש') {
      if (restaurant[day]) {
        restaurant[day].forEach(shift => {
          shift.employee = "";
          shift.role = "";
          shift.start = "";
          shift.end = "";
        });
      }
    } else {
      if (restaurant[day]) {
        restaurant[day].forEach(shift => {
          if (shift.start === "07:00" || shift.start === "10:00") {
            shift.start = "10:00";
            shift.end = "17:00";
          } else if (shift.start === "17:00" || shift.start === "16:00") {
            shift.start = "17:00";
            shift.end = "01:00";
          }
        });
      }
    }
  }

  fs.writeFileSync(schedulePath, JSON.stringify(data, null, 2) + '\n');
  console.log('Successfully updated restaurant schedule.');
} else {
  console.log('Restaurant not found in data.');
}
