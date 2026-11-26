import React, { useState, useMemo } from 'react';
import {
  Users, CheckCircle2, Clock, Calendar, Search, Filter,
  Send, Sparkles, Sun, Moon, Trash2, Edit3, Plus,
  Share2, ArrowRight, Check, AlertTriangle, UserPlus, ChevronDown, ChevronUp,
  Megaphone
} from 'lucide-react';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'מוצ"ש'];

const SHIFT_GROUP_ORDER = {
  morning_only: 0,
  evening_only: 1,
  both: 2,
  none: 3
};

const GROUP_SECTIONS = [
  {
    key: 'morning_only',
    icon: '☀️',
    title: 'רק בוקר',
    subtitle: 'מגישים בוקר בלבד — מומלץ לשבץ ראשונים למשמרות הבוקר',
    headerClass: 'pool-group-morning'
  },
  {
    key: 'evening_only',
    icon: '🌙',
    title: 'רק ערב',
    subtitle: 'מגישים ערב בלבד — מיועדים למשמרות הערב',
    headerClass: 'pool-group-evening'
  },
  {
    key: 'both',
    icon: '✨',
    title: 'גם וגם (גמישים — בוקר וערב)',
    subtitle: 'זמינים גם לבוקר וגם לערב — גמישים להשלמת פערים בסידור',
    headerClass: 'pool-group-both'
  },
  {
    key: 'none',
    icon: '🏖️',
    title: 'חופש / ללא משמרות פעילות',
    subtitle: 'סימנו חופש או טרם הוזנו להם משמרות',
    headerClass: 'pool-group-none'
  }
];

function formatShortDate(d) {
  if (!d) return '';
  const dateObj = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dateObj.getTime())) return '';
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
}

/**
 * Classifies a waiter's submission purely for display/sorting/filtering:
 * 'morning_only' | 'evening_only' | 'both' | 'none'.
 * Respects dayFilter when a specific day tab is selected.
 */
function getSubmissionShiftMeta(sub, dayFilter = '') {
  let totalMorning = 0;
  let totalEvening = 0;

  DAYS.forEach(day => {
    const info = sub.days?.[day];
    if (info && !info.off) {
      if (info.morning) totalMorning++;
      if (info.evening) totalEvening++;
    }
  });

  let scopeMorning = totalMorning;
  let scopeEvening = totalEvening;

  if (dayFilter) {
    const dInfo = sub.days?.[dayFilter];
    scopeMorning = dInfo && !dInfo.off && dInfo.morning ? 1 : 0;
    scopeEvening = dInfo && !dInfo.off && dInfo.evening ? 1 : 0;
  }

  let category = 'none';
  if (scopeMorning > 0 && scopeEvening === 0) category = 'morning_only';
  else if (scopeEvening > 0 && scopeMorning === 0) category = 'evening_only';
  else if (scopeMorning > 0 && scopeEvening > 0) category = 'both';

  let weeklyCategory = 'none';
  if (totalMorning > 0 && totalEvening === 0) weeklyCategory = 'morning_only';
  else if (totalEvening > 0 && totalMorning === 0) weeklyCategory = 'evening_only';
  else if (totalMorning > 0 && totalEvening > 0) weeklyCategory = 'both';

  return {
    category,
    weeklyCategory,
    totalMorning,
    totalEvening,
    scopeMorning,
    scopeEvening
  };
}

