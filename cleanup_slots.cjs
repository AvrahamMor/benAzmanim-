const fs = require('fs');
const path = require('path');

const schedulePath = path.join(__dirname, 'src', 'schedule.json');
const data = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));

Object.keys(data).forEach(category => {
  const days = Object.keys(data[category]);
  days.forEach(day => {
    let shifts = data[category][day];
    
    // We want to trim empty shifts from the end to avoid bloat.
    // However, if we trim from the middle we might mess up "align_restaurant" rows.
    // The safest way is to just keep shifts that have an employee or role, PLUS a few empty ones for padding.
    // Actually, because of "align_restaurant", indices 0-8 are mapped for restaurant.
    // Let's just remove shifts after index 9 that are completely empty.
    
    for (let i = shifts.length - 1; i >= 10; i--) {
      if (!shifts[i].employee && !shifts[i].role) {
        shifts.splice(i, 1);
      }
    }
    data[category][day] = shifts;
  });
});

fs.writeFileSync(schedulePath, JSON.stringify(data, null, 2) + '\n');
console.log('Successfully cleaned up excess slots.');
