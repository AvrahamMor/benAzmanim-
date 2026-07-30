const fs = require('fs');
const path = require('path');

const schedulePath = path.join(__dirname, 'src', 'schedule.json');
const data = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));

const restaurant = data['מסעדה'];
const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];

if (restaurant) {
  for (const day of days) {
    if (restaurant[day]) {
      // 1. Assign Evyatar to morning shift
      let foundMorning = false;
      for (const shift of restaurant[day]) {
        if (shift.start === "10:00" && !shift.employee) {
          shift.employee = "אביתר";
          foundMorning = true;
          break;
        }
      }

      // 2. Assign Noam Hadad to evening shift
      let foundEvening1 = false;
      for (const shift of restaurant[day]) {
        if (shift.start === "17:00" && !shift.employee) {
          shift.employee = "נועם חדד";
          foundEvening1 = true;
          break;
        }
      }

      // 3. Assign Meir Israel to evening shift
      let foundEvening2 = false;
      for (const shift of restaurant[day]) {
        if (shift.start === "17:00" && !shift.employee) {
          shift.employee = "מאיר ישראל";
          foundEvening2 = true;
          break;
        }
      }
    }
  }

  fs.writeFileSync(schedulePath, JSON.stringify(data, null, 2) + '\n');
  console.log('Successfully scheduled Evyatar, Noam Hadad, and Meir Israel.');
} else {
  console.log('Restaurant not found in data.');
}
