import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, Check, Send, Sun, Moon, Sparkles, User, 
  AlertCircle, Plus, CheckCircle2, RotateCcw, ArrowRight, Utensils
} from 'lucide-react';

export default function WaiterSubmissionView({ 
  staffList, 
  weekDates, 
  onSaveSubmission, 
  existingSubmissions = [], 
  onBackToSchedule,
  isStandalone = false
}) {
  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'מוצ"ש'];

  const [selectedName, setSelectedName] = useState('');
  const [isCustomName, setIsCustomName] = useState(false);
  const [customNameInput, setCustomNameInput] = useState('');
  const [preferredCategory, setPreferredCategory] = useState('מסעדה');
  const [generalNotes, setGeneralNotes] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionSuccessInfo, setSubmissionSuccessInfo] = useState(null);

  // Initialize day availability state (Waiters submit Morning, Evening or Off)
  const initialDaysState = () => {
    const state = {};
    DAYS.forEach(day => {
      state[day] = {
        morning: false,
        evening: false,
        off: false,
        note: ''
      };
    });
    return state;
  };

  const [daysAvailability, setDaysAvailability] = useState(initialDaysState);

  // When a staff member is selected, pre-fill if they already submitted
  useEffect(() => {
    const currentName = isCustomName ? customNameInput.trim() : selectedName;
    if (!currentName) return;

    const prev = existingSubmissions.find(s => s.employeeName === currentName);
    if (prev && prev.days) {
      setDaysAvailability(prev.days);
      if (prev.preferredCategory) setPreferredCategory(prev.preferredCategory);
      if (prev.notes) setGeneralNotes(prev.notes);
    }
  }, [selectedName, customNameInput, isCustomName, existingSubmissions]);

  const toggleShift = (day, shiftType) => {
    setDaysAvailability(prev => {
      const currentDay = { ...prev[day] };

      if (shiftType === 'off') {
        const willBeOff = !currentDay.off;
        return {
          ...prev,
          [day]: {
            morning: false,
            evening: false,
            off: willBeOff,
            note: willBeOff ? 'חופש' : ''
          }
        };
      } else {
        // Toggle specific shift (morning, evening)
        const updatedVal = !currentDay[shiftType];
        return {
          ...prev,
          [day]: {
            ...currentDay,
            [shiftType]: updatedVal,
            off: false // If toggling a shift, remove 'off'
          }
        };
      }
    });
  };

  const setDayNote = (day, note) => {
    setDaysAvailability(prev => ({
      ...prev,
      [day]: { ...prev[day], note }
    }));
  };

  const setAllDays = (shiftType) => {
    setDaysAvailability(prev => {
      const updated = { ...prev };
      DAYS.forEach(day => {
        if (shiftType === 'evening') {
          updated[day] = { ...updated[day], evening: true, off: false };
        } else if (shiftType === 'morning') {
          updated[day] = { ...updated[day], morning: true, off: false };
        } else if (shiftType === 'clear') {
          updated[day] = { morning: false, evening: false, off: false, note: '' };
        }
      });
      return updated;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalName = isCustomName ? customNameInput.trim() : selectedName;
    
    if (!finalName) {
      alert('אנא בחר/י את שמך או הקלד/י שם חדש');
      return;
    }

    // Check if at least one day has availability or there are general notes
    const hasAnySelection = Object.values(daysAvailability).some(
      d => d.morning || d.evening || d.off
    ) || Boolean(generalNotes.trim());

    if (!hasAnySelection) {
      if (!window.confirm('לא סומנו משמרות. האם את/ה בטוח/ה שברצונך לשלוח טופס זה?')) {
        return;
      }
    }

    const submissionData = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      employeeName: finalName,
      submittedAt: new Date().toISOString(),
      preferredCategory: preferredCategory || 'מסעדה',
      notes: generalNotes.trim(),
      days: daysAvailability
    };

    onSaveSubmission(submissionData);
    setSubmissionSuccessInfo(submissionData);
    setIsSubmitted(true);
  };

  const handleResetForNew = () => {
    setSelectedName('');
    setCustomNameInput('');
    setIsCustomName(false);
    setDaysAvailability(initialDaysState());
    setGeneralNotes('');
    setIsSubmitted(false);
    setSubmissionSuccessInfo(null);
  };

  // Format short date for day
  const getDayShortDate = (index) => {
    if (!weekDates || !weekDates[index]) return '';
    const d = weekDates[index];
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}`;
  };

  return (
    <div className="waiter-submission-container" dir="rtl">
      
      {/* Top Mobile Bar */}
      <header className="submission-header">
        <div className="submission-brand">
          <div className="submission-logo-icon">
            <Utensils size={24} />
          </div>
          <div>
            <h1 className="submission-title">הגשת משמרות שבועית</h1>
            <p className="submission-subtitle">
              {weekDates && weekDates.length === 7 ? (
                <>שבוע {getDayShortDate(0)} — {getDayShortDate(6)}</>
              ) : 'מערכת שיבוץ ומשמרות'}
            </p>
          </div>
        </div>

        {!isStandalone && onBackToSchedule && (
          <button 
            type="button" 
            onClick={onBackToSchedule} 
            className="btn-back-to-schedule"
            title="חזרה ללוח המלא"
          >
            <span>לוח סידור עבודה</span>
            <ArrowRight size={16} />
          </button>
        )}
      </header>

      {/* SUCCESS SCREEN */}
      {isSubmitted && submissionSuccessInfo ? (
        <div className="submission-success-card">
          <div className="success-icon-wrapper">
            <CheckCircle2 size={56} className="text-success" />
          </div>
          <h2>תודה, {submissionSuccessInfo.employeeName}!</h2>
          <p className="success-lead">משמרותיך נשלחו בהצלחה ונקלטו במאגר השיבוץ של המנהל.</p>
          
          <div className="submitted-summary-box">
            <h4>סיכום ימים שנבחרו:</h4>
            <div className="summary-days-grid">
              {DAYS.map((day, idx) => {
                const info = submissionSuccessInfo.days[day];
                const activeBadges = [];
                if (info?.morning) activeBadges.push('בוקר ☀️');
                if (info?.evening) activeBadges.push('ערב 🌙');
                if (info?.off) activeBadges.push('חופש 🏖️');

                return (
                  <div key={day} className={`summary-day-item ${activeBadges.length > 0 ? 'has-shift' : ''}`}>
                    <span className="summary-day-name">{day} ({getDayShortDate(idx)}):</span>
                    <span className="summary-day-shifts">
                      {activeBadges.length > 0 ? activeBadges.join(', ') : 'לא סומן'}
                    </span>
                  </div>
                );
              })}
            </div>
            {submissionSuccessInfo.notes && (
              <div className="summary-general-note">
                <strong>הערה כללית:</strong> {submissionSuccessInfo.notes}
              </div>
            )}
          </div>

          <div className="success-actions">
            <button 
              type="button" 
              onClick={() => setIsSubmitted(false)} 
              className="btn-edit-submission"
            >
              <RotateCcw size={16} />
              <span>ערוך / שנה הגשה זו</span>
            </button>

            <button 
              type="button" 
              onClick={handleResetForNew} 
              className="btn-new-submission"
            >
              <User size={16} />
              <span>הגשת משמרות עבור עובד נוסף</span>
            </button>
          </div>
        </div>
      ) : (

        /* SUBMISSION FORM */
        <form onSubmit={handleSubmit} className="submission-form">

          {/* Employee Name Card */}
          <div className="submission-card name-card">
            <label className="card-label">
              <User size={18} />
              <span>מי מגיש/ה את המשמרות?</span>
            </label>

            {!isCustomName ? (
              <div className="name-selector-wrapper">
                <select 
                  className="modern-select"
                  value={selectedName}
                  onChange={(e) => setSelectedName(e.target.value)}
                >
                  <option value="">-- בחר/י את שמך מהרשימה --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>

                <button 
                  type="button" 
                  onClick={() => { setIsCustomName(true); setSelectedName(''); }} 
                  className="btn-switch-custom-name"
                >
                  <Plus size={14} />
                  <span>שמי לא ברשימה / עובד חדש</span>
                </button>
              </div>
            ) : (
              <div className="custom-name-wrapper">
                <input 
                  type="text" 
                  className="modern-input"
                  placeholder="הקלד/י כאן את שמך המלא..."
                  value={customNameInput}
                  onChange={(e) => setCustomNameInput(e.target.value)}
                  autoFocus
                />
                <button 
                  type="button" 
                  onClick={() => { setIsCustomName(false); setCustomNameInput(''); }} 
                  className="btn-switch-custom-name"
                >
                  <span>חזרה לבחירה מרשימת העובדים</span>
                </button>
              </div>
            )}

            <div className="department-select-row">
              <span className="sub-label">מחלקה מועדפת:</span>
              <div className="radio-pill-group">
                {['מסעדה', 'בייגל', 'יריד אוכל מוכן', 'מטבח', 'מארחות'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`radio-pill ${preferredCategory === cat ? 'active' : ''}`}
                    onClick={() => setPreferredCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Bulk Selection Tools */}
          <div className="quick-tools-bar">
            <span className="tools-title">סימון מהיר לכל השבוע:</span>
            <div className="tools-buttons">
              <button 
                type="button" 
                onClick={() => setAllDays('evening')} 
                className="tool-btn evening-tool"
              >
                <Moon size={14} />
                <span>כל יום ערב 🌙</span>
              </button>
              <button 
                type="button" 
                onClick={() => setAllDays('morning')} 
                className="tool-btn morning-tool"
              >
                <Sun size={14} />
                <span>כל יום בוקר ☀️</span>
              </button>
              <button 
                type="button" 
                onClick={() => setAllDays('clear')} 
                className="tool-btn clear-tool"
              >
                <RotateCcw size={14} />
                <span>נקה הכל</span>
              </button>
            </div>
          </div>

          {/* Day by Day Cards List */}
          <div className="days-submission-list">
            {DAYS.map((day, index) => {
              const dayData = daysAvailability[day] || {};
              const shortDate = getDayShortDate(index);

              return (
                <div 
                  key={day} 
                  className={`day-submission-card ${dayData.off ? 'day-off-card' : ''} ${dayData.morning || dayData.evening ? 'day-selected-card' : ''}`}
                >
                  <div className="day-card-header">
                    <div className="day-badge-wrap">
                      <span className="day-name">{day}</span>
                      {shortDate && <span className="day-date-badge">{shortDate}</span>}
                    </div>

                    <button 
                      type="button" 
                      onClick={() => toggleShift(day, 'off')}
                      className={`btn-day-off ${dayData.off ? 'active-off' : ''}`}
                    >
                      {dayData.off ? '🏖️ סומן כחופש' : '🏖️ לא יכול לעבוד'}
                    </button>
                  </div>

                  {!dayData.off ? (
                    <div className="shift-toggle-group">
                      {/* Morning Shift Toggle */}
                      <button 
                        type="button"
                        onClick={() => toggleShift(day, 'morning')}
                        className={`shift-toggle-btn morning-btn ${dayData.morning ? 'active' : ''}`}
                      >
                        <Sun size={18} />
                        <div className="shift-btn-text">
                          <span className="shift-btn-title">בוקר</span>
                          <span className="shift-btn-hours">
                            {preferredCategory === 'בייגל' ? '07:00-15:00' : '10:00-17:00'}
                          </span>
                        </div>
                        {dayData.morning && <Check size={16} className="check-icon" />}
                      </button>

                      {/* Evening Shift Toggle */}
                      <button 
                        type="button"
                        onClick={() => toggleShift(day, 'evening')}
                        className={`shift-toggle-btn evening-btn ${dayData.evening ? 'active' : ''}`}
                      >
                        <Moon size={18} />
                        <div className="shift-btn-text">
                          <span className="shift-btn-title">ערב</span>
                          <span className="shift-btn-hours">
                            {preferredCategory === 'בייגל' ? '15:00-23:00' : '17:00-01:00'}
                          </span>
                        </div>
                        {dayData.evening && <Check size={16} className="check-icon" />}
                      </button>
                    </div>
                  ) : (
                    <div className="day-off-banner">
                      <span>יום חופש מסומן - לא תשובץ ביום זה</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* General Notes Card */}
          <div className="submission-card notes-card">
            <label className="card-label">
              <Clock size={18} />
              <span>הערות כלליות למנהל:</span>
            </label>
            <textarea 
              className="modern-textarea"
              placeholder="כתוב/כתבי כאן בקשות מיוחדות, אילוצים, מבחנים, או שעות מיוחדות..."
              rows={3}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
            />
          </div>

          {/* Submit Action Card */}
          <div className="submission-submit-sticky">
            <button 
              type="submit" 
              className="btn-submit-shifts"
            >
              <Send size={20} />
              <span>שליחת משמרות לשבוע זה 🚀</span>
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