export default function SubmissionsPoolView({
  submissions = [],
  staffList = [],
  weekDates = [],
  submissionWeekMode = 'next',
  onChangeSubmissionWeekMode,
  onUpdateSubmissions,
  onAutoAssignToSchedule,
  onBackToSchedule,
  currentCategory = 'מסעדה',
  waiterShiftStats,
  managerMessage = null,
  onOpenManagerMessageModal
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState('');
  const [shiftTypeFilter, setShiftTypeFilter] = useState('all'); // 'all' | 'morning_only' | 'evening_only' | 'both' | 'none'
  const [sortMode, setSortMode] = useState('grouped'); // 'grouped' | 'recent'
  const [onlyUnfulfilled, setOnlyUnfulfilled] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
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

  // Base filtered submissions (search + day + unfulfilled toggle), enriched with shift-type metadata
  const enrichedBaseSubmissions = useMemo(() => {
    return submissions
      .filter(sub => {
        const matchesSearch = !searchQuery ||
          sub.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sub.notes?.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        if (selectedDayFilter) {
          const dayData = sub.days?.[selectedDayFilter];
          if (!dayData || dayData.off || (!dayData.morning && !dayData.evening)) return false;
        }

        if (onlyUnfulfilled && waiterShiftStats?.getStats) {
          const s = waiterShiftStats.getStats(sub.employeeName);
          if (s.requested > 0 && s.assigned >= s.requested) return false;
        }

        return true;
      })
      .map(sub => ({
        sub,
        meta: getSubmissionShiftMeta(sub, selectedDayFilter)
      }));
  }, [submissions, searchQuery, selectedDayFilter, onlyUnfulfilled, waiterShiftStats]);

  // Live group counts before applying the shiftTypeFilter pill
  const shiftGroupCounts = useMemo(() => {
    const counts = { all: enrichedBaseSubmissions.length, morning_only: 0, evening_only: 0, both: 0, none: 0 };
    enrichedBaseSubmissions.forEach(item => {
      counts[item.meta.category] = (counts[item.meta.category] || 0) + 1;
    });
    return counts;
  }, [enrichedBaseSubmissions]);

  // Final filtered & sorted submissions
  const filteredItems = useMemo(() => {
    const list = shiftTypeFilter === 'all'
      ? enrichedBaseSubmissions
      : enrichedBaseSubmissions.filter(item => item.meta.category === shiftTypeFilter);

    if (sortMode === 'recent') {
      return [...list].sort(
        (a, b) => new Date(b.sub.submittedAt || 0) - new Date(a.sub.submittedAt || 0)
      );
    }

    // Grouped order: Morning Only (top) -> Evening Only (middle) -> Both (bottom) -> None
    return [...list].sort((a, b) => {
      const orderDiff = (SHIFT_GROUP_ORDER[a.meta.category] ?? 99) - (SHIFT_GROUP_ORDER[b.meta.category] ?? 99);
      if (orderDiff !== 0) return orderDiff;
      return new Date(b.sub.submittedAt || 0) - new Date(a.sub.submittedAt || 0);
    });
  }, [enrichedBaseSubmissions, shiftTypeFilter, sortMode]);

  const toggleGroupCollapse = (groupKey) => {
    setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // Copy WhatsApp Reminder Message
  const handleCopyWhatsAppReminder = () => {
    const currentUrl = window.location.origin + window.location.pathname + '?view=submit';
    const missingNamesList = missingStaff.map(s => `• ${s.name}`).join('\n');
    const weekRangeStr = weekDates?.length === 7
      ? ` (${formatShortDate(weekDates[0])} - ${formatShortDate(weekDates[6])})`
      : '';
    const managerIncentiveSnippet = (managerMessage?.active && managerMessage?.text)
      ? `\n🍹 *הודעת מנהל ומבצע השבוע לצוות:* \n${managerMessage.text}\n`
      : '';

    const message = `היי צוות יקר! 👋
אפשר להתחיל לשלוח משמרות לשבוע הקרוב${weekRangeStr} דרך הקישור הנוח:
${currentUrl}${managerIncentiveSnippet}
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

  const renderSubmissionCard = (sub, meta) => {
    const stat = waiterShiftStats?.getStats ? waiterShiftStats.getStats(sub.employeeName) : null;
    const isFull = stat && stat.requested > 0 && stat.assigned >= stat.requested;
    const isPartial = stat && stat.assigned > 0 && stat.assigned < stat.requested;
    const isZero = stat && stat.assigned === 0;
    const isOver = stat && stat.assigned > stat.requested;

    const shiftTypePill =
      meta.category === 'morning_only' ? (
        <span className="sub-shift-type-pill type-morning-only">
          ☀️ רק בוקר {selectedDayFilter ? `(סה״כ ${meta.totalMorning})` : `(${meta.totalMorning} משמרות)`}
        </span>
      ) : meta.category === 'evening_only' ? (
        <span className="sub-shift-type-pill type-evening-only">
          🌙 רק ערב {selectedDayFilter ? `(סה״כ ${meta.totalEvening})` : `(${meta.totalEvening} משמרות)`}
        </span>
      ) : meta.category === 'both' ? (
        <span className="sub-shift-type-pill type-both">
          ✨ גם וגם ({meta.totalMorning}☀️ + {meta.totalEvening}🌙)
        </span>
      ) : (
        <span className="sub-shift-type-pill type-none">
          🏖️ חופש / ללא משמרות
        </span>
      );

    return (
      <div key={sub.id} className={`submission-card-item type-card-${meta.category}`}>
        <div className="sub-item-header">
          <div>
            <div className="sub-title-with-badge">
              <h3 className="sub-employee-name">{sub.employeeName}</h3>
              {shiftTypePill}
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
            const isHighlightedDay = selectedDayFilter === day;

            return (
              <div
                key={day}
                className={`day-badge-col ${isAny ? 'active-day-col' : ''} ${isOff ? 'off-day-col' : ''} ${isHighlightedDay ? 'highlighted-day-col' : ''}`}
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
              כל המלצרים שנרשמו והגישו משמרות — מסודרים אוטומטית לפי רק בוקר, רק ערב וגם וגם
            </p>
            {weekDates && weekDates.length === 7 && (
              <div className="pool-week-banner">
                <Calendar size={15} />
                <span>
                  קישור המלצרים פתוח כעת עבור שבוע:{' '}
                  <strong>{formatShortDate(weekDates[0])} — {formatShortDate(weekDates[6])}</strong>
                </span>
                {onChangeSubmissionWeekMode && (
                  <select
                    className="pool-week-select"
                    value={submissionWeekMode}
                    onChange={(e) => onChangeSubmissionWeekMode(e.target.value)}
                    title="בחר איזה תאריכים יוצגו למלצרים בקישור ההגשה"
                  >
                    <option value="next">שבוע הבא (ברירת מחדל)</option>
                    <option value="current">השבוע הנוכחי</option>
                    <option value="next2">בעוד שבועיים</option>
                  </select>
                )}
              </div>
            )}
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

            {onOpenManagerMessageModal && (
              <button
                type="button"
                onClick={onOpenManagerMessageModal}
                className="btn-pool-action btn-manager-msg"
                style={{
                  background: managerMessage?.active ? 'rgba(245, 158, 11, 0.15)' : 'var(--card-bg)',
                  borderColor: managerMessage?.active ? '#f59e0b' : 'var(--card-border)',
                  color: managerMessage?.active ? (document.body.classList.contains('dark-mode') ? '#fef08a' : '#78350f') : 'var(--text-dark)'
                }}
                title="ערוך הודעת מנהל, בונוס שבועי ומבצעים למלצרים"
              >
                <Megaphone size={16} style={{ color: '#f59e0b' }} />
                <span>הודעת מנהל ובונוס</span>
                {managerMessage?.active ? (
                  <span className="pool-dot-active" style={{ background: '#10b981', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' }} />
                ) : (
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>(+ חדש)</span>
                )}
              </button>
            )}

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

        {/* Manager Incentive Preview inside Pool */}
        {managerMessage?.active && managerMessage?.text && (
          <div className="pool-manager-announcement-bar" style={{
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            border: '1.5px solid #f59e0b',
            borderRadius: '10px',
            padding: '10px 16px',
            marginTop: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#78350f', fontSize: '0.92rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🍹</span>
              <strong>מוצג כעת בקישור המלצרים:</strong>
              <span style={{ fontWeight: '500' }}>{managerMessage.text}</span>
            </div>
            {onOpenManagerMessageModal && (
              <button 
                type="button" 
                onClick={onOpenManagerMessageModal}
                style={{ background: '#fff', border: '1px solid #f59e0b', color: '#78350f', borderRadius: '6px', padding: '4px 10px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
              >
                ערוך הודעה ✏️
              </button>
            )}
          </div>
        )}

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

      {/* Search, Day Filters & Smart Shift-Type Separator */}
      <div className="pool-controls-bar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="pool-controls-top-row">
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

        {/* Smart Shift-Type Filter & Grouping Bar */}
        <div className="shift-type-controls-row">
          <div className="shift-type-pills-group">
            <span className="filter-label">
              <Filter size={14} style={{ verticalAlign: 'middle', marginLeft: '4px' }} />
              {selectedDayFilter ? `סידור ליום ${selectedDayFilter}:` : 'סוג משמרת:'}
            </span>

            <button
              type="button"
              className={`shift-type-btn ${shiftTypeFilter === 'all' ? 'active-all' : ''}`}
              onClick={() => setShiftTypeFilter('all')}
            >
              📋 הכל לפי קבוצות ({shiftGroupCounts.all})
            </button>

            <button
              type="button"
              className={`shift-type-btn btn-type-morning ${shiftTypeFilter === 'morning_only' ? 'active' : ''}`}
              onClick={() => setShiftTypeFilter(shiftTypeFilter === 'morning_only' ? 'all' : 'morning_only')}
            >
              ☀️ רק בוקר ({shiftGroupCounts.morning_only})
            </button>

            <button
              type="button"
              className={`shift-type-btn btn-type-evening ${shiftTypeFilter === 'evening_only' ? 'active' : ''}`}
              onClick={() => setShiftTypeFilter(shiftTypeFilter === 'evening_only' ? 'all' : 'evening_only')}
            >
              🌙 רק ערב ({shiftGroupCounts.evening_only})
            </button>

            <button
              type="button"
              className={`shift-type-btn btn-type-both ${shiftTypeFilter === 'both' ? 'active' : ''}`}
              onClick={() => setShiftTypeFilter(shiftTypeFilter === 'both' ? 'all' : 'both')}
            >
              ✨ גם וגם ({shiftGroupCounts.both})
            </button>

            {shiftGroupCounts.none > 0 && (
              <button
                type="button"
                className={`shift-type-btn btn-type-none ${shiftTypeFilter === 'none' ? 'active' : ''}`}
                onClick={() => setShiftTypeFilter(shiftTypeFilter === 'none' ? 'all' : 'none')}
              >
                🏖️ חופש/ללא ({shiftGroupCounts.none})
              </button>
            )}
          </div>

          <div className="shift-sort-toggles">
            {waiterShiftStats?.getStats && (
              <button
                type="button"
                className={`shift-util-toggle ${onlyUnfulfilled ? 'active' : ''}`}
                onClick={() => setOnlyUnfulfilled(!onlyUnfulfilled)}
                title="הסתר עובדים שכבר שובצו במלוא מכסת המשמרות שביקשו"
              >
                <Clock size={14} />
                <span>{onlyUnfulfilled ? 'מציג רק שטרם הושלמו ✓' : 'הסתר משובצים מלא'}</span>
              </button>
            )}

            <button
              type="button"
              className={`shift-util-toggle ${sortMode === 'grouped' ? 'active' : ''}`}
              onClick={() => setSortMode(sortMode === 'grouped' ? 'recent' : 'grouped')}
              title="החלף בין חלוקה מסודרת (רק בוקר / רק ערב / גם וגם) לבין סדר הגשה כרונולוגי"
            >
              <span>{sortMode === 'grouped' ? 'מיון: בוקר ← ערב ← גם וגם' : 'מיון: לפי שעת שליחה'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Submissions List */}
      <div className="submissions-grid">
        {filteredItems.length === 0 ? (
          <div className="empty-submissions-box">
            <Users size={48} className="text-muted" />
            <h3>לא נמצאו הגשות משמרות התואמות לחיפוש</h3>
            <p>שלח את הקישור למלצרים בווטסאפ, בטל סינון קיים, או הוסף מלצר ידנית</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
              {(shiftTypeFilter !== 'all' || selectedDayFilter || searchQuery || onlyUnfulfilled) && (
                <button
                  type="button"
                  onClick={() => {
                    setShiftTypeFilter('all');
                    setSelectedDayFilter('');
                    setSearchQuery('');
                    setOnlyUnfulfilled(false);
                  }}
                  className="btn-secondary"
                >
                  נקה סינונים והצג הכל
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyWhatsAppReminder}
                className="btn-primary"
              >
                <Send size={16} /> שלח הודעת ווטסאפ למלצרים
              </button>
            </div>
          </div>
        ) : sortMode === 'grouped' && shiftTypeFilter === 'all' ? (
          GROUP_SECTIONS.map(section => {
            const itemsInGroup = filteredItems.filter(item => item.meta.category === section.key);
            if (itemsInGroup.length === 0) return null;
            const isCollapsed = Boolean(collapsedGroups[section.key]);

            return (
              <div key={section.key} className="pool-group-section">
                <button
                  type="button"
                  className={`pool-group-header ${section.headerClass}`}
                  onClick={() => toggleGroupCollapse(section.key)}
                  title={isCollapsed ? 'לחץ לפתיחת הקבוצה' : 'לחץ לכיווץ הקבוצה'}
                >
                  <div className="pool-group-header-info">
                    <span className="pool-group-icon">{section.icon}</span>
                    <div className="pool-group-texts">
                      <div className="pool-group-title-row">
                        <span className="pool-group-title">{section.title}</span>
                        <span className="pool-group-count">{itemsInGroup.length} עובדים</span>
                      </div>
                      <span className="pool-group-subtitle">{section.subtitle}</span>
                    </div>
                  </div>
                  <span className="pool-group-chevron">
                    {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="pool-group-cards">
                    {itemsInGroup.map(({ sub, meta }) => renderSubmissionCard(sub, meta))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          filteredItems.map(({ sub, meta }) => renderSubmissionCard(sub, meta))
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
