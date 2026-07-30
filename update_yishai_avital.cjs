const fs = require('fs');
const path = require('path');

const schedulePath = path.join(__dirname, 'src', 'schedule.json');
const data = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));

const restaurant = data['מסעדה'];
const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];

if (restaurant) {
  for (const day of days) {
    if (restaurant[day]) {
      // Find the first empty morning shift (start time "10:00" and no employee assigned)
      // If there are morning shifts, they are typically the ones with start "10:00"
      let found = false;
      for (const shift of restaurant[day]) {
        if (shift.start === "10:00" && !shift.employee) {
          shift.employee = "ישי אביטל";
          found = true;
          break; // Assigned one shift for this day
        }
      }
      
      // If no empty morning shift found, maybe just assign the first slot if it's completely empty?
      if (!found) {
         for (const shift of restaurant[day]) {
             if (shift.start === "10:00") {
                 console.log(`Warning: No empty morning shift found for ${day}. All morning slots are taken.`);
             }
         }
      }
    }
  }

  fs.writeFileSync(schedulePath, JSON.stringify(data, null, 2) + '\n');
  console.log('Successfully scheduled Yishai Avital for morning shifts.');
} else {
  console.log('Restaurant not found in data.');
}
