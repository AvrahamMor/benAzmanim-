const fs = require('fs');
const CATEGORIES = ['בייגל', 'יריד אוכל מוכן', 'מסעדה', 'מטבח', 'מארחות'];
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'מוצ"ש'];
const SLOTS_PER_DAY = 20;

const shifts = {};
CATEGORIES.forEach(cat => {
  shifts[cat] = {};
  DAYS.forEach(day => {
    shifts[cat][day] = Array(SLOTS_PER_DAY).fill(null).map((_, i) => {
      let defaultStart = '';
      let defaultEnd = '';
      if (i < 3) { defaultStart = '07:00'; defaultEnd = '17:00'; }
      else if (i >= 3 && i < 6) { defaultStart = '17:00'; defaultEnd = '00:00'; }
      return { employee: '', role: '', start: defaultStart, end: defaultEnd };
    });
  });
});

fs.writeFileSync('src/schedule.json', JSON.stringify(shifts, null, 2), 'utf8');
fs.writeFileSync('src/staff.json', JSON.stringify([], null, 2), 'utf8');
console.log('JSON files generated');
