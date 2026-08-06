const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add History icon
content = content.replace(
  "Download } from 'lucide-react';",
  "Download, History } from 'lucide-react';"
);

// 2. Add archives state
const stateMarker = "const [shifts, setShifts] = useState(initialSchedule);";
const stateCode = `const [shifts, setShifts] = useState(initialSchedule);
  const [archives, setArchives] = useState([]);
  const [selectedArchiveWeek, setSelectedArchiveWeek] = useState(null);

  useEffect(() => {
    fetch('/api/get-archives')
      .then(res => res.json())
      .then(data => setArchives(data))
      .catch(err => console.error('Failed to load archives:', err));
  }, []);
`;
content = content.replace(stateMarker, stateCode);

// 3. Add archiveAndResetWeek
const archiveFnMarker = "const copyDataToAI = () => {";
const archiveFnCode = `const archiveAndResetWeek = async () => {
    const today = new Date();
    const defaultName = \`שבוע \${today.toLocaleDateString('he-IL')}\`;
    const weekName = prompt('הכנס שם לשבוע הנוכחי (לשמירה בארכיון):', defaultName);
    if (!weekName) return; // User cancelled

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
            newShifts[cat][day] = newShifts[cat][day].map(slot => ({
              ...slot,
              employee: '',
              role: ''
            }));
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

  const copyDataToAI = () => {`;
content = content.replace(archiveFnMarker, archiveFnCode);

// 4. Add button to dashboard
const btnMarker = "<div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' }}>";
const btnCode = `<div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={archiveAndResetWeek} className="btn-primary" style={{ background: '#ef4444', padding: '10px 20px', fontSize: '1rem', fontWeight: 'bold' }}>
                  <History size={18} /> סגור שבוע נוכחי והתחל חדש
                </button>`;
content = content.replace(btnMarker, btnCode);

// 5. Add Sidebar link
const sidebarMarker = `<button 
      className={\`nav-item \${currentView === 'personal' ? 'active' : ''}\`}
      onClick={() => setCurrentView('personal')}
    >
      <User size={20} />
      <span>לו"ז עובד אישי</span>
    </button>`;
const sidebarCode = sidebarMarker + `
          <button 
            className={\`nav-item \${currentView === 'archives' ? 'active' : ''}\`}
            onClick={() => { setCurrentView('archives'); setSelectedArchiveWeek(null); }}
          >
            <History size={20} />
            <span>ארכיון שבועות</span>
          </button>`;
content = content.replace(sidebarMarker, sidebarCode);

// 6. Add Archives view
const viewMarker = "</main>";
const viewCode = `        {currentView === 'archives' && (
          <div className="archives-view">
            <div className="view-header">
              <div>
                <h1>ארכיון שבועות</h1>
                <p>צפה בהיסטוריית סידורי עבודה קודמים</p>
              </div>
            </div>

            {!selectedArchiveWeek ? (
              <div className="archives-list" style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {archives.length === 0 ? (
                  <div className="empty-state">לא נמצאו שבועות בארכיון.</div>
                ) : (
                  archives.map(arch => (
                    <div key={arch.id} className="stat-card" style={{ cursor: 'pointer', border: '1px solid var(--border-color)' }} onClick={() => setSelectedArchiveWeek(arch)}>
                      <div className="stat-icon" style={{ background: '#3b82f6' }}><History size={24} /></div>
                      <div className="stat-details">
                        <h3>{arch.name}</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>{new Date(arch.date).toLocaleDateString('he-IL')}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="archive-detail-view">
                <button className="btn-primary" onClick={() => setSelectedArchiveWeek(null)} style={{ marginBottom: '20px', background: '#6b7280' }}>
                  חזור לרשימת הארכיון
                </button>
                <h2>מציג: {selectedArchiveWeek.name}</h2>
                
                {CATEGORIES.map(category => (
                  <div key={category} style={{ marginBottom: '40px' }}>
                    <h3 style={{ borderBottom: '2px solid var(--primary-color)', paddingBottom: '10px', marginBottom: '20px' }}>{category}</h3>
                    <div className="table-wrapper">
                      <table className="schedule-matrix" style={{ opacity: 0.9 }}>
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
                              const slots = selectedArchiveWeek.shifts[category][day] || [];
                              const slot = slots[rowIndex];
                              if (slot && (slot.employee || slot.role)) hasDataInRow = true;
                              return { day, slot };
                            });
                            
                            if (!hasDataInRow) return null;

                            return (
                              <tr key={rowIndex}>
                                <td className="slot-num-cell">{rowIndex + 1}</td>
                                {rowCells.map(({ day, slot }) => (
                                  <td key={day} className={\`matrix-cell \${slot && (slot.employee || slot.role) ? 'active-cell' : ''}\`}>
                                    {slot && (slot.employee || slot.role) ? (
                                      <div className="cell-content" style={{ pointerEvents: 'none' }}>
                                        <div className="cell-row" style={{ fontWeight: 'bold' }}>{slot.employee || '-'}</div>
                                        <div className="cell-row" style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>{slot.role || '-'}</div>
                                        <div className="cell-row" style={{ fontSize: '0.8em' }}>{slot.start} - {slot.end}</div>
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
      </main>`;
content = content.replace(viewMarker, viewCode);

fs.writeFileSync(filePath, content, 'utf8');
console.log('App.jsx patched successfully');
