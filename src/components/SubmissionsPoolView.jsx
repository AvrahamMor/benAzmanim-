import React, { useState, useMemo } from 'react';
import { 
  Users, CheckCircle2, Clock, Calendar, Search, Filter, 
  Send, Sparkles, Sun, Moon, Trash2, Edit3, Plus, 
  Share2, ArrowRight, Check, AlertTriangle, UserPlus, ChevronDown, ChevronUp
} from 'lucide-react';

export default function SubmissionsPoolView({
  submissions = [],
  staffList = [],
  weekDates = [],
  onUpdateSubmissions,
  onAutoAssignToSchedule,
  onBackToSchedule,
  currentCategory = 'מסעדה',
  waiterShiftStats
}) {
  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'מוצ"ש'];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState('');
  const [editingSubmission, setEditingSubmission] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualName, setManualName] = useState('');

  // Who submitted vs who hasn't submitted yet
  const submittedNames = useMemo(() => {
    return new Set(submissions.map(s => (s.employeeName || '').trim().toLowerCase()));
  }, [submissions]);

  const missingStaff = useMemo(() => {
    return staffList.filter(s => !submittedNames.has((s.name || '').trim().toLowerCase()));
  }, [staffList, submittedNames]);

  // How many waiters have fulfilled their requested shift quota
  const fullAssignedCount = useMemo(() => {
    if (!waiterShiftStats?.getStats) return 0;
    return submissions.filter(sub => {
      const s = waiterShiftStats.getStats(sub.employeeName);
      return s.requested > 0 && s.assigned >= s.requested;
    }).length;
  }, [submissions, waiterShiftStats]);

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      const matchesSearch = !searchQuery || 
        sub.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.notes?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedDayFilter) {
        const dayData = sub.days?.[selectedDayFilter];
        if (!dayData) return false;
        return dayData.morning || dayData.evening;
      }

      return true;
    });
  }, [submissions, searchQuery, selectedDayFilter]);

  // Copy WhatsApp Reminder Message
  const handleCopyWhatsAppReminder = () => {
    const currentUrl = window.location.origin + window.location.pathname + '?view=submit';
    const missingNamesList = missingStaff.map(s => `• ${s.name}`).join('\n');
    
    const message = `היי צוות יקר! 👋
אפשר להתחיל לשלוח משמרות לשבוע הקרוב דרך הקישור הנוח:
${currentUrl}

${missingStaff.length > 0 ? `⏳ חברים שעדיין לא הגישו משמרות (${missingStaff.length}):\n${missingNamesList}\n\nנא לשלוח בהקדם לסגירת סידור העבודה!` : 'כל הכבוד! כולם הגישו משמרות.'}`;

    navigator.clipboard.writeText(message).then(() => {
      alert('הודעת התזכורת לווטסאפ הועתקה ללוח בהצלחה!\nתוכל להדביק אותה עכשיו בקבוצת הווטסאפ של המלצרים.');
    }).catch(() => {
      alert('העתקה נכשלה, אנא העתק ידנית את הקישור: ' + currentUrl);
    });
  };

  // Copy Direct Link for Waiters
  const handleCopySubmitLink = () => {
    const url = window.location.origin + window.location.pathname + '?view=submit';
    navigator.clipboard.writeText(url).then(() => {
      alert('הקישור הישיר להגשת משמרות הועתק:\n' + url);
    });
  };

  // Delete submission
  const handleDeleteSubmission = (id, name) => {
    if (window.confirm(`האם אתה בטוח שברצונך למחוק את ההגשה של "${name}"?`)) {
      const updated = submissions.filter(s => s.id !== id);
      onUpdateSubmissions(updated);
    }
  };

  // Clear all submissions for fresh week
  const handleClearAll = () => {
    if (window.confirm('האם אתה בטוח שברצונך לאפס את כל הגשות המשמרות לקראת שבוע חדש? (מאגר שמות העובדים יישמר לחלוטין)')) {
      onUpdateSubmissions([]);
    }
  };

  // Save edited submission (Manager Full Control: change, add days, etc.)
  const handleSaveEdit = (updatedSub) => {
    const updated = submissions.map(s => s.id === updatedSub.id ? updatedSub : s);
    onUpdateSubmissions(updated);
    setEditingSubmission(null);
  };

  // Add manual submission
  const handleCreateManual = (name) => {
    if (!name.trim()) return;
    const initialDays = {};
    DAYS.forEach(day => {
      initialDays[day] = { morning: false, evening: false, off: false, note: '' };
    });

    const newSub = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      employeeName: name.trim(),
      submittedAt: new Date().toISOString(),
      preferredCategory: currentCategory || 'מסעדה',
      notes: 'הוזן ידנית על ידי מנהל',
      days: initialDays
    };

    const updated = [...submissions, newSub];
    onUpdateSubmissions(updated);
    setShowAddModal(false);
    setManualName('');
    setEditingSubmission(newSub); // Immediately open editor to adjust shifts
  };

  return (
    <div className="submissions-pool-view" dir="rtl">
      
      {/* Top Header */}
      <div className="pool-header-card">
        <div className="pool-header-main">
          <div>
            <div className="pool-badge-title">
              <Users size={22} className="text-primary" />
              <h1>מאגר הגשות משמרות לשבוע</h1>
            </div>
            <p className="pool-subtitle">
              כל המלצרים שנרשמו והגישו משמרות — שליטה מלאה לשנות, להוסיף ולשבץ בלחיצה אחת בסידור
            </p>
          </div>

          <div className="pool-header-actions">
            <button 
              type="button" 
              onClick={handleCopySubmitLink} 
              className="btn-pool-action btn-copy-link"
              title="העתק קישור להגשת משמרות"
            >
              <Share2 size={16} />
              <span>קישור הגשה למלצרים</span>
            </button>

            <button 
              type="button" 
              onClick={handleCopyWhatsAppReminder} 
              className="btn-pool-action btn-whatsapp"
              title="העתק הודעת תזכורת מוכנה לווטסאפ"
            >
              <Send size={16} />
              <span>הודעת תזכורת לווטסאפ 💬</span>
            </button>

            {onBackToSchedule && (
              <button 
                type="button" 
                onClick={onBackToSchedule} 
                className="btn-pool-action btn-return-schedule"
              >
                <span>חזור ללוח השיבוץ</span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Stats Strip */}
        <div className="pool-stats-strip">
          <div className="stat-pill stat-submitted">
            <CheckCircle2 size={18} />
            <span>הגישו משמרות: <strong>{submissions.length}</strong> עובדים</span>
          </div>

          <div className="stat-pill stat-fulfilled">
            <Sparkles size={18} />
            <span>שובצו מלא: <strong>{fullAssignedCount}</strong> מתוך <strong>{submissions.length}</strong></span>
          </div>

          <div className="stat-pill stat-missing">
            <Clock size={18} />
            <span>טרם הגישו: <strong>{missingStaff.length}</strong> עובדים</span>
          </div>

          <div className="stat-pill stat-total">
            <Users size={18} />
            <span>סה"כ עובדים במאגר: <strong>{staffList.length}</strong></span>
          </div>

          {submissions.length > 0 && (
            <button 
              type="button" 
              onClick={handleClearAll}
              className="btn-clear-pool"
              title="איפוס הגשות לקראת שבוע חדש"
            >
              <Trash2 size={14} />
              <span>איפוס הגשות לשבוע חדש</span>
            </button>
          )}
        </div>
      </div>

      {/* Missing Waiters Section (if any) */}
      {missingStaff.length > 0 && (
        <div className="missing-staff-card">
          <div className="missing-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} className="text-warning" />
              <span className="missing-title">מלצרים שטרם שלחו משמרות לשבוע זה ({missingStaff.length}):</span>
            </div>
            <span className="missing-hint">לחץ על שם כדי להזין עבורו משמרות ידנית</span>
          </div>
          <div className="missing-chips-list">
            {missingStaff.map(s => (
              <button 
                key={s.id} 
                className="missing-chip"
                onClick={() => handleCreateManual(s.name)}
                title={`לחץ כדי להזין משמרות עבור ${s.name}`}
              >
                <span>{s.name}</span>
                <Plus size={12} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search & Day Filters */}
      <div className="pool-controls-bar">
        <div className="search-input-wrap">
          <Search size={18} />
          <input 
            type="text" 
            className="pool-search-input" 
            placeholder="חפש לפי שם מלצר או הערה..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        <div className="day-filters-group">
          <span className="filter-label">סנן לפי יום:</span>
          <button 
            type="button" 
            className={`day-filter-btn ${selectedDayFilter === '' ? 'active' : ''}`}
            onClick={() => setSelectedDayFilter('')}
          >
            הכל ({submissions.length})
          </button>
          {DAYS.map(day => (
            <button 
              key={day}
              type="button" 
              className={`day-filter-btn ${selectedDayFilter === day ? 'active' : ''}`}
              onClick={() => setSelectedDayFilter(selectedDayFilter === day ? '' : day)}
            >
              {day}
            </button>
          ))}
        </div>

        <button 
          type="button" 
          onClick={() => setShowAddModal(true)} 
          className="btn-add-manual"
        >
          <UserPlus size={16} />
          <span>הוסף מלצר למאגר ידנית</span>
        </button>
      </div>

      {/* Submissions List */}
      <div className="submissions-grid">
        {filteredSubmissions.length === 0 ? (
          <div className="empty-submissions-box">
            <Users size={48} className="text-muted" />
            <h3>לא נמצאו הגשות משמרות התואמות לחיפוש</h3>
            <p>שלח את הקישור למלצרים בווטסאפ או הוסף מלצר ידנית כדי להתחיל בשיבוץ</p>
            <button 
              type="button" 
              onClick={handleCopyWhatsAppReminder} 
              className="btn-primary"
              style={{ marginTop: '12px' }}
            >
              <Send size={16} /> שלח הודעת ווטסאפ למלצרים
            </button>
          </div>
        ) : (
          filteredSubmissions.map(sub => {
            const stat = waiterShiftStats?.getStats ? waiterShiftStats.getStats(sub.employeeName) : null;
            const isFull = stat && stat.requested > 0 && stat.assigned >= stat.requested;
            const isPartial = stat && stat.assigned > 0 && stat.assigned < stat.requested;
            const isZero = stat && stat.assigned === 0;
            const isOver = stat && stat.assigned > stat.requested;

            return (
              <div key={sub.id} className="submission-card-item">
                <div className="sub-item-header">
                  <div>
                    <div className="sub-title-with-badge">
                      <h3 className="sub-employee-name">{sub.employeeName}</h3>
                      {stat && stat.requested !== null && (
                        <div className={`sub-ratio-badge ${isFull ? 'ratio-badge-full' : (isPartial ? 'ratio-badge-partial' : 'ratio-badge-zero')}`}>
                          <span className="ratio-badge-txt">
                            שיבוץ: <strong>{stat.assigned}</strong> מתוך <strong>{stat.requested}</strong>
                          </span>
                          {isFull && !isOver && <span className="ratio-status-tag tag-full">✅ הושלם</span>}
                          {isPartial && <span className="ratio-status-tag tag-partial">⏳ חסר {stat.requested - stat.assigned}</span>}
                          {isZero && <span className="ratio-status-tag tag-zero">⚪ טרם שובץ</span>}
                          {isOver && <span className="ratio-status-tag tag-over">⭐ +{stat.assigned - stat.requested}</span>}
                        </div>
                      )}
                    </div>
                    <div className="sub-meta-info">
                      <span className="sub-dept-tag">{sub.preferredCategory || 'מסעדה'}</span>
                      {sub.submittedAt && (
                        <span className="sub-time-tag">
                          {new Date(sub.submittedAt).toLocaleDateString('he-IL', { 
                            weekday: 'short', hour: '2-digit', minute: '2-digit' 
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="sub-item-actions">
                    <button 
                      type="button" 
                      onClick={() => setEditingSubmission(JSON.parse(JSON.stringify(sub)))}
                      className="btn-sub-action btn-edit"
                      title="ערוך או הוסף ימים למלצר זה (שליטה מלאה למנהל)"
                    >
                      <Edit3 size={15} />
                      <span>ערוך זמינות</span>
                    </button>

                    {onAutoAssignToSchedule && (
                      <button 
                        type="button" 
                        onClick={() => onAutoAssignToSchedule(sub)}
                        className="btn-sub-action btn-assign"
                        title="שבץ מלצר זה בסידור העבודה לפי הבקשות שלו"
                      >
                        <Sparkles size={15} />
                        <span>שבץ בסידור</span>
                      </button>
                    )}

                    <button 
                      type="button" 
                      onClick={() => handleDeleteSubmission(sub.id, sub.employeeName)}
                      className="btn-sub-action btn-delete"
                      title="מחק הגשה זו"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Days requested pills */}
                <div className="sub-days-row">
                  {DAYS.map(day => {
                    const dayData = sub.days?.[day];
                    const hasMorning = dayData?.morning;
                    const hasEvening = dayData?.evening;
                    const isOff = dayData?.off;
                    const isAny = hasMorning || hasEvening;

                    return (
                      <div 
                        key={day} 
                        className={`day-badge-col ${isAny ? 'active-day-col' : ''} ${isOff ? 'off-day-col' : ''}`}
                      >
                        <span className="day-badge-title">{day}</span>
                        <div className="day-shift-badges">
                          {hasMorning && <span className="shift-chip morning-chip" title="בוקר">☀️</span>}
                          {hasEvening && <span className="shift-chip evening-chip" title="ערב">🌙</span>}
                          {isOff && <span className="shift-chip off-chip" title="חופש">🏖️</span>}
                          {!isAny && !isOff && <span className="shift-chip empty-chip">-</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Notes */}
                {sub.notes && (
                  <div className="sub-general-note">
                    <strong>הערה:</strong> {sub.notes}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: EDIT SUBMISSION (Manager Full Control: add days, modify availability) */}
      {editingSubmission && (
        <div className="modal-backdrop" onClick={() => setEditingSubmission(null)}>
          <div className="modal-content pool-edit-modal" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="modal-header">
              <div>
                <h2>עריכת זמינות ושינוי משמרות: {editingSubmission.employeeName}</h2>
                <p>שליטה מלאה למנהל — ניתן להוסיף ימים, לשנות משמרות והערות</p>
              </div>
              <button className="modal-close-btn" onClick={() => setEditingSubmission(null)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="edit-days-list">
                {DAYS.map(day => {
                  const dayData = editingSubmission.days?.[day] || {
                    morning: false, evening: false, off: false, note: ''
                  };

                  const updateDay = (field, val) => {
                    setEditingSubmission(prev => {
                      const updated = { ...prev };
                      if (!updated.days) updated.days = {};
                      updated.days[day] = {
                        ...(updated.days[day] || {}),
                        [field]: val
                      };
                      return updated;
                    });
                  };

                  return (
                    <div key={day} className="edit-day-row">
                      <span className="edit-day-name">{day}</span>
                      
                      <div className="edit-toggles-wrap">
                        <button 
                          type="button" 
                          className={`edit-toggle-chip ${dayData.morning ? 'active-morning' : ''}`}
                          onClick={() => updateDay('morning', !dayData.morning)}
                        >
                          ☀️ בוקר
                        </button>

                        <button 
                          type="button" 
                          className={`edit-toggle-chip ${dayData.evening ? 'active-evening' : ''}`}
                          onClick={() => updateDay('evening', !dayData.evening)}
                        >
                          🌙 ערב
                        </button>

                        <button 
                          type="button" 
                          className={`edit-toggle-chip ${dayData.off ? 'active-off' : ''}`}
                          onClick={() => updateDay('off', !dayData.off)}
                        >
                          🏖️ חופש
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="edit-general-note-row" style={{ marginTop: '16px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>הערה כללית:</label>
                <textarea 
                  className="modern-textarea"
                  rows={2}
                  value={editingSubmission.notes || ''}
                  onChange={(e) => setEditingSubmission(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => setEditingSubmission(null)}
                className="btn-secondary"
              >
                ביטול
              </button>
              <button 
                type="button" 
                onClick={() => handleSaveEdit(editingSubmission)}
                className="btn-primary"
              >
                שמור שינויים בנתוני העובד
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD MANUAL WAITER */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} dir="rtl" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>הוספת מלצר למאגר השיבוץ השבועי</h2>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                בחר עובד קיים או הקלד שם חדש:
              </label>
              
              <select 
                className="modern-select" 
                style={{ marginBottom: '12px' }}
                value={manualName} 
                onChange={(e) => setManualName(e.target.value)}
              >
                <option value="">-- בחר עובד מרשימת הצוות --</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>

              <div style={{ textAlign: 'center', margin: '8px 0', color: 'var(--text-muted)' }}>או</div>

              <input 
                type="text" 
                className="modern-input" 
                placeholder="הקלד שם מלצר חדש..."
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
              />
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">ביטול</button>
              <button 
                type="button" 
                onClick={() => handleCreateManual(manualName)} 
                className="btn-primary"
                disabled={!manualName.trim()}
              >
                הוסף והגדר משמרות
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
