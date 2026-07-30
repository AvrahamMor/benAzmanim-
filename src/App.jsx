import html2canvas from 'html2canvas';
import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar, Clock, User, Briefcase, Trash2, Users, LayoutDashboard, Utensils, Coffee, Store, Plus, Save, Moon, Sun, Download } from 'lucide-react';
import initialSchedule from './schedule.json';
import initialStaff from './staff.json';
import './App.css';

const CATEGORIES = ['בייגל', 'יריד אוכל מוכן', 'מסעדה'];
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'מוצ"ש'];
const SLOTS_PER_DAY = 20;

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
        backgroundColor: isDarkMode ? '#1e293b' : '#121212',
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
    'פס חם',
    'פס קר',
    'מילוי אוכל'
  ];

  // Shifts state
  const [shifts, setShifts] = useState(initialSchedule);

  // Sync state when JSON files update (e.g. from AI editing)
  useEffect(() => {
    setShifts(initialSchedule);
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
      const canvas = await html2canvas(target, { scale: 2, backgroundColor: '#121212' });
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
        if (newShifts[category][day].length > 10) {
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
        
        shifts[cat][day].forEach(slot => {
          const emp = slot.employee.trim();
          if (emp) {
            // Conflict Tracking
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

    // Detect overlaps
    DAYS.forEach(day => {
      const dayData = shiftsByEmployeeByDay[day];
      if (!dayData) return;
      
      Object.keys(dayData).forEach(emp => {
        const empShifts = dayData[emp];
        if (empShifts.length > 1) {
          const uniqueCategories = [...new Set(empShifts.map(s => s.category))];
          if (uniqueCategories.length > 1) {
             const categoriesStr = uniqueCategories.join(' ו-');
             newConflicts.push(`שים לב: העובד/ת "${emp}" משובץ/ת ביום ${day} בכמה מחלקות: ${categoriesStr}.`);
          } else {
             newConflicts.push(`שים לב: העובד/ת "${emp}" משובץ/ת מספר פעמים ביום ${day} במחלקה ${uniqueCategories[0]}.`);
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

  const copyDataToAI = () => {
    const dataStr = JSON.stringify(staffList, null, 2);
    navigator.clipboard.writeText(dataStr).then(() => {
      alert('רשימת העובדים הועתקה ללוח (בלי המשמרות הריקות)! עכשיו אתה יכול להדביק אותה בשיחה.');
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

  const clearSlot = (category, day, index) => {
    setShifts(prev => {
      const newShifts = { ...prev };
      const newDayList = [...newShifts[category][day]];
      
      let defaultStart = '';
      let defaultEnd = '';
      if (day === 'מוצ"ש') {
        defaultStart = '21:00';
        defaultEnd = '01:00';
      } else {
        if (index < 3) {
          defaultStart = '10:00';
          defaultEnd = '17:00';
        } else if (index >= 3 && index < 16) {
          defaultStart = '17:00';
          defaultEnd = '01:00';
        }
      }

      newDayList[index] = { employee: '', role: '', start: defaultStart, end: defaultEnd };
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

  const getCategoryIcon = (cat) => {
    if (cat === 'בייגל') return <Coffee size={18} />;
    if (cat === 'יריד אוכל מוכן') return <Store size={18} />;
    if (cat === 'מסעדה') return <Utensils size={18} />;
    return <Calendar size={18} />;
  };

  const getProcessedShifts = () => {
    if (!CATEGORIES.includes(currentView)) return null;
    const processed = { morning: {}, evening: {} };
    let maxMorning = 0;
    let maxEvening = 0;

    DAYS.forEach(day => {
      const slots = shifts[currentView][day] || Array(20).fill({});
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
      
      const morningEmpNames = new Set(morningPool.map(s => s.employee).filter(Boolean));
      const eveningEmpNames = new Set(eveningPool.map(s => s.employee).filter(Boolean));
      
      const setDoubleFlag = (slot) => {
        if (slot.employee && morningEmpNames.has(slot.employee) && eveningEmpNames.has(slot.employee)) {
          return { ...slot, isDouble: true };
        }
        return { ...slot, isDouble: false };
      };
      
      morningPool = morningPool.map(setDoubleFlag);
      eveningPool = eveningPool.map(setDoubleFlag);
      
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

        <div className="sidebar-footer" style={{ marginTop: 'auto', padding: '20px 12px' }}>
          <button 
            className="nav-item theme-toggle" 
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{ justifyContent: 'center' }}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            <span>{isDarkMode ? 'מצב יום' : 'מצב לילה'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        
        {conflicts.length > 0 && (
          <div className="conflicts-container">
            <div className="conflicts-header">
              <AlertCircle size={20} />
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

              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={saveData} className="btn-primary" style={{ background: '#10b981', padding: '10px 20px', fontSize: '1rem' }}>
                  <Save size={18} /> שמור נתונים זמנית (בדפדפן)
                </button>
                <button onClick={() => {
                  if(window.confirm('האם אתה בטוח? פעולה זו תדרוס את המשמרות שלא שמרת עם הנתונים מהעוזר האוטומטי.')) {
                    setShifts(initialSchedule);
                    localStorage.setItem('shiftApp_shifts', JSON.stringify(initialSchedule));
                    alert('הנתונים מהעוזר נטענו בהצלחה!');
                  }
                }} className="btn-primary" style={{ background: '#f59e0b', padding: '10px 20px', fontSize: '1rem' }}>
                  <Download size={18} /> טען שיבוצים מהעוזר (דריסת דפדפן)
                </button>
                <button onClick={copyDataToAI} className="btn-primary" style={{ background: '#4f46e5', padding: '10px 20px', fontSize: '1rem' }}>
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
                style={{ background: 'var(--primary-color)' }}
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
                      <td colSpan={DAYS.length + 1} style={{ textAlign: 'center', background: 'var(--primary-light)', color: 'var(--primary-color)', padding: '12px', fontWeight: 'bold', fontSize: '1.2rem' }}>
                        ☀️ משמרת בוקר
                      </td>
                    </tr>
                    {getProcessedShifts() && Array.from({ length: getProcessedShifts().maxMorning }).map((_, rowIndex) => {
                      const processed = getProcessedShifts();

                      return (
                        <tr key={`morning-${rowIndex}`}>
                          <td className="slot-num-cell" style={{ position: 'relative' }}>
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
                                <td key={day} className="matrix-cell empty-cell" style={{ background: 'var(--bg-color)', verticalAlign: 'middle', textAlign: 'center', color: '#9ca3af' }}>
                                  אין משמרת בוקר
                                </td>
                              );
                            }
                            const slot = processed.morning[day][rowIndex];
                            if (!slot) return <td key={day} className="matrix-cell empty-cell"></td>;
                            
                            const isActive = slot.employee || slot.role;
                            const origIndex = slot.originalIndex;
                            return (
                              <td key={day} className={`matrix-cell ${isActive ? 'active-cell' : ''}`}>
                                <div className="cell-content">
                                  <div className="cell-row header-row" style={{ position: 'relative' }}>
                                    <input 
                                      type="text" 
                                      className="compact-input emp-input"
                                      placeholder="שם עובד..."
                                      value={slot.employee}
                                      onChange={(e) => updateShift(currentView, day, origIndex, 'employee', e.target.value)}
                                      list="staff-list-options"
                                    />
                                    {slot.isDouble && <span className="double-shift-badge">כפולה</span>}
                                    <button 
                                      className="clear-cell-btn" 
                                      onClick={() => clearSlot(currentView, day, origIndex)}
                                      title="נקה משמרת"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                  <div className="cell-row">
                                    <input 
                                      type="text" 
                                      className="compact-input role-input"
                                      placeholder="תפקיד..."
                                      value={slot.role}
                                      onChange={(e) => updateShift(currentView, day, origIndex, 'role', e.target.value)}
                                      list="roles-list"
                                    />
                                  </div>
                                  <div className="cell-row time-row">
                                    <input 
                                      type="time" 
                                      className="compact-time"
                                      value={slot.start}
                                      onChange={(e) => updateShift(currentView, day, origIndex, 'start', e.target.value)}
                                    />
                                    <span>-</span>
                                    <input 
                                      type="time" 
                                      className="compact-time"
                                      value={slot.end}
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
                      <td colSpan={DAYS.length + 1} style={{ textAlign: 'center', background: '#374151', color: '#e5e7eb', padding: '12px', fontWeight: 'bold', fontSize: '1.2rem' }}>
                        🌙 משמרת ערב
                      </td>
                    </tr>
                    {getProcessedShifts() && Array.from({ length: getProcessedShifts().maxEvening }).map((_, rowIndex) => {
                      const processed = getProcessedShifts();

                      return (
                        <tr key={`evening-${rowIndex}`}>
                          <td className="slot-num-cell" style={{ position: 'relative' }}>
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
                                <td key={day} className="matrix-cell empty-cell" style={{ background: 'var(--bg-color)', verticalAlign: 'middle', textAlign: 'center', color: '#9ca3af' }}>
                                  אין משמרת ערב
                                </td>
                              );
                            }
                            const slot = processed.evening[day][rowIndex];
                            if (!slot) return <td key={day} className="matrix-cell empty-cell"></td>;
                            
                            const isActive = slot.employee || slot.role;
                            const origIndex = slot.originalIndex;
                            return (
                              <td key={day} className={`matrix-cell ${isActive ? 'active-cell' : ''}`}>
                                <div className="cell-content">
                                  <div className="cell-row header-row" style={{ position: 'relative' }}>
                                    <input 
                                      type="text" 
                                      className="compact-input emp-input"
                                      placeholder="שם עובד..."
                                      value={slot.employee}
                                      onChange={(e) => updateShift(currentView, day, origIndex, 'employee', e.target.value)}
                                      list="staff-list-options"
                                    />
                                    {slot.isDouble && <span className="double-shift-badge">כפולה</span>}
                                    <button 
                                      className="clear-cell-btn" 
                                      onClick={() => clearSlot(currentView, day, origIndex)}
                                      title="נקה משמרת"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                  <div className="cell-row">
                                    <input 
                                      type="text" 
                                      className="compact-input role-input"
                                      placeholder="תפקיד..."
                                      value={slot.role}
                                      onChange={(e) => updateShift(currentView, day, origIndex, 'role', e.target.value)}
                                      list="roles-list"
                                    />
                                  </div>
                                  <div className="cell-row time-row">
                                    <input 
                                      type="time" 
                                      className="compact-time"
                                      value={slot.start}
                                      onChange={(e) => updateShift(currentView, day, origIndex, 'start', e.target.value)}
                                    />
                                    <span>-</span>
                                    <input 
                                      type="time" 
                                      className="compact-time"
                                      value={slot.end}
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
              <div style={{ padding: '16px', textAlign: 'center', marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
                <button onClick={() => addRow(currentView)} className="btn-primary" style={{ background: 'var(--primary-color)', minWidth: '200px' }}>
                   <Plus size={18} style={{marginLeft: '8px'}} /> הוסף שורת משמרת
                </button>
                <button onClick={() => removeRow(currentView)} className="btn-primary" style={{ background: '#ef4444', minWidth: '200px' }}>
                   <Trash2 size={18} style={{marginLeft: '8px'}} /> מחק שורה אחרונה
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Personal Schedule View */}
        {currentView === 'personal' && (
          <div className="personal-view" style={{ padding: '20px' }}>
            <div className="view-header">
              <h1>לו"ז עובד אישי</h1>
              <p>צפייה והורדה של המשמרות המרוכזות של עובד מכל המחלקות (כולל כפולות)</p>
            </div>
            
            {getEmployeesInMultipleDepartments().length > 0 && (
              <div style={{ background: '#262626', padding: '15px', borderRadius: '8px', border: '1px solid var(--primary-light)', marginBottom: '20px' }}>
                <h3 style={{ color: 'var(--primary-color)', margin: '0 0 10px 0', fontSize: '1.1rem' }}>💡 עובדים ששובצו במספר מחלקות השבוע:</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {getEmployeesInMultipleDepartments().map(emp => (
                    <div 
                      key={emp.name} 
                      onClick={() => setSelectedEmployeeForPersonal(emp.name)}
                      style={{ background: '#333', padding: '6px 14px', borderRadius: '20px', fontSize: '0.95rem', color: '#e5e7eb', cursor: 'pointer', border: '1px solid #555', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary-color)'; e.currentTarget.style.background = '#404040'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.background = '#333'; }}
                      title={`משובץ ב: ${emp.depts}`}
                    >
                      <span>{emp.name}</span> 
                      <span style={{ color: 'var(--primary-color)', fontSize: '0.8rem', opacity: 0.8 }}>({emp.depts})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ margin: '20px 0', display: 'flex', gap: '15px', alignItems: 'center' }}>
              <select 
                value={selectedEmployeeForPersonal}
                onChange={e => setSelectedEmployeeForPersonal(e.target.value)}
                style={{ padding: '10px 15px', fontSize: '1.1rem', background: 'var(--card-bg)', color: 'var(--text-dark)', border: '1px solid var(--primary-color)', borderRadius: '8px', cursor: 'pointer' }}
              >
                <option value="">בחר עובד מהרשימה...</option>
                {staffList.map(emp => (
                  <option key={emp.id} value={emp.name}>{emp.name}</option>
                ))}
              </select>
              
              {selectedEmployeeForPersonal && (
                <button 
                  onClick={handleExportPersonal}
                  className="btn-primary" 
                  style={{ background: 'var(--primary-color)', padding: '10px 20px', fontSize: '1rem' }}
                >
                  <Download size={18} /> הורד תמונת לו"ז לעובד
                </button>
              )}
            </div>

            {selectedEmployeeForPersonal && (
              <div id="personal-export-target" style={{ background: '#121212', padding: '30px', borderRadius: '12px', marginTop: '20px', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                <h2 style={{ color: 'var(--primary-color)', textAlign: 'center', marginBottom: '30px', fontSize: '2rem' }}>
                  לו"ז שבועי: {selectedEmployeeForPersonal}
                </h2>
                <table className="schedule-matrix" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>יום</th>
                      <th>מחלקה</th>
                      <th>שעות משמרת</th>
                      <th>תפקיד</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map(day => {
                      const dayShifts = [];
                      CATEGORIES.forEach(cat => {
                        (shifts[cat][day] || []).forEach(shift => {
                          if (shift.employee === selectedEmployeeForPersonal) {
                            dayShifts.push({ cat, shift });
                          }
                        });
                      });
                      
                      if (dayShifts.length === 0) {
                        return (
                          <tr key={day} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <td className="slot-num-cell" style={{ fontSize: '1.2rem', padding: '15px' }}>{day}</td>
                            <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(30, 30, 30, 0.8)', padding: '15px' }}>-- יום חופש --</td>
                          </tr>
                        );
                      }
                      
                      return dayShifts.map((item, idx) => (
                        <tr key={`${day}-${idx}`} style={{ borderBottom: idx === dayShifts.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                          {idx === 0 && <td rowSpan={dayShifts.length} className="slot-num-cell" style={{ fontSize: '1.2rem', padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{day}</td>}
                          <td style={{ background: 'rgba(30, 30, 30, 0.8)', padding: '15px', color: '#fff', fontSize: '1.1rem', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{item.cat}</td>
                          <td style={{ direction: 'ltr', background: 'rgba(30, 30, 30, 0.8)', padding: '15px', color: '#fff', fontSize: '1.1rem', textAlign: 'center' }}>{item.shift.start} - {item.shift.end}</td>
                          <td style={{ background: 'rgba(30, 30, 30, 0.8)', padding: '15px', color: 'var(--primary-color)', fontSize: '1.1rem' }}>{item.shift.role || '---'}</td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Datalist for autocomplete */}
        <datalist id="staff-list-options">
          {staffList.map(s => <option key={s.id} value={s.name} />)}
        </datalist>
        <datalist id="roles-list">
          {PREDEFINED_ROLES.map((r, i) => <option key={i} value={r} />)}
        </datalist>

      </main>
    </div>
  );
}

export default App;
