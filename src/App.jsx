import html2canvas from 'html2canvas';
import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar, Clock, User, Briefcase, Trash2, Users, LayoutDashboard, Utensils, Coffee, Store, Plus, Save, Moon, Sun, Download, History, ChefHat, CheckCircle, UserCheck } from 'lucide-react';
import initialSchedule from './schedule.json';
import initialStaff from './staff.json';
import './App.css';

const CATEGORIES = ['בייגל', 'יריד אוכל מוכן', 'מסעדה', 'מטבח', 'מארחות'];
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'מוצ"ש'];

// Helper to parse HH:MM into minutes from midnight
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

// Helper to check time overlap between two shifts on the same day
function isTimeOverlapping(startAStr, endAStr, startBStr, endBStr) {
  if (!startAStr || !endAStr || !startBStr || !endBStr) return false;
  if (startAStr === endAStr || startBStr === endBStr) return false;
  
  let startA = parseTimeToMinutes(startAStr);
  let endA = parseTimeToMinutes(endAStr);
  if (endA <= startA) endA += 24 * 60; // Spans across midnight

  let startB = parseTimeToMinutes(startBStr);
  let endB = parseTimeToMinutes(endBStr);
  if (endB <= startB) endB += 24 * 60; // Spans across midnight

  return Math.max(startA, startB) < Math.min(endA, endB);
}

// Helper to calculate shift duration in hours
function getShiftDurationHours(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  let start = parseTimeToMinutes(startStr);
  let end = parseTimeToMinutes(endStr);
  if (end <= start) end += 24 * 60;
  return Math.max(0, (end - start) / 60);
}

