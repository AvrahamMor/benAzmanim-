const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src', 'App.jsx');
let appCode = fs.readFileSync(appPath, 'utf8');

// 1. Fix handleExportSchedule to fix html2canvas cropping
appCode = appCode.replace(
  /const handleExportSchedule = async \(\) => \{[\s\S]*?\}\s*?\};\s*(?=\/\/\s*Staff List)/,
  `const handleExportSchedule = async () => {
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
      link.download = \`סידור_עבודה_\${currentView}.png\`;
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
`
);

// 2. Add 'personal' state variables and handleExportPersonal
appCode = appCode.replace(
  /const \[activeEmployeesCount, setActiveEmployeesCount\] = useState\(0\);/,
  `const [activeEmployeesCount, setActiveEmployeesCount] = useState(0);
  const [selectedEmployeeForPersonal, setSelectedEmployeeForPersonal] = useState('');

  const handleExportPersonal = async () => {
    const target = document.getElementById('personal-export-target');
    if (!target) return;
    try {
      const canvas = await html2canvas(target, { scale: 2, backgroundColor: '#121212' });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = \`לוז_אישי_\${selectedEmployeeForPersonal}.png\`;
      link.click();
    } catch (err) {}
  };
  
  const addRow = (category) => {
    setShifts(prev => {
      const newShifts = { ...prev };
      DAYS.forEach(day => {
        newShifts[category][day] = [
          ...newShifts[category][day],
          { employee: '', role: '', start: '17:00', end: '01:00' }
        ];
      });
      fetch('/api/save-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShifts)
      });
      return newShifts;
    });
  };
`
);

// 3. Add Sidebar Navigation item for Personal Schedule
appCode = appCode.replace(
  /<div className="nav-divider">מחלקות<\/div>/,
  `<button 
      className={\`nav-item \${currentView === 'personal' ? 'active' : ''}\`}
      onClick={() => setCurrentView('personal')}
    >
      <User size={20} />
      <span>לו"ז עובד אישי</span>
    </button>
    <div className="nav-divider">מחלקות</div>`
);


// 4. Add the button after the matrix (at the end of CATEGORIES views)
appCode = appCode.replace(
  /<\/tbody>[\s\S]*?<\/table>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?\)}/,
  `</tbody>
                </table>
              </div>
              <div style={{ padding: '16px', textAlign: 'center', marginTop: '10px' }}>
                <button onClick={() => addRow(currentView)} className="btn-primary" style={{ background: 'var(--primary-color)' }}>
                   <Plus size={18} style={{marginLeft: '8px'}} /> הוסף שורת משמרת ריקה
                </button>
              </div>
            </div>
          </div>
        )}`
);

// 5. Add the Personal View Component right before the datalist
appCode = appCode.replace(
  /\{\/\* Datalist for autocomplete \*\/\}/,
  `{/* Personal Schedule View */}
        {currentView === 'personal' && (
          <div className="personal-view" style={{ padding: '20px' }}>
            <div className="view-header">
              <h1>לו"ז עובד אישי</h1>
              <p>צפייה והורדה של המשמרות המרוכזות של עובד מכל המחלקות (כולל כפולות)</p>
            </div>
            
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
                        <tr key={\`\${day}-\${idx}\`} style={{ borderBottom: idx === dayShifts.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
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

        {/* Datalist for autocomplete */}`
);

fs.writeFileSync(appPath, appCode);
console.log('App.jsx patched with advanced features.');