function App() {
  const [currentView, setCurrentView] = useState('employees'); 
  const [isDarkMode, setIsDarkMode] = useState(false);

  const handleExportSchedule = async () => {
    const target = document.getElementById('schedule-export-target');
    if (!target) return;
    
    const origWidth = target.style.width;
    const origHeight = target.style.height;
    const origOverflow = target.style.overflow;
    
    target.style.width = 'fit-content';
    target.style.height = 'fit-content';
    target.style.overflow = 'visible';
    
    try {
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
        windowWidth: target.scrollWidth,
        windowHeight: target.scrollHeight,
      });
      
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `סידור_עבודה_${currentView}.png`;
      link.click();
    } catch (err) {
      console.error('Failed to export schedule', err);
      alert('אירעה שגיאה בייצוא הסידור');
    } finally {
      target.style.width = origWidth;
      target.style.height = origHeight;
      target.style.overflow = origOverflow;
    }
  };

  // Staff List (Global directory of all employees)
  const [staffList, setStaffList] = useState(() => {
    const saved = localStorage.getItem('shiftApp_staffList');
    return saved && JSON.parse(saved).length > 0 ? JSON.parse(saved) : initialStaff;
  });
  const [newStaffName, setNewStaffName] = useState('');

  const PREDEFINED_ROLES = [
    'מנהל משמרת',
    'אחראי קופה',
    'מארחת',
    'פס חם',
    'פס קר',
    'מילוי אוכל'
  ];

  const ensureCategoriesExist = (scheduleData) => {
    if (!scheduleData) return {};
    const updated = { ...scheduleData };
    CATEGORIES.forEach(cat => {
      if (!updated[cat]) {
        updated[cat] = {
          "ראשון": [],
          "שני": [],
          "שלישי": [],
          "רביעי": [],
          "חמישי": [],
          "שישי": [],
          "מוצ\"ש": []
        };
      }
    });
    return updated;
  };

  // Shifts state
  const [shifts, setShifts] = useState(() => ensureCategoriesExist(initialSchedule));
  const [archives, setArchives] = useState([]);
  const [selectedArchiveWeek, setSelectedArchiveWeek] = useState(null);
  const [selectedPersonalWeekId, setSelectedPersonalWeekId] = useState('current');

  useEffect(() => {
    fetch('/api/get-archives')
      .then(res => res.json())
      .then(data => setArchives(data))
      .catch(err => console.error('Failed to load archives:', err));
  }, []);

  // Sync state when JSON files update
  useEffect(() => {
    setShifts(ensureCategoriesExist(initialSchedule));
  }, [initialSchedule]);

  useEffect(() => {
    setStaffList(initialStaff);
  }, [initialStaff]);

  // Dark mode effect
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  const [conflicts, setConflicts] = useState([]);
  const [employeeStats, setEmployeeStats] = useState([]);
  const [activeEmployeesCount, setActiveEmployeesCount] = useState(0);
  const [selectedEmployeeForPersonal, setSelectedEmployeeForPersonal] = useState('');

  const handleExportPersonal = async () => {
    const target = document.getElementById('personal-export-target');
    if (!target) return;
    try {
      const canvas = await html2canvas(target, { scale: 2, backgroundColor: isDarkMode ? '#0f172a' : '#ffffff' });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `לוז_אישי_${selectedEmployeeForPersonal}.png`;
      link.click();
    } catch (err) {}
  };
  
  const addRow = (category, section = 'evening') => {
    setShifts(prev => {
      const newShifts = JSON.parse(JSON.stringify(prev));
      const startT = section === 'morning' ? '10:00' : '17:00';
      const endT = section === 'morning' ? '17:00' : '01:00';
      DAYS.forEach(day => {
        if (!newShifts[category][day]) newShifts[category][day] = [];
        newShifts[category][day].push({ employee: '', role: '', start: startT, end: endT });
      });
      setTimeout(() => {
        fetch('/api/save-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newShifts)
        }).catch(()=>console.log("save error"));
      }, 50);
      return newShifts;
    });
  };

  const removeRow = (category) => {
    setShifts(prev => {
      const newShifts = JSON.parse(JSON.stringify(prev));
      DAYS.forEach(day => {
        if (newShifts[category][day] && newShifts[category][day].length > 0) {
          newShifts[category][day].pop();
        }
      });
      setTimeout(() => {
        fetch('/api/save-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newShifts)
        }).catch(()=>console.log("save error"));
      }, 50);
      return newShifts;
    });
  };

  const deleteSpecificRow = (category, section, rowIndex) => {
    const processed = getProcessedShifts();
    if (!processed) return;

    if(window.confirm('האם אתה בטוח שברצונך למחוק את כל השורה הזו לרוחב כל השבוע?')) {
      setShifts(prev => {
        const newShifts = JSON.parse(JSON.stringify(prev));
        
        DAYS.forEach(day => {
          const slotToDelete = processed[section][day][rowIndex];
          if (slotToDelete) {
             newShifts[category][day][slotToDelete.originalIndex] = null;
          }
        });

        // Filter out the nulls
        DAYS.forEach(day => {
           newShifts[category][day] = newShifts[category][day].filter(s => s !== null);
        });

        setTimeout(() => {
          fetch('/api/save-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newShifts)
          });
        }, 50);
        return newShifts;
      });
    }
  };

  // Check for conflicts and update stats
  useEffect(() => {
    const newConflicts = [];
    const shiftsByEmployeeByDay = {}; 
    const statsObj = {};
    let employeeCount = 0;

    CATEGORIES.forEach(cat => {
      DAYS.forEach(day => {
        if (!shiftsByEmployeeByDay[day]) shiftsByEmployeeByDay[day] = {};
        
        (shifts[cat]?.[day] || []).forEach(slot => {
          const emp = slot.employee ? slot.employee.trim() : '';
          if (emp) {
            if (!shiftsByEmployeeByDay[day][emp]) {
              shiftsByEmployeeByDay[day][emp] = [];
            }
            shiftsByEmployeeByDay[day][emp].push({
              category: cat,
              start: slot.start,
              end: slot.end
            });

            // Employee Stats Tracking
            if (!statsObj[emp]) {
              statsObj[emp] = {
                name: emp,
                categories: new Set(),
                days: new Set(),
                totalShifts: 0
              };
              employeeCount++;
            }
            statsObj[emp].categories.add(cat);
            statsObj[emp].days.add(day);
            statsObj[emp].totalShifts++;
          }
        });
      });
    });

    // Detect exact time overlaps and multi-department conflicts
    DAYS.forEach(day => {
      const dayData = shiftsByEmployeeByDay[day];
      if (!dayData) return;
      
      Object.keys(dayData).forEach(emp => {
        const empShifts = dayData[emp];
        if (empShifts.length > 1) {
          // Check pairs for time overlap
          for (let i = 0; i < empShifts.length; i++) {
            for (let j = i + 1; j < empShifts.length; j++) {
              const s1 = empShifts[i];
              const s2 = empShifts[j];
              if (isTimeOverlapping(s1.start, s1.end, s2.start, s2.end)) {
                newConflicts.push(
                  `חפיפת שעות חמורה! העובד/ת "${emp}" משובץ/ת ביום ${day} במחלקה "${s1.category}" (${s1.start}-${s1.end}) וגם במחלקה "${s2.category}" (${s2.start}-${s2.end}) בשעות חופפות!`
                );
              }
            }
          }

          const uniqueCategories = [...new Set(empShifts.map(s => s.category))];
          if (uniqueCategories.length > 1 && !newConflicts.some(c => c.includes(emp) && c.includes(day))) {
             const categoriesStr = uniqueCategories.join(' ו-');
             newConflicts.push(`שים לב: העובד/ת "${emp}" משובץ/ת ביום ${day} בכמה מחלקות: ${categoriesStr}.`);
          }
        }
      });
    });

    setConflicts(newConflicts);

    const formattedStats = Object.values(statsObj).map(stat => ({
      ...stat,
      categories: Array.from(stat.categories).join(', '),
      days: Array.from(stat.days).join(', ')
    }));
    
    setEmployeeStats(formattedStats);
    setActiveEmployeesCount(employeeCount);

  }, [shifts]);

  const addStaffMember = (e) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    
    if (staffList.find(s => s.name === newStaffName.trim())) {
      alert('עובד בשם זה כבר קיים ברשימה');
      return;
    }

    setStaffList([...staffList, { id: Date.now(), name: newStaffName.trim() }]);
    setNewStaffName('');
  };

  const removeStaffMember = (id) => {
    if(window.confirm('האם אתה בטוח שברצונך למחוק עובד זה מהרשימה הכללית?')) {
      setStaffList(staffList.filter(s => s.id !== id));
    }
  };

  const archiveAndResetWeek = async () => {
    const today = new Date();
    const defaultName = `שבוע ${today.toLocaleDateString('he-IL')}`;
    const weekName = prompt('הכנס שם לשבוע הנוכחי (לשמירה בארכיון):', defaultName);
    if (!weekName) return;

    const archiveData = {
      id: Date.now(),
      name: weekName,
      date: today.toISOString(),
      shifts: shifts
    };

    try {
      await fetch('/api/archive-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(archiveData)
      });
      
      setArchives(prev => [...prev, archiveData]);

      const newShifts = JSON.parse(JSON.stringify(shifts));
      CATEGORIES.forEach(cat => {
        DAYS.forEach(day => {
          if (newShifts[cat] && newShifts[cat][day]) {
            newShifts[cat][day] = [];
          }
        });
      });

      setShifts(newShifts);
      await fetch('/api/save-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShifts)
      });
      
      alert('השבוע נשמר בארכיון בהצלחה והלוח אופס לקראת השבוע החדש!');
    } catch (err) {
      console.error('Failed to archive week:', err);
      alert('אירעה שגיאה בשמירת השבוע בארכיון');
    }
  };

  const copyDataToAI = () => {
    const dataStr = JSON.stringify(staffList, null, 2);
    navigator.clipboard.writeText(dataStr).then(() => {
      alert('רשימת העובדים הועתקה ללוח! עכשיו אתה יכול להדביק אותה בשיחה.');
    });
  };

  const saveData = () => {
    localStorage.setItem('shiftApp_staffList', JSON.stringify(staffList));
    localStorage.setItem('shiftApp_shifts', JSON.stringify(shifts));
    alert('כל הנתונים (עובדים ומשמרות) נשמרו בהצלחה במחשב זה!');
  };

  const updateShift = (category, day, index, field, value) => {
    setShifts(prev => {
      const newShifts = { ...prev };
      const newDayList = [...newShifts[category][day]];
      newDayList[index] = { ...newDayList[index], [field]: value };
      newShifts[category] = { ...newShifts[category], [day]: newDayList };
      
      // Auto-save
      fetch('/api/save-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShifts)
      }).catch(e => console.error('Failed to auto-save:', e));
      
      return newShifts;
    });
  };

  // Completely delete shift slot when "נקה משמרת" is clicked
  const clearSlot = (category, day, index) => {
    setShifts(prev => {
      const newShifts = JSON.parse(JSON.stringify(prev));
      if (newShifts[category] && newShifts[category][day]) {
        newShifts[category][day].splice(index, 1);
      }
      
      // Auto-save
      fetch('/api/save-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShifts)
      }).catch(e => console.error('Failed to auto-save:', e));
      
      return newShifts;
    });
  };

  const getCategoryIcon = (cat) => {
    if (cat === 'בייגל') return <Coffee size={18} />;
    if (cat === 'יריד אוכל מוכן') return <Store size={18} />;
    if (cat === 'מסעדה') return <Utensils size={18} />;
    if (cat === 'מטבח') return <ChefHat size={18} />;
    if (cat === 'מארחות') return <UserCheck size={18} />;
    return <Calendar size={18} />;
  };

  const getProcessedShifts = () => {
    if (!CATEGORIES.includes(currentView)) return null;
    const processed = { morning: {}, evening: {} };
    let maxMorning = 0;
    let maxEvening = 0;

    DAYS.forEach(day => {
      const slots = shifts[currentView][day] || [];
      const withIndex = slots.map((s, i) => ({ ...s, originalIndex: i }));
      
      let morningPool = [];
      let eveningPool = [];
      
      withIndex.forEach(slot => {
        if (slot.start) {
          const hour = parseInt(slot.start.split(':')[0], 10);
          if (hour < 16) morningPool.push(slot);
          else eveningPool.push(slot);
        } else {
          if (slot.originalIndex < 10) morningPool.push(slot);
          else eveningPool.push(slot);
        }
      });
      
      // Attach conflict & double flags
      const processSlotFlags = (slot) => {
        if (!slot.employee) return { ...slot, isDouble: false, hasOverlapConflict: false };
        const empName = slot.employee.trim();
        
        // Find all shifts of this employee on this day across all categories
        const empDayShifts = [];
        CATEGORIES.forEach(cat => {
          (shifts[cat]?.[day] || []).forEach((s, idx) => {
            if (s.employee && s.employee.trim() === empName) {
              empDayShifts.push({ category: cat, originalIndex: idx, start: s.start, end: s.end });
            }
          });
        });

        const isDouble = empDayShifts.length > 1;
        
        // Overlap exists ONLY if there is another DIFFERENT shift of the same employee on that day with overlapping hours
        const hasOverlapConflict = isDouble && empDayShifts.some(other => {
          const isSameShift = (other.category === currentView && other.originalIndex === slot.originalIndex);
          return !isSameShift && isTimeOverlapping(slot.start, slot.end, other.start, other.end);
        });

        return { ...slot, isDouble, hasOverlapConflict };
      };
      
      morningPool = morningPool.map(processSlotFlags);
      eveningPool = eveningPool.map(processSlotFlags);
      
      const sortFn = (a, b) => {
        const aIsManager = a.role && a.role.includes('מנהל');
        const bIsManager = b.role && b.role.includes('מנהל');
        if (aIsManager && !bIsManager) return -1;
        if (!aIsManager && bIsManager) return 1;
        
        return a.originalIndex - b.originalIndex;
      };
      
      processed.morning[day] = morningPool.sort(sortFn);
      processed.evening[day] = eveningPool.sort(sortFn);
      
      if (processed.morning[day].length > maxMorning) maxMorning = processed.morning[day].length;
      if (processed.evening[day].length > maxEvening) maxEvening = processed.evening[day].length;
    });

    processed.maxMorning = maxMorning || 1;
    processed.maxEvening = maxEvening || 1;
    return processed;
  };

  const getEmployeesInMultipleDepartments = () => {
    const employeeDepts = {};
    Object.keys(shifts).forEach(category => {
      DAYS.forEach(day => {
        if (!shifts[category] || !shifts[category][day]) return;
        shifts[category][day].forEach(slot => {
          if (slot.employee) {
            const name = slot.employee.trim();
            if (!employeeDepts[name]) employeeDepts[name] = new Set();
            employeeDepts[name].add(category);
          }
        });
      });
    });

    const multiDeptEmployees = [];
    Object.keys(employeeDepts).forEach(name => {
      if (employeeDepts[name].size > 1) {
        multiDeptEmployees.push({
          name,
          depts: Array.from(employeeDepts[name]).join(', ')
        });
      }
    });

    return multiDeptEmployees;
  };

  // Combine Staff List and anyone who was scheduled but isn't in the staff list
  const combinedEmployees = [...staffList];
  const staffNames = new Set(staffList.map(s => s.name));
  
  employeeStats.forEach(stat => {
    if (!staffNames.has(stat.name)) {
      combinedEmployees.push({ id: `temp-${stat.name}`, name: stat.name, isUnregistered: true });
    }
  });

  // Active shifts data source for Personal Schedule view (Current or Archive)
  const activeShiftsForPersonal = selectedPersonalWeekId === 'current' 
    ? shifts 
    : (archives.find(a => String(a.id) === String(selectedPersonalWeekId))?.shifts || shifts);

  // Compute total hours & shift count for selected employee
  let totalEmployeeHours = 0;
  let totalEmployeeShiftsCount = 0;
  if (selectedEmployeeForPersonal) {
    DAYS.forEach(day => {
      CATEGORIES.forEach(cat => {
        (activeShiftsForPersonal[cat]?.[day] || []).forEach(shift => {
          if (shift.employee && shift.employee.trim() === selectedEmployeeForPersonal) {
            totalEmployeeShiftsCount++;
            totalEmployeeHours += getShiftDurationHours(shift.start, shift.end);
          }
        });
      });
    });
  }

  return (
    <div className="app-layout" dir="rtl">
      
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Calendar size={28} />
          <h2>מערכת שיבוץ</h2>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${currentView === 'employees' ? 'active' : ''}`}
            onClick={() => setCurrentView('employees')}
          >
            <Users size={20} />
            <span>רשימת עובדים</span>
            <div className="badge">{staffList.length}</div>
          </button>

          <button 
            className={`nav-item ${currentView === 'personal' ? 'active' : ''}`}
            onClick={() => setCurrentView('personal')}
          >
            <User size={20} />
            <span>לו"ז עובד אישי</span>
          </button>
          
          <button 
            className={`nav-item ${currentView === 'archives' ? 'active' : ''}`}
            onClick={() => { setCurrentView('archives'); setSelectedArchiveWeek(null); }}
          >
            <History size={20} />
            <span>ארכיון שבועות</span>
          </button>

          <div className="nav-divider">מחלקות</div>
          
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`nav-item ${currentView === cat ? 'active' : ''}`}
              onClick={() => setCurrentView(cat)}
            >
              {getCategoryIcon(cat)}
              <span>{cat}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer" style={{ marginTop: 'auto', padding: '20px 14px' }}>
          <button 
            className="nav-item theme-toggle" 
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{ justifyContent: 'center', border: '1px solid var(--card-border)' }}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            <span>{isDarkMode ? 'מצב יום ☀️' : 'מצב לילה 🌙'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        
        {conflicts.length > 0 && (
          <div className="conflicts-container">
            <div className="conflicts-header">
              <AlertCircle size={22} />
              <span>התראות התנגשות במערכת השעות ({conflicts.length})</span>
            </div>
            <ul className="conflicts-list">
              {conflicts.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Employee Dashboard View */}
        {currentView === 'employees' && (
          <div className="dashboard-view">
            
            <div className="view-header">
              <div>
                <h1>ניהול צוות עובדים</h1>
                <p>הוספה, הסרה ומעקב אחרי נתוני עובדים</p>
              </div>
            </div>
            
            <div className="stats-cards">
              <div className="stat-card">
                <div className="stat-icon"><Users size={24}/></div>
                <div className="stat-details">
                  <h3>סה"כ עובדים בחברה</h3>
                  <h2>{staffList.length}</h2>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{background: '#10b981'}}><Briefcase size={24}/></div>
                <div className="stat-details">
                  <h3>עובדים ששובצו השבוע</h3>
                  <h2>{activeEmployeesCount}</h2>
                </div>
              </div>
            </div>

            <div className="add-employee-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
              <div>
                <h3>הוסף עובד חדש למערכת</h3>
                <form onSubmit={addStaffMember} className="add-employee-form">
                  <div className="input-group">
                    <User size={18} />
                    <input 
                      type="text" 
                      placeholder="שם העובד..." 
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn-primary">
                    <Plus size={18} /> הוסף
                  </button>
                </form>
              </div>

              <div style={{ textAlign: 'center', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={archiveAndResetWeek} className="btn-primary" style={{ background: '#ef4444', padding: '10px 18px', fontWeight: 'bold' }}>
                  <History size={18} /> סגור שבוע נוכחי והתחל חדש
                </button>
                <button onClick={saveData} className="btn-primary" style={{ background: '#10b981', padding: '10px 18px' }}>
                  <Save size={18} /> שמור נתונים (בדפדפן)
                </button>
                <button onClick={copyDataToAI} className="btn-primary" style={{ background: '#4f46e5', padding: '10px 18px' }}>
                  <Download size={18} /> העתק נתונים לעוזר 
                </button>
              </div>
            </div>

            <div className="table-container">
              <table className="employees-table">
                <thead>
                  <tr>
                    <th>שם עובד</th>
                    <th>סטטוס במערכת</th>
                    <th>מחלקות השבוע</th>
                    <th>ימי עבודה השבוע</th>
                    <th>משמרות</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedEmployees.length > 0 ? (
                    combinedEmployees.map((emp) => {
                      const stats = employeeStats.find(s => s.name === emp.name) || { categories: '-', days: '-', totalShifts: 0 };
                      return (
                        <tr key={emp.id} className={emp.isUnregistered ? 'unregistered-row' : ''}>
                          <td className="emp-name">
                            <User size={16}/> {emp.name}
                            {emp.isUnregistered && <span className="temp-badge" title="עובד זה שובץ אך לא מופיע ברשימת העובדים הכללית">זמני</span>}
                          </td>
                          <td>
                            {emp.isUnregistered ? 
                              <span className="status-badge warning">לא שמור בצוות</span> : 
                              <span className="status-badge success">עובד רשום</span>
                            }
                          </td>
                          <td>{stats.categories}</td>
                          <td>{stats.days}</td>
                          <td><span className="shift-badge">{stats.totalShifts}</span></td>
                          <td>
                            {!emp.isUnregistered && (
                              <button className="icon-btn delete-btn" onClick={() => removeStaffMember(emp.id)} title="מחק עובד">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="empty-state">לא הוזנו עובדים למערכת. הוסף עובדים למעלה כדי להתחיל.</td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            </div>
        )}

        {/* Department Schedule View */}
        {CATEGORIES.includes(currentView) && (
          <div className="schedule-view">
            <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1>סידור עבודה: {currentView}</h1>
                <p>ניהול משמרות יומי ושבועי</p>
              </div>
              <button 
                onClick={handleExportSchedule}
                className="btn-primary" 
              >
                <Download size={18} /> הורד סידור עבודה
              </button>
            </div>

            <div className="board">
              <div id="schedule-export-target" className="table-wrapper">
                <table className="schedule-matrix">
                  <thead>
                    <tr>
                      <th className="slot-num-col">#</th>
                      {DAYS.map(day => (
                        <th key={day}>{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Morning Section */}
                    <tr className="shift-section-header">
                      <td colSpan={DAYS.length + 1} style={{ textAlign: 'center', background: 'var(--primary-light)', color: 'var(--primary-light-text)', padding: '12px', fontWeight: 'bold', fontSize: '1.15rem', position: 'relative' }}>
                        ☀️ משמרת בוקר
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '10px' }}>
                          <button 
                            onClick={() => addRow(currentView, 'morning')}
                            title="הוסף שורת בוקר"
                            style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}
                          >
                            <Plus size={16} /> הוסף בוקר
                          </button>
                        </div>
                      </td>
                    </tr>
                    {getProcessedShifts() && Array.from({ length: getProcessedShifts().maxMorning }).map((_, rowIndex) => {
                      const processed = getProcessedShifts();

                      return (
                        <tr key={`morning-${rowIndex}`}>
                          <td className="slot-num-cell">
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <span>{rowIndex + 1}</span>
                              <div style={{ display: 'flex', gap: '2px' }}>
                                <button 
                                  onClick={() => addRow(currentView, 'morning')}
                                  title="הוסף שורת בוקר"
                                  style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', padding: '2px' }}
                                >
                                  <Plus size={14} />
                                </button>
                                <button 
                                  onClick={() => deleteSpecificRow(currentView, 'morning', rowIndex)}
                                  title="מחק שורה זו"
                                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </td>
                          {DAYS.map(day => {
                            if (
                              day === 'מוצ"ש' || 
                              (currentView === 'מסעדה' && day === 'שישי') ||
                              (currentView === 'יריד אוכל מוכן' && day === 'שישי')
                            ) {
                              return (
                                <td key={day} className="matrix-cell empty-cell" style={{ background: 'var(--cell-empty-bg)', verticalAlign: 'middle', textAlign: 'center', color: 'var(--text-muted)' }}>
                                  אין משמרת בוקר
                                </td>
                              );
                            }
                            const slot = processed.morning[day][rowIndex];
                            if (!slot) return <td key={day} className="matrix-cell empty-cell"></td>;
                            
                            const isActive = slot.employee || slot.role;
                            const origIndex = slot.originalIndex;
                            const isConflict = slot.hasOverlapConflict;

                            return (
                              <td key={day} className={`matrix-cell ${isActive ? 'active-cell' : ''} ${isConflict ? 'conflict-cell' : ''}`}>
                                <div className="cell-content">
                                  <div className="cell-row header-row" style={{ position: 'relative' }}>
                                    <input 
                                      type="text" 
                                      className="compact-input emp-input"
                                      placeholder="שם עובד..."
                                      value={slot.employee || ''}
                                      onChange={(e) => updateShift(currentView, day, origIndex, 'employee', e.target.value)}
                                      list="staff-list-options"
                                    />
                                    {isConflict && <span className="overlap-conflict-badge">חפיפה!</span>}
                                    {slot.isDouble && !isConflict && <span className="double-shift-badge">כפולה</span>}
                                    <button 
                                      className="clear-cell-btn" 
                                      onClick={() => clearSlot(currentView, day, origIndex)}
                                      title="מחק משמרת זו לחלוטין"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                  <div className="cell-row">
                                    <input 
                                      type="text" 
                                      className="compact-input role-input"
                                      placeholder="תפקיד..."
                                      value={slot.role || ''}
                                      onChange={(e) => updateShift(currentView, day, origIndex, 'role', e.target.value)}
                                      list="roles-list"
                                    />
                                  </div>
                                  <div className="cell-row time-row">
                                    <input 
                                      type="time" 
                                      className="compact-time"
                                      value={slot.start || ''}
                                      onChange={(e) => updateShift(currentView, day, origIndex, 'start', e.target.value)}
                                    />
                                    <span>-</span>
                                    <input 
                                      type="time" 
                                      className="compact-time"
                                      value={slot.end || ''}
                                      onChange={(e) => updateShift(currentView, day, origIndex, 'end', e.target.value)}
                                    />
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {/* Evening Section */}
                    <tr className="shift-section-header">
                      <td colSpan={DAYS.length + 1} style={{ textAlign: 'center', background: 'var(--table-header-bg)', color: 'var(--text-dark)', padding: '12px', fontWeight: 'bold', fontSize: '1.15rem', position: 'relative', borderTop: '2px solid var(--card-border)' }}>
                        🌙 משמרת ערב
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '10px' }}>
                          <button 
                            onClick={() => addRow(currentView, 'evening')}
                            title="הוסף שורת ערב"
                            style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}
                          >
                            <Plus size={16} /> הוסף ערב
                          </button>
                        </div>
                      </td>
                    </tr>
                    {getProcessedShifts() && Array.from({ length: getProcessedShifts().maxEvening }).map((_, rowIndex) => {
                      const processed = getProcessedShifts();

                      return (
                        <tr key={`evening-${rowIndex}`}>
                          <td className="slot-num-cell">
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <span>{rowIndex + 1}</span>
                              <div style={{ display: 'flex', gap: '2px' }}>
                                <button 
                                  onClick={() => addRow(currentView, 'evening')}
                                  title="הוסף שורת ערב"
                                  style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', padding: '2px' }}
                                >
                                  <Plus size={14} />
                                </button>
                                <button 
                                  onClick={() => deleteSpecificRow(currentView, 'evening', rowIndex)}
                                  title="מחק שורה זו"
                                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </td>
                          {DAYS.map(day => {
                            if (
                              (currentView === 'מסעדה' && (day === 'שישי' || day === 'מוצ"ש')) ||
                              (currentView === 'בייגל' && day === 'שישי') ||
                              (currentView === 'יריד אוכל מוכן' && (day === 'שישי' || day === 'מוצ"ש' || day === 'חמישי'))
                            ) {
                              return (
                                <td key={day} className="matrix-cell empty-cell" style={{ background: 'var(--cell-empty-bg)', verticalAlign: 'middle', textAlign: 'center', color: 'var(--text-muted)' }}>
                                  אין משמרת ערב
                                </td>
                              );
                            }
                            const slot = processed.evening[day][rowIndex];
                            if (!slot) return <td key={day} className="matrix-cell empty-cell"></td>;
                            
                            const isActive = slot.employee || slot.role;
                            const origIndex = slot.originalIndex;
                            const isConflict = slot.hasOverlapConflict;

                            return (
                              <td key={day} className={`matrix-cell ${isActive ? 'active-cell' : ''} ${isConflict ? 'conflict-cell' : ''}`}>
                                <div className="cell-content">
                                  <div className="cell-row header-row" style={{ position: 'relative' }}>
                                    <input 
                                      type="text" 
                                      className="compact-input emp-input"
                                      placeholder="שם עובד..."
                                      value={slot.employee || ''}
                                      onChange={(e) => updateShift(currentView, day, origIndex, 'employee', e.target.value)}
                                      list="staff-list-options"
                                    />
                                    {isConflict && <span className="overlap-conflict-badge">חפיפה!</span>}
                                    {slot.isDouble && !isConflict && <span className="double-shift-badge">כפולה</span>}
                                    <button 
                                      className="clear-cell-btn" 
                                      onClick={() => clearSlot(currentView, day, origIndex)}
                                      title="מחק משמרת זו לחלוטין"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                  <div className="cell-row">
                                    <input 
                                      type="text" 
                                      className="compact-input role-input"
                                      placeholder="תפקיד..."
                                      value={slot.role || ''}
                                      onChange={(e) => updateShift(currentView, day, origIndex, 'role', e.target.value)}
                                      list="roles-list"
                                    />
                                  </div>
                                  <div className="cell-row time-row">
                                    <input 
                                      type="time" 
                                      className="compact-time"
                                      value={slot.start || ''}
                                      onChange={(e) => updateShift(currentView, day, origIndex, 'start', e.target.value)}
                                    />
                                    <span>-</span>
                                    <input 
                                      type="time" 
                                      className="compact-time"
                                      value={slot.end || ''}
                                      onChange={(e) => updateShift(currentView, day, origIndex, 'end', e.target.value)}
                                    />
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '16px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '15px' }}>
                <button onClick={() => addRow(currentView)} className="btn-primary" style={{ minWidth: '200px' }}>
                   <Plus size={18} /> הוסף שורת משמרת
                </button>
                <button onClick={() => removeRow(currentView)} className="btn-primary" style={{ background: '#ef4444', minWidth: '200px' }}>
                   <Trash2 size={18} /> מחק שורה אחרונה
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Personal Schedule View */}
        {currentView === 'personal' && (
          <div className="personal-view">
            <div className="view-header">
              <h1>לו"ז עובד אישי וחישוב משכורות</h1>
              <p>צפייה, מעקב שעות שבועי והורדה של הלו"ז האישי (כולל היסטוריית שבועות מהארכיון)</p>
            </div>
            
            {/* Week Selector & Employee Selector Controls */}
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', background: 'var(--card-bg)', padding: '20px', borderRadius: '14px', border: '1px solid var(--card-border)' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>1. בחר שבוע:</label>
                <select 
                  value={selectedPersonalWeekId}
                  onChange={e => setSelectedPersonalWeekId(e.target.value)}
                  style={{ padding: '10px 14px', fontSize: '1rem', background: 'var(--input-bg)', color: 'var(--input-text)', border: '1px solid var(--input-border)', borderRadius: '8px', cursor: 'pointer' }}
                >
                  <option value="current">📅 השבוע הנוכחי (פעיל)</option>
                  {archives.map(arch => (
                    <option key={arch.id} value={arch.id}>📂 {arch.name} ({new Date(arch.date).toLocaleDateString('he-IL')})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>2. בחר עובד:</label>
                <select 
                  value={selectedEmployeeForPersonal}
                  onChange={e => setSelectedEmployeeForPersonal(e.target.value)}
                  style={{ padding: '10px 14px', fontSize: '1rem', background: 'var(--input-bg)', color: 'var(--input-text)', border: '1px solid var(--input-border)', borderRadius: '8px', cursor: 'pointer', minWidth: '220px' }}
                >
                  <option value="">בחר עובד מהרשימה...</option>
                  {staffList.map(emp => (
                    <option key={emp.id} value={emp.name}>{emp.name}</option>
                  ))}
                </select>
              </div>

              {selectedEmployeeForPersonal && (
                <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ background: 'var(--primary-light)', padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--card-border)', display: 'flex', gap: '15px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>משמרות השבוע</span>
                      <strong style={{ fontSize: '1.2rem', color: 'var(--primary-color)' }}>{totalEmployeeShiftsCount}</strong>
                    </div>
                    <div style={{ width: '1px', background: 'var(--card-border)' }}></div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>סה"כ שעות (למשכורת)</span>
                      <strong style={{ fontSize: '1.2rem', color: '#10b981' }}>{totalEmployeeHours.toFixed(1)} שעות</strong>
                    </div>
                  </div>

                  <button 
                    onClick={handleExportPersonal}
                    className="btn-primary" 
                    style={{ height: '44px' }}
                  >
                    <Download size={18} /> הורד תמונה
                  </button>
                </div>
              )}
            </div>

            {getEmployeesInMultipleDepartments().length > 0 && selectedPersonalWeekId === 'current' && (
              <div style={{ background: 'var(--card-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)', marginTop: '15px' }}>
                <h3 style={{ color: 'var(--primary-color)', margin: '0 0 10px 0', fontSize: '1rem' }}>💡 עובדים ששובצו במספר מחלקות השבוע:</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {getEmployeesInMultipleDepartments().map(emp => (
                    <div 
                      key={emp.name} 
                      onClick={() => setSelectedEmployeeForPersonal(emp.name)}
                      style={{ background: 'var(--table-header-bg)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.9rem', color: 'var(--text-dark)', cursor: 'pointer', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '6px' }}
                      title={`משובץ ב: ${emp.depts}`}
                    >
                      <span>{emp.name}</span> 
                      <span style={{ color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 'bold' }}>({emp.depts})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedEmployeeForPersonal ? (
              <div id="personal-export-target" style={{ background: 'var(--card-bg)', padding: '30px', borderRadius: '14px', marginTop: '20px', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-md)' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '2px solid var(--primary-color)', paddingBottom: '16px' }}>
                  <h2 style={{ color: 'var(--text-dark)', fontSize: '1.8rem', fontWeight: '800', margin: '0 0 8px 0' }}>
                    לו"ז שבועי: {selectedEmployeeForPersonal}
                  </h2>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                    {selectedPersonalWeekId === 'current' ? 'השבוע הנוכחי' : archives.find(a => String(a.id) === String(selectedPersonalWeekId))?.name || 'ארכיון'}
                  </p>
                </div>

                {/* Payroll Summary Header */}
                <div style={{ display: 'flex', justifyContent: 'space-around', background: 'var(--primary-light)', padding: '12px 20px', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--card-border)' }}>
                  <div>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>סה"כ משמרות: </span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--text-dark)' }}>{totalEmployeeShiftsCount}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>סה"כ שעות עבודה מחושבות למשכורת: </span>
                    <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>{totalEmployeeHours.toFixed(1)} שעות</strong>
                  </div>
                </div>

                <table className="employees-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>יום</th>
                      <th>מחלקה</th>
                      <th>שעות משמרת</th>
                      <th>סה"כ שעות</th>
                      <th>תפקיד</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map(day => {
                      const dayShifts = [];
                      CATEGORIES.forEach(cat => {
                        (activeShiftsForPersonal[cat]?.[day] || []).forEach(shift => {
                          if (shift.employee && shift.employee.trim() === selectedEmployeeForPersonal) {
                            const hours = getShiftDurationHours(shift.start, shift.end);
                            dayShifts.push({ cat, shift, hours });
                          }
                        });
                      });
                      
                      dayShifts.sort((a, b) => {
                        const timeA = a.shift.start || "99:99";
                        const timeB = b.shift.start || "99:99";
                        return timeA.localeCompare(timeB);
                      });
                      
                      if (dayShifts.length === 0) {
                        return (
                          <tr key={day}>
                            <td className="emp-name" style={{ fontSize: '1.1rem' }}>{day}</td>
                            <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>-- יום חופש --</td>
                          </tr>
                        );
                      }
                      
                      return dayShifts.map((item, idx) => (
                        <tr key={`${day}-${idx}`}>
                          {idx === 0 && <td rowSpan={dayShifts.length} className="emp-name" style={{ fontSize: '1.1rem', verticalAlign: 'top', paddingTop: '16px' }}>{day}</td>}
                          <td style={{ fontWeight: 'bold' }}>{item.cat}</td>
                          <td style={{ direction: 'ltr', textAlign: 'center', fontWeight: '600' }}>{item.shift.start} - {item.shift.end}</td>
                          <td style={{ color: '#10b981', fontWeight: 'bold', textAlign: 'center' }}>{item.hours.toFixed(1)} שעות</td>
                          <td style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>{item.shift.role || '---'}</td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '50px', background: 'var(--card-bg)', borderRadius: '14px', marginTop: '20px', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
                בחר עובד מהרשימה למעלה כדי לצפות בלו"ז האישי שלו ובסיכום השעות למשכורת.
              </div>
            )}
          </div>
        )}

        {/* Datalists */}
        <datalist id="staff-list-options">
          {staffList.map(s => <option key={s.id} value={s.name} />)}
        </datalist>
        <datalist id="roles-list">
          {PREDEFINED_ROLES.map((r, i) => <option key={i} value={r} />)}
        </datalist>

        {/* Archives View */}
        {currentView === 'archives' && (
          <div className="archives-view">
            <div className="view-header">
              <div>
                <h1>ארכיון שבועות</h1>
                <p>צופה בהיסטוריית סידורי עבודה קודמים שנשמרו</p>
              </div>
            </div>

            {!selectedArchiveWeek ? (
              <div className="archives-list" style={{ display: 'grid', gap: '18px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {archives.length === 0 ? (
                  <div className="empty-state">לא נמצאו שבועות בארכיון. שבועות שתיסגור יופיעו כאן בצורה מסודרת.</div>
                ) : (
                  archives.map(arch => (
                    <div key={arch.id} className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedArchiveWeek(arch)}>
                      <div className="stat-icon" style={{ background: '#3b82f6' }}><History size={24} /></div>
                      <div className="stat-details">
                        <h3>{arch.name}</h3>
                        <p style={{ color: 'var(--text-muted)' }}>{new Date(arch.date).toLocaleDateString('he-IL')}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="archive-detail-view">
                <button className="btn-primary" onClick={() => setSelectedArchiveWeek(null)} style={{ marginBottom: '20px', background: '#64748b' }}>
                  חזור לרשימת הארכיון
                </button>
                <h2>מציג ארכיון: {selectedArchiveWeek.name}</h2>
                
                {CATEGORIES.map(category => (
                  <div key={category} style={{ marginBottom: '35px' }}>
                    <h3 style={{ borderBottom: '2px solid var(--primary-color)', paddingBottom: '8px', marginBottom: '16px', color: 'var(--text-dark)' }}>{category}</h3>
                    <div className="table-wrapper">
                      <table className="schedule-matrix" style={{ opacity: 0.95 }}>
                        <thead>
                          <tr>
                            <th>#</th>
                            {DAYS.map(day => <th key={day}>{day}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: 16 }).map((_, rowIndex) => {
                            let hasDataInRow = false;
                            const rowCells = DAYS.map(day => {
                              const categoryShifts = selectedArchiveWeek.shifts[category] || {};
                              const slots = categoryShifts[day] || [];
                              const slot = slots[rowIndex];
                              if (slot && (slot.employee || slot.role)) hasDataInRow = true;
                              return { day, slot };
                            });
                            
                            if (!hasDataInRow) return null;

                            return (
                              <tr key={rowIndex}>
                                <td className="slot-num-cell">{rowIndex + 1}</td>
                                {rowCells.map(({ day, slot }) => (
                                  <td key={day} className={`matrix-cell ${slot && (slot.employee || slot.role) ? 'active-cell' : ''}`}>
                                    {slot && (slot.employee || slot.role) ? (
                                      <div className="cell-content" style={{ pointerEvents: 'none' }}>
                                        <div className="cell-row" style={{ fontWeight: 'bold', color: 'var(--text-dark)' }}>{slot.employee || '-'}</div>
                                        <div className="cell-row" style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>{slot.role || '-'}</div>
                                        <div className="cell-row" style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>{slot.start} - {slot.end}</div>
                                      </div>
                                    ) : (
                                      <div className="empty-cell"></div>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
