import html2canvas from 'html2canvas';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertCircle, Calendar, Clock, User, Briefcase, Trash2, Users, 
  LayoutDashboard, Utensils, Coffee, Store, Plus, Save, Moon, Sun, 
  Download, History, ChefHat, CheckCircle, UserCheck, Flame, 
  ChevronRight, ChevronLeft, CalendarDays, Sunrise, Sunset,
  Cloud, Database, Settings, Check, X, ExternalLink, Share2,
  Send, Sparkles, Menu, ClipboardList, UserPlus, Smartphone,
  Lock, KeyRound
} from 'lucide-react';
import initialSchedule from './schedule.json';
import initialStaff from './staff.json';
import initialSubmissions from './submissions.json';
import WaiterSubmissionView from './components/WaiterSubmissionView.jsx';
import SubmissionsPoolView from './components/SubmissionsPoolView.jsx';
import ManagerLockScreen from './components/ManagerLockScreen.jsx';
import { 
  isFirebaseConfigured, 
  getFirebaseConfig, 
  saveFirebaseConfig, 
  subscribeToSchedule, 
  saveScheduleToCloud, 
  subscribeToStaff, 
  saveStaffToCloud, 
  subscribeToArchives, 
  saveArchiveToCloud,
  subscribeToSubmissions,
  saveSubmissionsToCloud
} from './firebase.js';
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

// Israeli Calendar Date Helpers (Week begins on Sunday)
function getSundayOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay(); // 0 is Sunday, 6 is Saturday
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateShort(d) {
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
}

function formatDateFull(d) {
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function getWeekDates(weekStartSunday) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartSunday);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function isToday(d) {
  if (!d) return false;
  const today = new Date();
  return d.getDate() === today.getDate() &&
         d.getMonth() === today.getMonth() &&
         d.getFullYear() === today.getFullYear();
}

function App() {
  const [currentView, setCurrentView] = useState('employees'); 
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  // Export / Image Preview State (Cross-Platform & iPad Compatible)
  const [isExporting, setIsExporting] = useState(false);
  const [previewModal, setPreviewModal] = useState({ isOpen: false, imageUrl: '', title: '', fileName: '' });

  // Mobile & iPad Navigation Drawer & View State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileActiveDay, setMobileActiveDay] = useState('ראשון');
  const [mobileViewMode, setMobileViewMode] = useState('table'); // 'table' or 'day'

  // Manager Security & Access Control State
  const [isManagerAuthenticated, setIsManagerAuthenticated] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('shiftApp_managerAuth') === 'true';
  });
  const [managerPin, setManagerPin] = useState(() => {
    return localStorage.getItem('shiftApp_managerPin') || '1234';
  });
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [pinChangeForm, setPinChangeForm] = useState({ oldPin: '', newPin: '', confirmPin: '', error: '', success: '' });

  const handleManagerLock = () => {
    localStorage.removeItem('shiftApp_managerAuth');
    setIsManagerAuthenticated(false);
  };

  const handleManagerUnlock = () => {
    localStorage.setItem('shiftApp_managerAuth', 'true');
    setIsManagerAuthenticated(true);
  };

  const handleSaveNewPin = (e) => {
    e.preventDefault();
    if (pinChangeForm.oldPin !== managerPin) {
      setPinChangeForm(prev => ({ ...prev, error: 'הקוד הנוכחי אינו נכון', success: '' }));
      return;
    }
    if (!pinChangeForm.newPin || pinChangeForm.newPin.length < 4) {
      setPinChangeForm(prev => ({ ...prev, error: 'הקוד החדש חייב להכיל לפחות 4 תווים', success: '' }));
      return;
    }
    if (pinChangeForm.newPin !== pinChangeForm.confirmPin) {
      setPinChangeForm(prev => ({ ...prev, error: 'אימות הקוד אינו תואם', success: '' }));
      return;
    }
    localStorage.setItem('shiftApp_managerPin', pinChangeForm.newPin);
    setManagerPin(pinChangeForm.newPin);
    setPinChangeForm({ oldPin: '', newPin: '', confirmPin: '', error: '', success: 'קוד הגישה למנהל עודכן בהצלחה!' });
    setTimeout(() => {
      setShowChangePinModal(false);
      setPinChangeForm({ oldPin: '', newPin: '', confirmPin: '', error: '', success: '' });
    }, 1200);
  };

  // Firebase Configuration & State
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(() => isFirebaseConfigured());
  const [firebaseConfigForm, setFirebaseConfigForm] = useState(() => getFirebaseConfig());
  const [rawConfigInput, setRawConfigInput] = useState('');
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);

  // Calculate current Israeli week dates based on weekOffset
  const currentSunday = useMemo(() => {
    const sun = getSundayOfWeek(new Date());
    sun.setDate(sun.getDate() + weekOffset * 7);
    return sun;
  }, [weekOffset]);

  const weekDates = useMemo(() => getWeekDates(currentSunday), [currentSunday]);

  // Robust Cross-Platform Export Function (Supports iPadOS, iOS Safari, Android & Desktop)
  const exportElementAsImage = async (elementId, title, fileName) => {
    const target = document.getElementById(elementId);
    if (!target || isExporting) return;

    setIsExporting(true);

    const origWidth = target.style.width;
    const origHeight = target.style.height;
    const origOverflow = target.style.overflow;
    const origMinWidth = target.style.minWidth;
    const origMaxWidth = target.style.maxWidth;

    target.style.width = 'fit-content';
    target.style.minWidth = '1200px';
    target.style.maxWidth = 'none';
    target.style.height = 'fit-content';
    target.style.overflow = 'visible';

    try {
      // Allow React 250ms to re-render clean static cards (pure HTML text instead of <input>)
      await new Promise(resolve => setTimeout(resolve, 250));

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
        windowWidth: Math.max(target.scrollWidth, 1250),
        windowHeight: target.scrollHeight,
        onclone: (clonedDoc) => {
          const clonedTarget = clonedDoc.getElementById(elementId);
          if (clonedTarget) {
            clonedTarget.setAttribute('dir', 'rtl');
            clonedTarget.style.direction = 'rtl';

            // Clean up any remaining interactive elements or badges that shouldn't appear in WhatsApp image
            clonedTarget.querySelectorAll(
              '.clear-cell-btn, .quick-event-btn, .btn-quick-fill-chip, .slot-avail-hint, .emp-ratio-badge, .legend-ratio-pill, .day-available-count-badge'
            ).forEach(el => el.remove());
          }
        }
      });

      const dataUrl = canvas.toDataURL('image/png');

      canvas.toBlob(async (blob) => {
        let sharedSuccessfully = false;
        if (blob) {
          const file = new File([blob], `${fileName}.png`, { type: 'image/png' });

          // Try native Web Share API (Native iPadOS / iOS Share Sheet)
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: title,
                text: `סידור עבודה: ${title}`
              });
              sharedSuccessfully = true;
            } catch (shareErr) {
              if (shareErr.name === 'AbortError') {
                sharedSuccessfully = true;
              }
            }
          }

          if (!sharedSuccessfully) {
            try {
              const blobUrl = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = blobUrl;
              link.download = `${fileName}.png`;
              document.body.appendChild(link);
              link.click();
              setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
              }, 1000);
            } catch (e) {}
          }
        }

        // Detect iPad / iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        // Open preview modal on iPad/iOS or if not natively shared
        if (isIOS || !sharedSuccessfully) {
          setPreviewModal({
            isOpen: true,
            imageUrl: dataUrl,
            title: title,
            fileName: fileName
          });
        }
      }, 'image/png');

    } catch (err) {
      console.error('Failed to export schedule:', err);
      alert('אירעה שגיאה בייצוא התמונה. אנא נסה שנית.');
    } finally {
      target.style.width = origWidth;
      target.style.minWidth = origMinWidth;
      target.style.maxWidth = origMaxWidth;
      target.style.height = origHeight;
      target.style.overflow = origOverflow;
      setIsExporting(false);
    }
  };

  const handleExportSchedule = () => {
    const fileName = `סידור_עבודה_${currentView}_${formatDateShort(weekDates[0])}-${formatDateShort(weekDates[6])}`;
    const title = `סידור עבודה: ${currentView} (${formatDateShort(weekDates[0])} - ${formatDateShort(weekDates[6])})`;
    exportElementAsImage('schedule-export-target', title, fileName);
  };

  const handleExportPersonal = () => {
    const fileName = `לוז_אישי_${selectedEmployeeForPersonal}_${formatDateShort(weekDates[0])}-${formatDateShort(weekDates[6])}`;
    const title = `לו"ז אישי: ${selectedEmployeeForPersonal} (${formatDateShort(weekDates[0])} - ${formatDateShort(weekDates[6])})`;
    exportElementAsImage('personal-export-target', title, fileName);
  };

  // Staff List (Global directory of all employees)
  const [staffList, setStaffList] = useState(() => {
    const saved = localStorage.getItem('shiftApp_staffList');
    return saved && JSON.parse(saved).length > 0 ? JSON.parse(saved) : initialStaff;
  });
  const [newStaffName, setNewStaffName] = useState('');

  // Shift Submissions Pool (New waiter requests database)
  const [submissions, setSubmissions] = useState(() => {
    const saved = localStorage.getItem('shiftApp_submissions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return Array.isArray(initialSubmissions) ? initialSubmissions : [];
  });

  const PREDEFINED_ROLES = [
    'אירוע',
    'אחראי אירוע',
    'מנהל משמרת',
    'אחראי קופה',
    'מארחת',
    'פס חם',
    'פס קר',
    'מילוי אוכל'
  ];

  // Standalone Waiter Submission Mode detection (e.g. from WhatsApp link ?view=submit or #submit)
  // When active, waiters are completely locked into self-submission portal with zero access to schedule/manager data
  const [isStandaloneSubmit, setIsStandaloneSubmit] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'submit' || window.location.hash === '#submit';
  });

  useEffect(() => {
    const handleUrlCheck = () => {
      const params = new URLSearchParams(window.location.search);
      setIsStandaloneSubmit(params.get('view') === 'submit' || window.location.hash === '#submit');
    };
    window.addEventListener('popstate', handleUrlCheck);
    return () => window.removeEventListener('popstate', handleUrlCheck);
  }, []);

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
  const [shifts, setShifts] = useState(() => {
    const saved = localStorage.getItem('shiftApp_shifts');
    if (saved) {
      try {
        return ensureCategoriesExist(JSON.parse(saved));
      } catch (e) {}
    }
    return ensureCategoriesExist(initialSchedule);
  });

  const [archives, setArchives] = useState(() => {
    const saved = localStorage.getItem('shiftApp_archives');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  const [selectedArchiveWeek, setSelectedArchiveWeek] = useState(null);
  const [selectedPersonalWeekId, setSelectedPersonalWeekId] = useState('current');

  // Load local dev archives & submissions if available
  useEffect(() => {
    fetch('/api/get-archives')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setArchives(data);
          localStorage.setItem('shiftApp_archives', JSON.stringify(data));
        }
      })
      .catch(() => {});

    fetch('/api/get-submissions')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setSubmissions(data);
          localStorage.setItem('shiftApp_submissions', JSON.stringify(data));
        }
      })
      .catch(() => {});
  }, []);

  // Firebase Real-time Cloud Synchronization
  useEffect(() => {
    if (!isCloudConnected) return;

    // 1. Subscribe to schedule changes in Firestore
    const unsubSchedule = subscribeToSchedule((cloudShifts) => {
      if (cloudShifts) {
        setShifts(ensureCategoriesExist(cloudShifts));
        localStorage.setItem('shiftApp_shifts', JSON.stringify(cloudShifts));
      }
    });

    // 2. Subscribe to staff changes in Firestore
    const unsubStaff = subscribeToStaff((cloudStaff) => {
      if (cloudStaff && Array.isArray(cloudStaff)) {
        setStaffList(cloudStaff);
        localStorage.setItem('shiftApp_staffList', JSON.stringify(cloudStaff));
      }
    });

    // 3. Subscribe to archives changes in Firestore
    const unsubArchives = subscribeToArchives((cloudArchives) => {
      if (cloudArchives && Array.isArray(cloudArchives)) {
        setArchives(cloudArchives);
        localStorage.setItem('shiftApp_archives', JSON.stringify(cloudArchives));
      }
    });

    // 4. Subscribe to shift submissions pool in Firestore
    const unsubSubmissions = subscribeToSubmissions((cloudSubmissions) => {
      if (cloudSubmissions && Array.isArray(cloudSubmissions)) {
        setSubmissions(cloudSubmissions);
        localStorage.setItem('shiftApp_submissions', JSON.stringify(cloudSubmissions));
      }
    });

    return () => {
      if (unsubSchedule) unsubSchedule();
      if (unsubStaff) unsubStaff();
      if (unsubArchives) unsubArchives();
      if (unsubSubmissions) unsubSubmissions();
    };
  }, [isCloudConnected]);

  // Shift counts for each waiter: how many requested vs how many assigned in this week's schedule
  const waiterShiftStats = useMemo(() => {
    // 1. Calculate requested count from submissions
    const requested = {};
    submissions.forEach(sub => {
      const name = (sub.employeeName || '').trim();
      if (!name) return;
      let count = 0;
      DAYS.forEach(day => {
        const d = sub.days?.[day];
        if (d && !d.off) {
          if (d.morning) count++;
          if (d.evening) count++;
        }
      });
      requested[name.toLowerCase()] = count;
    });

    // 2. Calculate assigned count across all categories/shifts in the schedule
    const assigned = {};
    CATEGORIES.forEach(cat => {
      DAYS.forEach(day => {
        (shifts[cat]?.[day] || []).forEach(slot => {
          if (slot.employee && slot.employee.trim()) {
            const name = slot.employee.trim().toLowerCase();
            assigned[name] = (assigned[name] || 0) + 1;
          }
        });
      });
    });

    // Helper function for any employee name
    const getStats = (empName) => {
      if (!empName) return { assigned: 0, requested: null, label: '0', fullLabel: '0' };
      const key = empName.trim().toLowerCase();
      const a = assigned[key] || 0;
      const r = requested[key] !== undefined ? requested[key] : null;
      return {
        assigned: a,
        requested: r,
        label: r !== null ? `${a}/${r}` : `${a}`,
        fullLabel: r !== null ? `${a} מתוך ${r}` : `${a} משמרות`
      };
    };

    return { assigned, requested, getStats };
  }, [submissions, shifts]);

  // Available waiters grouped by day and shift type (derived from submissions)
  const availableWaitersByDay = useMemo(() => {
    const map = {};
    DAYS.forEach(day => {
      map[day] = {
        morning: [],
        evening: [],
        all: []
      };
    });

    submissions.forEach(sub => {
      DAYS.forEach(day => {
        const d = sub.days?.[day];
        if (d && !d.off) {
          const empName = sub.employeeName;
          const stat = waiterShiftStats.getStats(empName);
          if (d.morning) map[day].morning.push({ name: empName, note: d.note, stat });
          if (d.evening) map[day].evening.push({ name: empName, note: d.note, stat });
          if (d.morning || d.evening) {
            map[day].all.push({ 
              name: empName, 
              shifts: [d.morning && 'בוקר', d.evening && 'ערב'].filter(Boolean).join('/'),
              note: d.note,
              stat
            });
          }
        }
      });
    });

    return map;
  }, [submissions, waiterShiftStats]);

  // Combined list of all known staff including newly submitted waiters
  const allKnownEmployees = useMemo(() => {
    const names = new Set(staffList.map(s => s.name.trim().toLowerCase()));
    const combined = [...staffList];
    submissions.forEach(sub => {
      const clean = (sub.employeeName || '').trim();
      if (clean && !names.has(clean.toLowerCase())) {
        names.add(clean.toLowerCase());
        combined.push({ id: sub.id, name: clean });
      }
    });
    return combined;
  }, [staffList, submissions]);

  // Unique color coding for each waiter (makes identification instant on screen and in WhatsApp image)
  const [showEmployeeColors, setShowEmployeeColors] = useState(() => {
    const saved = localStorage.getItem('shiftApp_showEmployeeColors');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Mathematical HSL Spectrum Distribution (Idea 2) + Unique Geometric/Identifiable Symbols (Idea 3)
  // Ensures unlimited employees have 100% unique color shades and unique identifiable symbols!
  const EMPLOYEE_SYMBOLS = useMemo(() => [
    '●', '◆', '▲', '★', '■', '✦', '◈', '⬡', 
    '✿', '❖', '💎', '⚡', '⭐', '☀️', '🌙', '🔥',
    '⬤', '⯁', '⯀', '✪', '❂', '✱', '✧', '᯽'
  ], []);

  const getEmployeeColor = (name) => {
    if (!name || typeof name !== 'string') return null;
    const clean = name.trim();
    if (!clean) return null;

    let index = allKnownEmployees.findIndex(
      e => (e.name || '').trim().toLowerCase() === clean.toLowerCase()
    );

    if (index < 0) {
      let hash = 0;
      for (let i = 0; i < clean.length; i++) {
        hash = clean.charCodeAt(i) + ((hash << 5) - hash);
      }
      index = Math.abs(hash);
    }

    // Golden Ratio hue distribution (137.508°) spreads hues evenly around the 360° color wheel
    // so adjacent workers get completely distinct hues without collisions
    const hue = Math.round((index * 137.508) % 360);
    const symbol = EMPLOYEE_SYMBOLS[index % EMPLOYEE_SYMBOLS.length];

    const lightBg = `hsl(${hue}, 92%, 95%)`;
    const lightBorder = `hsl(${hue}, 75%, 40%)`;
    const lightText = `hsl(${hue}, 92%, 18%)`;

    const darkBg = `hsla(${hue}, 65%, 26%, 0.38)`;
    const darkBorder = `hsl(${hue}, 70%, 55%)`;
    const darkText = `hsl(${hue}, 85%, 85%)`;

    return {
      hue,
      symbol,
      border: isDarkMode ? darkBorder : lightBorder,
      bg: isDarkMode ? darkBg : lightBg,
      text: isDarkMode ? darkText : lightText,
      dot: isDarkMode ? darkBorder : lightBorder
    };
  };

  const activeEmployeesInCurrentSchedule = useMemo(() => {
    const set = new Set();
    const currentSched = shifts[currentView] || {};
    DAYS.forEach(day => {
      (currentSched[day] || []).forEach(slot => {
        if (slot.employee && slot.employee.trim()) {
          set.add(slot.employee.trim());
        }
      });
    });
    return Array.from(set).sort();
  }, [shifts, currentView]);

  // Handler: Waiter submits availability
  const handleSaveSubmission = (newSub) => {
    setSubmissions(prev => {
      const existingIdx = prev.findIndex(s => 
        (s.employeeName || '').trim().toLowerCase() === (newSub.employeeName || '').trim().toLowerCase()
      );
      let updated;
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = newSub;
      } else {
        updated = [...prev, newSub];
      }

      localStorage.setItem('shiftApp_submissions', JSON.stringify(updated));
      saveSubmissionsToCloud(updated);

      fetch('/api/save-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      }).catch(() => {});

      return updated;
    });

    // If new waiter name is not in staffList, also add to staffList
    if (newSub.employeeName) {
      setStaffList(prevStaff => {
        const cleanName = newSub.employeeName.trim();
        const exists = prevStaff.some(s => s.name.trim().toLowerCase() === cleanName.toLowerCase());
        if (!exists) {
          const updatedStaff = [...prevStaff, { id: Date.now(), name: cleanName }];
          localStorage.setItem('shiftApp_staffList', JSON.stringify(updatedStaff));
          saveStaffToCloud(updatedStaff);
          return updatedStaff;
        }
        return prevStaff;
      });
    }
  };

  // Handler: Manager updates submissions list
  const handleUpdateSubmissions = (updatedList) => {
    setSubmissions(updatedList);
    localStorage.setItem('shiftApp_submissions', JSON.stringify(updatedList));
    saveSubmissionsToCloud(updatedList);

    fetch('/api/save-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedList)
    }).catch(() => {});
  };

  // Handler: Smart auto-assign from submission to schedule
  const handleAutoAssignToSchedule = (submission) => {
    const targetCategory = submission.preferredCategory || (CATEGORIES.includes(currentView) ? currentView : 'מסעדה');
    let assignedCount = 0;

    setShifts(prev => {
      const newShifts = JSON.parse(JSON.stringify(prev));
      if (!newShifts[targetCategory]) return prev;

      DAYS.forEach(day => {
        const dayReq = submission.days?.[day];
        if (!dayReq || dayReq.off) return;

        const daySlots = newShifts[targetCategory][day] || [];

        // Try assigning morning shift if requested
        if (dayReq.morning) {
          const emptyMorningSlot = daySlots.find(s => {
            const h = parseInt((s.start || '12:00').split(':')[0], 10);
            return (!s.employee || s.employee.trim() === '') && h < 16;
          });
          if (emptyMorningSlot) {
            emptyMorningSlot.employee = submission.employeeName;
            assignedCount++;
          }
        }

        // Try assigning evening shift if requested
        if (dayReq.evening) {
          const emptyEveningSlot = daySlots.find(s => {
            const h = parseInt((s.start || '17:00').split(':')[0], 10);
            return (!s.employee || s.employee.trim() === '') && h >= 16;
          });
          if (emptyEveningSlot) {
            emptyEveningSlot.employee = submission.employeeName;
            assignedCount++;
          }
        }
      });

      localStorage.setItem('shiftApp_shifts', JSON.stringify(newShifts));
      saveScheduleToCloud(newShifts);

      fetch('/api/save-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShifts)
      }).catch(() => {});

      return newShifts;
    });

    alert(`העובד "${submission.employeeName}" שובץ ב-${assignedCount} משמרות במחלקת "${targetCategory}"!\nתוכל לראות את השיבוץ בלוח ולשנות כרצונך.`);
  };

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

  const addRow = (category, section = 'evening') => {
    setShifts(prev => {
      const newShifts = JSON.parse(JSON.stringify(prev));
      let startT = '17:00';
      let endT = '01:00';
      let defaultRole = '';

      if (section === 'event') {
        startT = '18:00';
        endT = '01:00';
        defaultRole = 'אירוע';
      } else if (category === 'בייגל') {
        if (section === 'morning') {
          startT = '07:00';
          endT = '15:00';
        } else if (section === 'mid') {
          startT = '10:00';
          endT = '19:00';
        } else {
          startT = '15:00';
          endT = '23:00';
        }
      } else {
        if (section === 'morning') {
          startT = '10:00';
          endT = '17:00';
        } else {
          startT = '17:00';
          endT = '01:00';
        }
      }

      DAYS.forEach(day => {
        if (!newShifts[category][day]) newShifts[category][day] = [];
        newShifts[category][day].push({ employee: '', role: defaultRole, start: startT, end: endT });
      });

      // Save to localStorage & Cloud & Local Dev API
      localStorage.setItem('shiftApp_shifts', JSON.stringify(newShifts));
      saveScheduleToCloud(newShifts);

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

      localStorage.setItem('shiftApp_shifts', JSON.stringify(newShifts));
      saveScheduleToCloud(newShifts);

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
    if (!processed || !processed[section]) return;

    if(window.confirm('האם אתה בטוח שברצונך למחוק את כל השורה הזו לרוחב כל השבוע?')) {
      setShifts(prev => {
        const newShifts = JSON.parse(JSON.stringify(prev));
        
        DAYS.forEach(day => {
          const slotToDelete = processed[section][day]?.[rowIndex];
          if (slotToDelete && slotToDelete.originalIndex !== undefined) {
             newShifts[category][day][slotToDelete.originalIndex] = null;
          }
        });

        // Filter out the nulls
        DAYS.forEach(day => {
           newShifts[category][day] = newShifts[category][day].filter(s => s !== null);
        });

        localStorage.setItem('shiftApp_shifts', JSON.stringify(newShifts));
        saveScheduleToCloud(newShifts);

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

    const updatedList = [...staffList, { id: Date.now(), name: newStaffName.trim() }];
    setStaffList(updatedList);
    setNewStaffName('');
    localStorage.setItem('shiftApp_staffList', JSON.stringify(updatedList));
    saveStaffToCloud(updatedList);
  };

  const removeStaffMember = (id) => {
    if(window.confirm('האם אתה בטוח שברצונך למחוק עובד זה מהרשימה הכללית?')) {
      const updatedList = staffList.filter(s => s.id !== id);
      setStaffList(updatedList);
      localStorage.setItem('shiftApp_staffList', JSON.stringify(updatedList));
      saveStaffToCloud(updatedList);
    }
  };

  const archiveAndResetWeek = async () => {
    const today = new Date();
    const defaultName = `שבוע ${formatDateShort(weekDates[0])}-${formatDateShort(weekDates[6])} (${today.toLocaleDateString('he-IL')})`;
    const weekName = prompt('הכנס שם לשבוע הנוכחי (לשמירה בארכיון):', defaultName);
    if (!weekName) return;

    const archiveData = {
      id: Date.now(),
      name: weekName,
      date: today.toISOString(),
      weekStart: weekDates[0].toISOString(),
      weekEnd: weekDates[6].toISOString(),
      shifts: shifts
    };

    try {
      const updatedArchives = [...archives, archiveData];
      setArchives(updatedArchives);
      localStorage.setItem('shiftApp_archives', JSON.stringify(updatedArchives));
      saveArchiveToCloud(archiveData);

      await fetch('/api/archive-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(archiveData)
      }).catch(() => {});

      const newShifts = JSON.parse(JSON.stringify(shifts));
      CATEGORIES.forEach(cat => {
        DAYS.forEach(day => {
          if (newShifts[cat] && newShifts[cat][day]) {
            newShifts[cat][day] = [];
          }
        });
      });

      setShifts(newShifts);
      localStorage.setItem('shiftApp_shifts', JSON.stringify(newShifts));
      saveScheduleToCloud(newShifts);

      await fetch('/api/save-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShifts)
      }).catch(() => {});
      
      alert('השבוע נשמר בארכיון בענן בהצלחה והלוח אופס לקראת השבוע החדש!');
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
    localStorage.setItem('shiftApp_archives', JSON.stringify(archives));
    saveScheduleToCloud(shifts);
    saveStaffToCloud(staffList);
    alert('כל הנתונים נשמרו בהצלחה (במכשיר זה ובענן אם מחובר)!');
  };

  const updateShift = (category, day, index, field, value) => {
    setShifts(prev => {
      const newShifts = { ...prev };
      const newDayList = [...newShifts[category][day]];
      newDayList[index] = { ...newDayList[index], [field]: value };
      newShifts[category] = { ...newShifts[category], [day]: newDayList };
      
      // Auto-save locally and to Firebase
      localStorage.setItem('shiftApp_shifts', JSON.stringify(newShifts));
      saveScheduleToCloud(newShifts);

      fetch('/api/save-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShifts)
      }).catch(() => {});
      
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
      
      // Auto-save locally and to Firebase
      localStorage.setItem('shiftApp_shifts', JSON.stringify(newShifts));
      saveScheduleToCloud(newShifts);

      fetch('/api/save-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShifts)
      }).catch(() => {});
      
      return newShifts;
    });
  };

  const handleSaveFirebaseConfig = (e) => {
    e.preventDefault();
    let configToSave = { ...firebaseConfigForm };

    // If raw JSON was provided in textarea, try to parse it
    if (rawConfigInput.trim()) {
      try {
        let cleanText = rawConfigInput.trim();
        if (cleanText.includes('{')) {
          cleanText = cleanText.substring(cleanText.indexOf('{'), cleanText.lastIndexOf('}') + 1);
        }
        const parsed = Function(`"use strict";return (${cleanText})`)();
        if (parsed && typeof parsed === 'object') {
          configToSave = { ...configToSave, ...parsed };
          setFirebaseConfigForm(configToSave);
        }
      } catch (err) {
        console.error('Error parsing raw config:', err);
      }
    }

    saveFirebaseConfig(configToSave);
    const connected = isFirebaseConfigured();
    setIsCloudConnected(connected);
    setConfigSaveSuccess(true);
    setTimeout(() => setConfigSaveSuccess(false), 3000);

    if (connected) {
      saveScheduleToCloud(shifts);
      saveStaffToCloud(staffList);
      alert('חיבור Firebase הוגדר בהצלחה! הנתונים מסונכרנים כעת בענן בזמן אמת.');
      setIsFirebaseModalOpen(false);
    } else {
      alert('נראה שחסרים מפתחות (API Key או Project ID). אנא בדוק את הפרטים.');
    }
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

    if (currentView === 'בייגל') {
      const processed = { morning: {}, mid: {}, evening: {} };
      let maxMorning = 0;
      let maxMid = 0;
      let maxEvening = 0;

      DAYS.forEach(day => {
        const slots = shifts[currentView][day] || [];
        const withIndex = slots.map((s, i) => ({ ...s, originalIndex: i }));
        
        let morningPool = [];
        let midPool = [];
        let eveningPool = [];
        
        withIndex.forEach(slot => {
          if (slot.start) {
            const hour = parseInt(slot.start.split(':')[0], 10);
            if (hour < 9 || (hour === 9 && parseInt(slot.start.split(':')[1] || '0', 10) < 30) || slot.start === '07:00') {
              morningPool.push(slot);
            } else if (hour >= 9 && hour < 14) {
              midPool.push(slot);
            } else {
              eveningPool.push(slot);
            }
          } else {
            if (slot.originalIndex < 3) morningPool.push(slot);
            else if (slot.originalIndex < 6) midPool.push(slot);
            else eveningPool.push(slot);
          }
        });
        
        const processSlotFlags = (slot) => {
          if (!slot.employee) return { ...slot, isDouble: false, hasOverlapConflict: false };
          const empName = slot.employee.trim();
          
          const empDayShifts = [];
          CATEGORIES.forEach(cat => {
            (shifts[cat]?.[day] || []).forEach((s, idx) => {
              if (s.employee && s.employee.trim() === empName) {
                empDayShifts.push({ category: cat, originalIndex: idx, start: s.start, end: s.end });
              }
            });
          });

          const isDouble = empDayShifts.length > 1;
          const hasOverlapConflict = isDouble && empDayShifts.some(other => {
            const isSameShift = (other.category === currentView && other.originalIndex === slot.originalIndex);
            return !isSameShift && isTimeOverlapping(slot.start, slot.end, other.start, other.end);
          });

          return { ...slot, isDouble, hasOverlapConflict };
        };
        
        const sortFn = (a, b) => {
          const aIsManager = a.role && a.role.includes('מנהל');
          const bIsManager = b.role && b.role.includes('מנהל');
          if (aIsManager && !bIsManager) return -1;
          if (!aIsManager && bIsManager) return 1;
          return a.originalIndex - b.originalIndex;
        };
        
        processed.morning[day] = morningPool.map(processSlotFlags).sort(sortFn);
        processed.mid[day] = midPool.map(processSlotFlags).sort(sortFn);
        processed.evening[day] = eveningPool.map(processSlotFlags).sort(sortFn);
        
        if (processed.morning[day].length > maxMorning) maxMorning = processed.morning[day].length;
        if (processed.mid[day].length > maxMid) maxMid = processed.mid[day].length;
        if (processed.evening[day].length > maxEvening) maxEvening = processed.evening[day].length;
      });

      processed.maxMorning = maxMorning || 1;
      processed.maxMid = maxMid || 1;
      processed.maxEvening = maxEvening || 1;
      return processed;
    }

    // Standard 2-section processing for other departments
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
      
      const processSlotFlags = (slot) => {
        if (!slot.employee) return { ...slot, isDouble: false, hasOverlapConflict: false };
        const empName = slot.employee.trim();
        
        const empDayShifts = [];
        CATEGORIES.forEach(cat => {
          (shifts[cat]?.[day] || []).forEach((s, idx) => {
            if (s.employee && s.employee.trim() === empName) {
              empDayShifts.push({ category: cat, originalIndex: idx, start: s.start, end: s.end });
            }
          });
        });

        const isDouble = empDayShifts.length > 1;
        const hasOverlapConflict = isDouble && empDayShifts.some(other => {
          const isSameShift = (other.category === currentView && other.originalIndex === slot.originalIndex);
          return !isSameShift && isTimeOverlapping(slot.start, slot.end, other.start, other.end);
        });

        return { ...slot, isDouble, hasOverlapConflict };
      };
      
      const sortFn = (a, b) => {
        const aIsManager = a.role && a.role.includes('מנהל');
        const bIsManager = b.role && b.role.includes('מנהל');
        if (aIsManager && !bIsManager) return -1;
        if (!aIsManager && bIsManager) return 1;
        return a.originalIndex - b.originalIndex;
      };
      
      processed.morning[day] = morningPool.map(processSlotFlags).sort(sortFn);
      processed.evening[day] = eveningPool.map(processSlotFlags).sort(sortFn);
      
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

  // Compute total hours, shift count & double shifts count for selected employee
  let totalEmployeeHours = 0;
  let totalEmployeeShiftsCount = 0;
  let totalDoubleShiftsCount = 0;
  if (selectedEmployeeForPersonal) {
    DAYS.forEach(day => {
      let dayCount = 0;
      CATEGORIES.forEach(cat => {
        (activeShiftsForPersonal[cat]?.[day] || []).forEach(shift => {
          if (shift.employee && shift.employee.trim() === selectedEmployeeForPersonal) {
            totalEmployeeShiftsCount++;
            dayCount++;
            totalEmployeeHours += getShiftDurationHours(shift.start, shift.end);
          }
        });
      });
      if (dayCount > 1) {
        totalDoubleShiftsCount++;
      }
    });
  }

  // Reusable Matrix Cell Renderer with Event Role toggle & Available Waiters helper
  const renderShiftCell = (slot, day, section) => {
    if (!slot) return <td key={day} className="matrix-cell empty-cell"></td>;
    
    const isActive = slot.employee || slot.role;
    const origIndex = slot.originalIndex;
    const isConflict = slot.hasOverlapConflict;
    const isEventRole = slot.role && slot.role.includes('אירוע');

    const availableList = section === 'morning' 
      ? (availableWaitersByDay[day]?.morning || [])
      : (availableWaitersByDay[day]?.evening || []);

    const empColor = slot.employee ? getEmployeeColor(slot.employee) : null;
    const hasEmpColor = Boolean(empColor && showEmployeeColors);
    const empStat = slot.employee ? waiterShiftStats.getStats(slot.employee) : null;

    // EXPORT MODE: Render clean static HTML cards (NO inputs!) to prevent Hebrew text reversal in html2canvas & strictly hide ratios
    if (isExporting) {
      if (!slot.employee && !slot.role) {
        return (
          <td key={day} className="matrix-cell empty-export-cell">
            <div className="export-empty-placeholder">-</div>
          </td>
        );
      }

      return (
        <td 
          key={day} 
          className={`matrix-cell export-active-cell ${isEventRole ? 'event-cell' : ''} ${hasEmpColor ? 'has-emp-color' : ''}`}
          style={hasEmpColor ? { '--emp-accent': empColor.border } : {}}
        >
          <div className="export-cell-card" dir="rtl">
            {slot.employee && (
              <div 
                className="export-emp-badge"
                dir="rtl"
                style={hasEmpColor ? {
                  backgroundColor: empColor.bg,
                  borderColor: empColor.border,
                  color: empColor.text,
                  border: `2px solid ${empColor.border}`
                } : {}}
              >
                {hasEmpColor && <span className="export-emp-symbol">{empColor.symbol}</span>}
                <span className="export-emp-name-text" dir="rtl">{slot.employee}</span>
              </div>
            )}
            {slot.role && (
              <div className={`export-role-badge ${isEventRole ? 'export-event-role' : ''}`} dir="rtl">
                {isEventRole ? `🎉 ${slot.role}` : slot.role}
              </div>
            )}
            {(slot.start || slot.end) && (
              <div className="export-time-text">
                {slot.end || '17:00'} - {slot.start || '10:00'}
              </div>
            )}
          </div>
        </td>
      );
    }

    return (
      <td 
        key={day} 
        className={`matrix-cell ${isActive ? 'active-cell' : ''} ${isConflict ? 'conflict-cell' : ''} ${isEventRole ? 'event-cell' : ''} ${hasEmpColor ? 'has-emp-color' : ''}`}
        style={hasEmpColor ? { '--emp-accent': empColor.border } : {}}
      >
        <div className="cell-content">
          <div className="cell-row header-row" style={{ position: 'relative' }}>
            <div className="emp-input-wrapper" style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
              <input 
                type="text" 
                className={`compact-input emp-input ${hasEmpColor ? 'colored-emp-input' : ''}`}
                placeholder="שם עובד..."
                value={slot.employee || ''}
                onChange={(e) => updateShift(currentView, day, origIndex, 'employee', e.target.value)}
                list="staff-list-options"
                style={hasEmpColor ? {
                  backgroundColor: empColor.bg,
                  borderColor: empColor.border,
                  color: empColor.text,
                  borderWidth: '2px',
                  fontWeight: '800'
                } : {}}
              />
              {hasEmpColor && (
                <span 
                  className="emp-signature-symbol"
                  style={{
                    color: empColor.border
                  }}
                  title={`צבע וסמל זיהוי: ${empColor.symbol} (${slot.employee})`}
                >
                  {empColor.symbol}
                </span>
              )}
            </div>
            {empStat && empStat.requested !== null && !isExporting && (
              <span 
                className={`emp-ratio-badge ${empStat.assigned >= empStat.requested ? 'ratio-ok' : 'ratio-warn'}`}
                title={`הגיש ${empStat.requested} משמרות, שובץ ב-${empStat.assigned}`}
              >
                {empStat.label}
              </span>
            )}
            {isConflict && <span className="overlap-conflict-badge">חפיפה!</span>}
            {slot.isDouble && !isConflict && <span className="double-shift-badge">כפולה</span>}
            {isEventRole && <span className="event-tag-badge">🎉 {slot.role}</span>}
            <button 
              className="clear-cell-btn" 
              onClick={() => clearSlot(currentView, day, origIndex)}
              title="מחק משמרת זו לחלוטין"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="cell-row role-cell-row">
            <input 
              type="text" 
              className={`compact-input role-input ${isEventRole ? 'event-role-input' : ''}`}
              placeholder="תפקיד..."
              value={slot.role || ''}
              onChange={(e) => updateShift(currentView, day, origIndex, 'role', e.target.value)}
              list="roles-list"
            />
            <button 
              type="button"
              className={`quick-event-btn ${isEventRole ? 'active' : ''}`}
              onClick={() => {
                const nextRole = isEventRole ? '' : 'אירוע';
                updateShift(currentView, day, origIndex, 'role', nextRole);
              }}
              title={isEventRole ? "בטל שיוך אירוע" : "שייך לתפקיד אירוע 🎉"}
            >
              🎉
            </button>
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

          {!slot.employee && availableList.length > 0 && (
            <div className="slot-avail-hint">
              <span className="avail-hint-label">זמינים:</span>
              {availableList.slice(0, 2).map((w, wi) => {
                const stat = w.stat || waiterShiftStats.getStats(w.name);
                return (
                  <button 
                    key={wi}
                    type="button" 
                    className="btn-quick-fill-chip"
                    onClick={() => updateShift(currentView, day, origIndex, 'employee', w.name)}
                    title={`שבץ את ${w.name} (שובץ ${stat.fullLabel})${w.note ? ` (${w.note})` : ''}`}
                  >
                    + {w.name} <span className="chip-stat-num">({stat.label})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </td>
    );
  };

  // Standalone Waiter Submission Mode (e.g. from WhatsApp link ?view=submit or #submit)
  // Strictly isolated: waiters cannot see or navigate to any schedules, archives, or manager views
  if (isStandaloneSubmit) {
    return (
      <div className={`standalone-submit-screen ${isDarkMode ? 'dark-mode' : ''}`} dir="rtl">
        <WaiterSubmissionView 
          staffList={allKnownEmployees}
          weekDates={weekDates}
          onSaveSubmission={handleSaveSubmission}
          existingSubmissions={submissions}
          isStandalone={true}
        />
      </div>
    );
  }

  // Security Check: Manager Authentication Guard
  // If unauthorized user visits main dashboard (e.g. waiter deletes ?view=submit from URL)
  if (!isManagerAuthenticated) {
    return (
      <div className={`manager-lock-wrapper ${isDarkMode ? 'dark-mode' : ''}`} dir="rtl">
        <ManagerLockScreen 
          correctPin={managerPin}
          onUnlock={handleManagerUnlock}
          onNavigateToSubmit={() => {
            window.history.pushState({}, '', '?view=submit');
            setIsStandaloneSubmit(true);
          }}
          isDarkMode={isDarkMode}
        />
      </div>
    );
  }

  return (
    <div className="app-layout" dir="rtl">
      
      {/* Mobile/iPad Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <Calendar size={28} />
          <h2>מערכת שיבוץ</h2>
          {isMobileMenuOpen && (
            <button 
              type="button" 
              onClick={() => setIsMobileMenuOpen(false)} 
              style={{ marginRight: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={20} />
            </button>
          )}
        </div>
        
        <nav className="sidebar-nav">
          {/* Shift Submissions Pool (Waiters Availability Database) */}
          <button 
            className={`nav-item ${currentView === 'submissions' ? 'active' : ''}`}
            onClick={() => { setCurrentView('submissions'); setIsMobileMenuOpen(false); }}
            style={{ 
              background: currentView === 'submissions' ? 'var(--primary-color)' : 'rgba(212, 175, 55, 0.08)',
              color: currentView === 'submissions' ? '#ffffff' : 'var(--text-dark)',
              border: '1.5px solid var(--primary-color)'
            }}
          >
            <ClipboardList size={20} />
            <span>מאגר הגשות שבועי</span>
            <div className="badge" style={{ background: '#10b981', color: '#fff' }}>{submissions.length}</div>
          </button>

          {/* Waiter Mobile Self-Submission Portal */}
          <button 
            className={`nav-item ${currentView === 'submit-portal' ? 'active' : ''}`}
            onClick={() => { setCurrentView('submit-portal'); setIsMobileMenuOpen(false); }}
            style={{ 
              background: currentView === 'submit-portal' ? '#10b981' : 'rgba(16, 185, 129, 0.08)',
              color: currentView === 'submit-portal' ? '#ffffff' : 'var(--text-dark)',
              border: '1.5px solid #10b981'
            }}
          >
            <Send size={20} />
            <span>הגשת משמרות</span>
            <div className="badge" style={{ background: '#2563eb', color: '#fff' }}>נייד 📱</div>
          </button>

          <button 
            className={`nav-item ${currentView === 'employees' ? 'active' : ''}`}
            onClick={() => { setCurrentView('employees'); setIsMobileMenuOpen(false); }}
          >
            <Users size={20} />
            <span>רשימת עובדים</span>
            <div className="badge">{staffList.length}</div>
          </button>

          <button 
            className={`nav-item ${currentView === 'personal' ? 'active' : ''}`}
            onClick={() => { setCurrentView('personal'); setIsMobileMenuOpen(false); }}
          >
            <User size={20} />
            <span>לו"ז עובד אישי</span>
          </button>
          
          <button 
            className={`nav-item ${currentView === 'archives' ? 'active' : ''}`}
            onClick={() => { setCurrentView('archives'); setSelectedArchiveWeek(null); setIsMobileMenuOpen(false); }}
          >
            <History size={20} />
            <span>ארכיון שבועות</span>
          </button>

          <div className="nav-divider">מחלקות</div>
          
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`nav-item ${currentView === cat ? 'active' : ''}`}
              onClick={() => { setCurrentView(cat); setIsMobileMenuOpen(false); }}
            >
              {getCategoryIcon(cat)}
              <span>{cat}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer" style={{ marginTop: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* Cloud Database Sync Status & Settings Button */}
          <button 
            className="nav-item cloud-sync-btn"
            onClick={() => setIsFirebaseModalOpen(true)}
            style={{ 
              justifyContent: 'center', 
              border: isCloudConnected ? '1px solid #10b981' : '1px solid var(--primary-color)',
              background: isCloudConnected ? (isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5') : 'var(--primary-light)',
              color: isCloudConnected ? (isDarkMode ? '#6ee7b7' : '#065f46') : 'var(--primary-light-text)',
              fontSize: '0.85rem',
              fontWeight: '700'
            }}
          >
            <Cloud size={16} />
            <span>{isCloudConnected ? '🟢 מסד נתונים ענן פעיל' : '☁️ הגדרות Firebase'}</span>
          </button>

          <button 
            className="nav-item theme-toggle" 
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{ justifyContent: 'center', border: '1px solid var(--card-border)' }}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            <span>{isDarkMode ? 'מצב יום ☀️' : 'מצב לילה 🌙'}</span>
          </button>

          {/* Manager Lock & PIN Controls */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button 
              type="button"
              className="nav-item btn-lock-manager"
              onClick={handleManagerLock}
              title="נעל את לוח הניהול (דרוש קוד לכניסה מחדש)"
              style={{ flex: 1, justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', fontSize: '0.8rem', fontWeight: 'bold', padding: '8px', borderRadius: '10px', cursor: 'pointer' }}
            >
              <Lock size={15} />
              <span>נעילה</span>
            </button>
            <button 
              type="button"
              className="nav-item btn-change-pin"
              onClick={() => setShowChangePinModal(true)}
              title="שנה קוד גישה למנהל"
              style={{ flex: 1, justifyContent: 'center', border: '1px solid var(--card-border)', fontSize: '0.8rem', fontWeight: 'bold', padding: '8px', borderRadius: '10px', cursor: 'pointer' }}
            >
              <KeyRound size={15} />
              <span>קוד גישה</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        
        {/* Top Header Bar for Mobile & Tablet (iPad) */}
        <div className="mobile-app-header">
          <button 
            type="button" 
            className="btn-mobile-menu"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            title="פתח תפריט ניווט"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div className="mobile-brand-title">
            <Utensils size={20} style={{ color: 'var(--primary-color)' }} />
            <span>
              {currentView === 'submissions' 
                ? 'מאגר הגשות שבועי' 
                : currentView === 'submit-portal' 
                ? 'הגשת משמרות' 
                : currentView === 'employees' 
                ? 'רשימת עובדים' 
                : currentView === 'personal' 
                ? 'לו"ז אישי' 
                : currentView === 'archives' 
                ? 'ארכיון שבועות' 
                : `סידור: ${currentView}`}
            </span>
          </div>

          <div className="mobile-header-quick-links">
            <button 
              type="button"
              className="mobile-quick-btn"
              onClick={handleManagerLock}
              title="נעילת לוח מנהל 🔒"
              style={{ color: '#ef4444' }}
            >
              <Lock size={16} />
            </button>
            <button 
              type="button"
              className={`mobile-quick-btn ${currentView === 'submissions' ? 'active' : ''}`}
              onClick={() => setCurrentView('submissions')}
              title="מאגר הגשות משמרות"
            >
              <ClipboardList size={16} />
              <span>({submissions.length})</span>
            </button>
            <button 
              type="button"
              className="mobile-quick-btn"
              onClick={() => setIsDarkMode(!isDarkMode)}
              title="החלף מצב יום/לילה"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
        
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
                  <Save size={18} /> שמור נתונים בענן
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <User size={16}/> {emp.name}
                              {emp.isUnregistered && <span className="temp-badge" title="עובד זה שובץ אך לא מופיע ברשימת העובדים הכללית">זמני</span>}
                            </div>
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
            <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
              <div>
                <h1>סידור עבודה: {currentView}</h1>
                <p>ניהול משמרות יומי ושבועי לפי לוח שנה ישראל</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Week Navigator */}
                <div className="week-nav-widget">
                  <button 
                    onClick={() => setWeekOffset(prev => prev - 1)} 
                    className="week-arrow-btn" 
                    title="שבוע קודם"
                  >
                    <ChevronRight size={18} /> שבוע קודם
                  </button>
                  
                  <div className="week-range-badge">
                    <Calendar size={16} />
                    <span>{formatDateFull(weekDates[0])} — {formatDateFull(weekDates[6])}</span>
                    {weekOffset === 0 ? (
                      <span className="current-week-indicator">שבוע נוכחי</span>
                    ) : (
                      <button onClick={() => setWeekOffset(0)} className="btn-today-jump">
                        חזור להיום
                      </button>
                    )}
                  </div>

                  <button 
                    onClick={() => setWeekOffset(prev => prev + 1)} 
                    className="week-arrow-btn" 
                    title="שבוע הבא"
                  >
                    שבוע הבא <ChevronLeft size={18} />
                  </button>
                </div>

                <button 
                  onClick={handleExportSchedule}
                  className="btn-primary" 
                  disabled={isExporting}
                  style={{ opacity: isExporting ? 0.7 : 1 }}
                >
                  <Download size={18} /> {isExporting ? 'מעבד תמונה...' : 'הורד סידור עבודה'}
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    const nextVal = !showEmployeeColors;
                    setShowEmployeeColors(nextVal);
                    localStorage.setItem('shiftApp_showEmployeeColors', JSON.stringify(nextVal));
                  }}
                  className={`btn-secondary ${showEmployeeColors ? 'active' : ''}`}
                  title="הצג / הסתר צבע ייחודי לכל מלצר בלוח ובתמונה"
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    fontWeight: 'bold',
                    background: showEmployeeColors ? 'rgba(212, 175, 55, 0.15)' : 'var(--input-bg)',
                    borderColor: showEmployeeColors ? 'var(--primary-color)' : 'var(--card-border)',
                    color: showEmployeeColors ? 'var(--primary-color)' : 'var(--text-dark)'
                  }}
                >
                  <Sparkles size={16} />
                  <span>{showEmployeeColors ? 'צבעי מלצרים: פעיל 🎨' : 'צבעי מלצרים: כבוי'}</span>
                </button>

                <button 
                  type="button"
                  onClick={() => setCurrentView('submissions')}
                  className="btn-secondary"
                  title="מעבר למאגר הגשות המשמרות"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
                >
                  <ClipboardList size={16} />
                  <span>מאגר הגשות ({submissions.length})</span>
                </button>

                <button 
                  type="button"
                  onClick={() => setCurrentView('submit-portal')}
                  className="btn-secondary"
                  title="הגשת משמרות למלצרים בנייד"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
                >
                  <Send size={16} />
                  <span>הגשת משמרות 📱</span>
                </button>
              </div>
            </div>

            <div className="board">
              <div id="schedule-export-target" className={`table-wrapper ${isExporting ? 'is-exporting' : ''}`}>
                
                {/* Header Banner for Exported Image Only (Hidden on Interactive Screen to prevent 2-pages look on iPad) */}
                <div className={`export-schedule-banner ${isExporting ? 'force-show' : ''}`} style={{ display: isExporting ? 'flex' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: 'var(--primary-color)' }}>{getCategoryIcon(currentView)}</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-dark)' }}>
                      סידור עבודה: {currentView}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontWeight: '700', fontSize: '0.95rem' }}>
                    <Calendar size={16} style={{ color: 'var(--primary-color)' }} />
                    <span>שבוע {formatDateFull(weekDates[0])} — {formatDateFull(weekDates[6])}</span>
                  </div>
                </div>

                {/* Waiter Color Legend - captured in exported image and visible on screen */}
                {showEmployeeColors && activeEmployeesInCurrentSchedule.length > 0 && (
                  <div className="schedule-color-legend-bar" dir="rtl">
                    <div className="legend-label">
                      <Sparkles size={14} className="legend-icon" />
                      <span>מקרא צבעי מלצרים:</span>
                    </div>
                    <div className="legend-chips-wrap">
                      {activeEmployeesInCurrentSchedule.map(emp => {
                        const col = getEmployeeColor(emp);
                        if (!col) return null;
                        const stat = waiterShiftStats.getStats(emp);
                        return (
                          <span 
                            key={emp} 
                            className="emp-legend-badge"
                            style={{ 
                              backgroundColor: col.bg, 
                              borderColor: col.border, 
                              color: col.text 
                            }}
                            title={`שובץ ${stat.fullLabel}`}
                          >
                            <span className="legend-symbol" style={{ color: col.border }}>{col.symbol}</span>
                            <span className="legend-emp-name">{emp}</span>
                            {!isExporting && stat && (
                              <span className="legend-ratio-pill">{stat.label}</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                <table className="schedule-matrix">
                  <thead>
                    <tr>
                      <th className="slot-num-col">#</th>
                      {DAYS.map((day, dayIndex) => {
                        const dayDate = weekDates[dayIndex];
                        const today = isToday(dayDate);
                        const availWaiters = availableWaitersByDay[day]?.all || [];
                        return (
                          <th key={day} className={today ? 'today-col-header' : ''}>
                            <div className="day-header-content">
                              <span className="day-name-txt">{day}</span>
                              <span className={`day-date-txt ${today ? 'today-date-badge' : ''}`}>
                                {formatDateShort(dayDate)}
                                {today && <span className="today-star">⭐</span>}
                              </span>
                              {!isExporting && availWaiters.length > 0 && (
                                <span 
                                  className="day-available-count-badge" 
                                  title={availWaiters.map(w => `${w.name} (${w.shifts})${w.note ? `: ${w.note}` : ''}`).join('\n')}
                                >
                                  👥 {availWaiters.length} פנויים
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Morning Section */}
                    <tr className="shift-section-header">
                      <td colSpan={DAYS.length + 1} style={{ textAlign: 'center', background: 'var(--primary-light)', color: 'var(--primary-light-text)', padding: '12px', fontWeight: 'bold', fontSize: '1.15rem', position: 'relative' }}>
                        ☀️ {currentView === 'בייגל' ? 'משמרת בוקר (07:00 - 15:00)' : 'משמרת בוקר (10:00 - 17:00)'}
                        {!isExporting && (
                          <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '10px' }}>
                            <button 
                              onClick={() => addRow(currentView, 'morning')}
                              title={currentView === 'בייגל' ? "הוסף שורת בוקר (07:00 - 15:00)" : "הוסף שורת בוקר"}
                              style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}
                            >
                              <Plus size={16} /> הוסף בוקר
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {getProcessedShifts() && Array.from({ length: getProcessedShifts().maxMorning }).map((_, rowIndex) => {
                      const processed = getProcessedShifts();

                      return (
                        <tr key={`morning-${rowIndex}`}>
                          <td className="slot-num-cell">
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <span>{rowIndex + 1}</span>
                              {!isExporting && (
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
                              )}
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
                            const slot = processed.morning[day]?.[rowIndex];
                            return renderShiftCell(slot, day, 'morning');
                          })}
                        </tr>
                      );
                    })}

                    {/* Mid Section for Bagel (10:00 - 19:00) */}
                    {currentView === 'בייגל' && (
                      <>
                        <tr className="shift-section-header">
                          <td colSpan={DAYS.length + 1} style={{ textAlign: 'center', background: isDarkMode ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7', color: isDarkMode ? '#fcd34d' : '#92400e', padding: '12px', fontWeight: 'bold', fontSize: '1.15rem', position: 'relative', borderTop: '2px solid var(--card-border)' }}>
                            🌤️ משמרת ביניים (10:00 - 19:00)
                            {!isExporting && (
                              <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '10px' }}>
                                <button 
                                  onClick={() => addRow(currentView, 'mid')}
                                  title="הוסף שורת ביניים (10:00 - 19:00)"
                                  style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}
                                >
                                  <Plus size={16} /> הוסף ביניים
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {getProcessedShifts() && Array.from({ length: getProcessedShifts().maxMid || 1 }).map((_, rowIndex) => {
                          const processed = getProcessedShifts();

                          return (
                            <tr key={`mid-${rowIndex}`}>
                              <td className="slot-num-cell">
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                  <span>{rowIndex + 1}</span>
                                  {!isExporting && (
                                    <div style={{ display: 'flex', gap: '2px' }}>
                                      <button 
                                        onClick={() => addRow(currentView, 'mid')}
                                        title="הוסף שורת ביניים"
                                        style={{ background: 'transparent', border: 'none', color: '#f59e0b', cursor: 'pointer', padding: '2px' }}
                                      >
                                        <Plus size={14} />
                                      </button>
                                      <button 
                                        onClick={() => deleteSpecificRow(currentView, 'mid', rowIndex)}
                                        title="מחק שורה זו"
                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                              {DAYS.map(day => {
                                if (day === 'מוצ"ש') {
                                  return (
                                    <td key={day} className="matrix-cell empty-cell" style={{ background: 'var(--cell-empty-bg)', verticalAlign: 'middle', textAlign: 'center', color: 'var(--text-muted)' }}>
                                      אין משמרת ביניים
                                    </td>
                                  );
                                }
                                const slot = processed.mid?.[day]?.[rowIndex];
                                return renderShiftCell(slot, day, 'mid');
                              })}
                            </tr>
                          );
                        })}
                      </>
                    )}

                    {/* Evening Section */}
                    <tr className="shift-section-header">
                      <td colSpan={DAYS.length + 1} style={{ textAlign: 'center', background: 'var(--table-header-bg)', color: 'var(--text-dark)', padding: '12px', fontWeight: 'bold', fontSize: '1.15rem', position: 'relative', borderTop: '2px solid var(--card-border)' }}>
                        🌙 {currentView === 'בייגל' ? 'משמרת ערב (15:00 - 23:00)' : 'משמרת ערב (17:00 - 01:00)'}
                        {!isExporting && (
                          <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '10px' }}>
                            <button 
                              onClick={() => addRow(currentView, 'evening')}
                              title={currentView === 'בייגל' ? "הוסף שורת ערב (15:00 - 23:00)" : "הוסף שורת ערב"}
                              style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}
                            >
                              <Plus size={16} /> הוסף ערב
                            </button>
                            <button 
                              onClick={() => addRow(currentView, 'event')}
                              title="הוסף שורת אירוע (18:00 - 01:00)"
                              className="btn-add-event-row"
                            >
                              <Sparkles size={16} /> הוסף אירוע 🎉
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {getProcessedShifts() && Array.from({ length: getProcessedShifts().maxEvening }).map((_, rowIndex) => {
                      const processed = getProcessedShifts();

                      return (
                        <tr key={`evening-${rowIndex}`}>
                          <td className="slot-num-cell">
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <span>{rowIndex + 1}</span>
                              {!isExporting && (
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
                              )}
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
                            const slot = processed.evening[day]?.[rowIndex];
                            return renderShiftCell(slot, day, 'evening');
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '16px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
                <button onClick={() => addRow(currentView, 'morning')} className="btn-primary" style={{ minWidth: '160px' }}>
                   <Plus size={18} /> הוסף שורת בוקר
                </button>
                {currentView === 'בייגל' && (
                  <button onClick={() => addRow(currentView, 'mid')} className="btn-primary" style={{ background: '#f59e0b', minWidth: '160px' }}>
                     <Plus size={18} /> הוסף שורת ביניים
                  </button>
                )}
                <button onClick={() => addRow(currentView, 'evening')} className="btn-primary" style={{ background: '#4f46e5', minWidth: '160px' }}>
                   <Plus size={18} /> הוסף שורת ערב
                </button>
                <button onClick={() => addRow(currentView, 'event')} className="btn-add-event-row" style={{ minWidth: '160px' }}>
                   <Sparkles size={18} /> הוסף שורת אירוע 🎉
                </button>
                <button onClick={() => removeRow(currentView)} className="btn-primary" style={{ background: '#ef4444', minWidth: '160px' }}>
                   <Trash2 size={18} /> מחק שורה אחרונה
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Shift Submissions Pool View (Manager Control Center) */}
        {currentView === 'submissions' && (
          <SubmissionsPoolView 
            submissions={submissions}
            staffList={staffList}
            weekDates={weekDates}
            onUpdateSubmissions={handleUpdateSubmissions}
            onAutoAssignToSchedule={handleAutoAssignToSchedule}
            onBackToSchedule={() => setCurrentView('מסעדה')}
            currentCategory={CATEGORIES.includes(currentView) ? currentView : 'מסעדה'}
            waiterShiftStats={waiterShiftStats}
          />
        )}

        {/* Waiter Self-Service Submission Portal (Mobile-First) */}
        {currentView === 'submit-portal' && (
          <WaiterSubmissionView 
            staffList={allKnownEmployees}
            weekDates={weekDates}
            onSaveSubmission={handleSaveSubmission}
            existingSubmissions={submissions}
            onBackToSchedule={() => setCurrentView('מסעדה')}
          />
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
                  <option value="current">📅 השבוע הנוכחי ({formatDateShort(weekDates[0])} - {formatDateShort(weekDates[6])})</option>
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
                <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                  <div style={{ background: 'var(--primary-light)', padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--card-border)', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>משמרות השבוע</span>
                      <strong style={{ fontSize: '1.2rem', color: 'var(--primary-color)' }}>{totalEmployeeShiftsCount}</strong>
                    </div>
                    {totalDoubleShiftsCount > 0 && (
                      <>
                        <div style={{ width: '1px', height: '24px', background: 'var(--card-border)' }}></div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>משמרות כפולות</span>
                          <strong style={{ fontSize: '1.2rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                            <Flame size={15} /> {totalDoubleShiftsCount}
                          </strong>
                        </div>
                      </>
                    )}
                    <div style={{ width: '1px', height: '24px', background: 'var(--card-border)' }}></div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>סה"כ שעות (למשכורת)</span>
                      <strong style={{ fontSize: '1.2rem', color: '#10b981' }}>{totalEmployeeHours.toFixed(1)} שעות</strong>
                    </div>
                  </div>

                  <button 
                    onClick={handleExportPersonal}
                    className="btn-primary" 
                    disabled={isExporting}
                    style={{ height: '44px', opacity: isExporting ? 0.7 : 1 }}
                  >
                    <Download size={18} /> {isExporting ? 'מעבד...' : 'הורד תמונה'}
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
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontWeight: '600' }}>
                    {selectedPersonalWeekId === 'current' ? `שבוע ${formatDateFull(weekDates[0])} — ${formatDateFull(weekDates[6])}` : archives.find(a => String(a.id) === String(selectedPersonalWeekId))?.name || 'ארכיון'}
                  </p>
                </div>

                {/* Payroll Summary Header */}
                <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '15px', background: 'var(--primary-light)', padding: '12px 20px', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--card-border)' }}>
                  <div>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>סה"כ משמרות: </span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--text-dark)' }}>{totalEmployeeShiftsCount}</strong>
                  </div>
                  {totalDoubleShiftsCount > 0 && (
                    <div style={{ background: isDarkMode ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7', padding: '4px 14px', borderRadius: '20px', border: '1px solid #f59e0b', color: isDarkMode ? '#fcd34d' : '#b45309', fontWeight: 'bold', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Flame size={16} color="#f59e0b" />
                      <span>{totalDoubleShiftsCount} משמרות כפולות השבוע</span>
                    </div>
                  )}
                  <div>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>סה"כ שעות עבודה מחושבות למשכורת: </span>
                    <strong style={{ fontSize: '1.18rem', color: '#10b981' }}>{totalEmployeeHours.toFixed(1)} שעות</strong>
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
                    {DAYS.map((day, dayIndex) => {
                      const dayDate = weekDates[dayIndex];
                      const today = isToday(dayDate);
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
                          <tr key={day} className={today ? 'today-row-highlight' : ''}>
                            <td className="emp-name" style={{ fontSize: '1.05rem', fontWeight: 'bold', padding: '14px 18px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>{day}</span>
                                <span className={`emp-date-badge ${today ? 'today-badge' : ''}`}>{formatDateShort(dayDate)}</span>
                                {today && <span className="today-tag-mini">היום</span>}
                              </div>
                            </td>
                            <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>-- יום חופש --</td>
                          </tr>
                        );
                      }
                      
                      const isDouble = dayShifts.length > 1;
                      const totalDayHours = dayShifts.reduce((sum, item) => sum + item.hours, 0);

                      return dayShifts.map((item, idx) => {
                        const isFirstRow = idx === 0;
                        const doubleRowBg = isDarkMode ? 'rgba(245, 158, 11, 0.12)' : 'rgba(254, 243, 199, 0.45)';
                        const doubleCellBg = isDarkMode ? 'rgba(245, 158, 11, 0.22)' : '#fef3c7';

                        return (
                          <tr 
                            key={`${day}-${idx}`}
                            style={isDouble ? { background: doubleRowBg } : (today ? { background: isDarkMode ? 'rgba(212, 175, 55, 0.08)' : '#fffdf5' } : {})}
                          >
                            {isFirstRow && (
                              <td 
                                rowSpan={dayShifts.length} 
                                className="emp-name" 
                                style={{ 
                                  fontSize: '1.05rem', 
                                  verticalAlign: 'middle', 
                                  padding: '14px 18px',
                                  borderRight: isDouble ? '5px solid #f59e0b' : (today ? '5px solid var(--primary-color)' : '1px solid var(--card-border)'),
                                  background: isDouble ? doubleCellBg : 'transparent'
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: '800', fontSize: '1.15rem', color: 'var(--text-dark)' }}>{day}</span>
                                    <span className={`emp-date-badge ${today ? 'today-badge' : ''}`}>{formatDateShort(dayDate)}</span>
                                  </div>
                                  {today && <span className="today-tag-mini">היום ⭐</span>}
                                  {isDouble && (
                                    <>
                                      <span className="double-shift-badge">
                                        <Flame size={13} /> משמרת כפולה
                                      </span>
                                      <span style={{ fontSize: '0.8rem', color: isDarkMode ? '#fcd34d' : '#b45309', fontWeight: '700' }}>
                                        ({totalDayHours.toFixed(1)} שעות ביום)
                                      </span>
                                    </>
                                  )}
                                </div>
                              </td>
                            )}
                            <td style={{ fontWeight: 'bold', padding: '14px 18px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: 'var(--primary-color)' }}>{getCategoryIcon(item.cat)}</span>
                                <span style={{ color: 'var(--text-dark)' }}>{item.cat}</span>
                              </div>
                            </td>
                            <td style={{ direction: 'ltr', textAlign: 'center', fontWeight: '600', padding: '14px 18px' }}>
                              <span style={{ background: 'var(--input-bg)', padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--card-border)', fontSize: '0.95rem' }}>
                                {item.shift.start} - {item.shift.end}
                              </span>
                            </td>
                            <td style={{ color: '#10b981', fontWeight: 'bold', textAlign: 'center', padding: '14px 18px', fontSize: '0.95rem' }}>
                              {item.hours.toFixed(1)} שעות
                            </td>
                            <td style={{ fontWeight: 'bold', padding: '14px 18px' }}>
                              {item.shift.role && item.shift.role.includes('אירוע') ? (
                                <span style={{ 
                                  background: 'rgba(124, 58, 237, 0.15)', 
                                  color: '#7c3aed', 
                                  padding: '4px 12px', 
                                  borderRadius: '8px', 
                                  border: '1px solid rgba(124, 58, 237, 0.3)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '0.95rem'
                                }}>
                                  🎉 {item.shift.role}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--primary-color)' }}>
                                  {item.shift.role || '---'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      });
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
          {allKnownEmployees.map(s => <option key={s.id || s.name} value={s.name} />)}
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
                <p>צופה בהיסטוריית סידורי עבודה קודמים שנשמרו בענן</p>
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

        {/* Image Preview & Share Modal (iPad / Mobile / Desktop) */}
        {previewModal.isOpen && (
          <div className="modal-backdrop" onClick={() => setPreviewModal({ ...previewModal, isOpen: false })}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '920px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} dir="rtl">
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Download size={22} style={{ color: 'var(--primary-color)' }} />
                  <h2>{previewModal.title}</h2>
                </div>
                <button className="modal-close-btn" onClick={() => setPreviewModal({ ...previewModal, isOpen: false })}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body" style={{ overflowY: 'auto', textAlign: 'center', padding: '20px' }}>
                <div style={{ background: 'var(--primary-light)', padding: '12px 18px', borderRadius: '10px', marginBottom: '16px', color: 'var(--primary-light-text)', fontWeight: 'bold', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span>📱 <strong>באייפד / טלפון:</strong> לחץ לחיצה ארוכה על התמונה ובחר <u>"שמור בתמונות"</u> או לחץ שתף!</span>
                </div>

                <div style={{ border: '1px solid var(--card-border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px', background: isDarkMode ? '#0f172a' : '#ffffff', boxShadow: 'var(--shadow-md)' }}>
                  <img 
                    src={previewModal.imageUrl} 
                    alt={previewModal.title} 
                    style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '55vh', objectFit: 'contain', margin: '0 auto' }} 
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  {navigator.share && (
                    <button 
                      className="btn-primary" 
                      onClick={async () => {
                        try {
                          const res = await fetch(previewModal.imageUrl);
                          const blob = await res.blob();
                          const file = new File([blob], `${previewModal.fileName}.png`, { type: 'image/png' });
                          await navigator.share({
                            files: [file],
                            title: previewModal.title
                          });
                        } catch (e) {}
                      }}
                      style={{ background: '#10b981', padding: '12px 24px', fontSize: '1rem' }}
                    >
                      <Share2 size={18} /> שתף / שמור בתמונות (iOS Share)
                    </button>
                  )}

                  <a 
                    href={previewModal.imageUrl} 
                    download={`${previewModal.fileName}.png`}
                    className="btn-primary"
                    style={{ padding: '12px 24px', textDecoration: 'none', fontSize: '1rem' }}
                  >
                    <Download size={18} /> הורד תמונה לקובץ
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Firebase Cloud Settings Modal */}
        {isFirebaseModalOpen && (
          <div className="modal-backdrop" onClick={() => setIsFirebaseModalOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} dir="rtl">
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Cloud size={24} style={{ color: 'var(--primary-color)' }} />
                  <h2>הגדרות חיבור למסד נתונים Firebase Firestore</h2>
                </div>
                <button className="modal-close-btn" onClick={() => setIsFirebaseModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                <div className="firebase-status-banner" style={{ background: isCloudConnected ? 'rgba(16, 185, 129, 0.15)' : 'var(--primary-light)', padding: '14px', borderRadius: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Database size={24} style={{ color: isCloudConnected ? '#10b981' : 'var(--primary-color)' }} />
                  <div>
                    <strong style={{ color: isCloudConnected ? (isDarkMode ? '#6ee7b7' : '#065f46') : 'var(--primary-light-text)', fontSize: '1.05rem', display: 'block' }}>
                      {isCloudConnected ? '🟢 מסד הנתונים בענן מחובר ופעיל בזמן אמת!' : '🟡 טרם הוזנו מפתחות Firebase'}
                    </strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {isCloudConnected ? 'כל שינוי בשיבוץ או בעובדים מסתנכרן אוטומטית בין כל המכשירים.' : 'הזן את הגדרות פרויקט Firebase שלך מ-Firebase Console.'}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSaveFirebaseConfig} className="firebase-config-form">
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.95rem' }}>
                      💡 הדבקה מהירה של אובייקט הגדרות (Firebase SDK Config):
                    </label>
                    <textarea 
                      placeholder="הדבק כאן את הקוד מ-Firebase Console (למשל: const firebaseConfig = { apiKey: '...', projectId: '...' };)"
                      value={rawConfigInput}
                      onChange={e => setRawConfigInput(e.target.value)}
                      rows={3}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--input-text)', fontFamily: 'monospace', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>API Key:</label>
                      <input 
                        type="text" 
                        className="compact-input"
                        placeholder="AIzaSy..."
                        value={firebaseConfigForm.apiKey || ''}
                        onChange={e => setFirebaseConfigForm({ ...firebaseConfigForm, apiKey: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>Project ID:</label>
                      <input 
                        type="text" 
                        className="compact-input"
                        placeholder="my-project-id"
                        value={firebaseConfigForm.projectId || ''}
                        onChange={e => setFirebaseConfigForm({ ...firebaseConfigForm, projectId: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>Auth Domain:</label>
                      <input 
                        type="text" 
                        className="compact-input"
                        placeholder="my-project.firebaseapp.com"
                        value={firebaseConfigForm.authDomain || ''}
                        onChange={e => setFirebaseConfigForm({ ...firebaseConfigForm, authDomain: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>App ID:</label>
                      <input 
                        type="text" 
                        className="compact-input"
                        placeholder="1:123456789:web:abcdef..."
                        value={firebaseConfigForm.appId || ''}
                        onChange={e => setFirebaseConfigForm({ ...firebaseConfigForm, appId: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <a 
                      href="https://console.firebase.google.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: 'var(--primary-color)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', fontWeight: 'bold' }}
                    >
                      <span>פתח את מסוף Firebase</span>
                      <ExternalLink size={14} />
                    </a>

                    <button type="submit" className="btn-primary" style={{ padding: '10px 24px' }}>
                      <Save size={18} /> שמור והתחבר למסד הנתונים
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CHANGE MANAGER PIN */}
        {showChangePinModal && (
          <div className="modal-backdrop" onClick={() => setShowChangePinModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} dir="rtl" style={{ maxWidth: '440px' }}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <KeyRound size={22} style={{ color: 'var(--primary-color)' }} />
                  <h2>שינוי קוד גישה למנהל</h2>
                </div>
                <button className="modal-close-btn" onClick={() => setShowChangePinModal(false)}>✕</button>
              </div>
              <form onSubmit={handleSaveNewPin}>
                <div className="modal-body">
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
                    קוד זה מגן על לוח העבודה ומונע ממלצרים לגשת לנתוני השיבוץ והשכר.
                  </p>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>קוד נוכחי:</label>
                    <input 
                      type="password"
                      className="modern-input"
                      value={pinChangeForm.oldPin}
                      onChange={(e) => setPinChangeForm(prev => ({ ...prev, oldPin: e.target.value, error: '', success: '' }))}
                      placeholder="הזן קוד נוכחי..."
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>קוד חדש (לפחות 4 תווים):</label>
                    <input 
                      type="password"
                      className="modern-input"
                      value={pinChangeForm.newPin}
                      onChange={(e) => setPinChangeForm(prev => ({ ...prev, newPin: e.target.value, error: '', success: '' }))}
                      placeholder="הזן קוד חדש..."
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>אימות קוד חדש:</label>
                    <input 
                      type="password"
                      className="modern-input"
                      value={pinChangeForm.confirmPin}
                      onChange={(e) => setPinChangeForm(prev => ({ ...prev, confirmPin: e.target.value, error: '', success: '' }))}
                      placeholder="הזן שוב את הקוד החדש..."
                      required
                    />
                  </div>

                  {pinChangeForm.error && (
                    <div className="lock-error-banner" style={{ marginBottom: '10px' }}>
                      <AlertCircle size={16} />
                      <span>{pinChangeForm.error}</span>
                    </div>
                  )}

                  {pinChangeForm.success && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669', padding: '10px 14px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <CheckCircle size={18} />
                      <span>{pinChangeForm.success}</span>
                    </div>
                  )}
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowChangePinModal(false)}>ביטול</button>
                  <button type="submit" className="btn-primary">שמור קוד חדש</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Mobile Bottom Navigation Bar */}
        <div className="mobile-bottom-nav">
          <button 
            type="button"
            className={`bottom-nav-item ${CATEGORIES.includes(currentView) ? 'active' : ''}`}
            onClick={() => setCurrentView('מסעדה')}
          >
            <Utensils size={18} />
            <span>סידור עבודה</span>
          </button>
          <button 
            type="button"
            className={`bottom-nav-item ${currentView === 'submit-portal' ? 'active' : ''}`}
            onClick={() => setCurrentView('submit-portal')}
          >
            <Send size={18} />
            <span>הגשת משמרות</span>
          </button>
          <button 
            type="button"
            className={`bottom-nav-item ${currentView === 'submissions' ? 'active' : ''}`}
            onClick={() => setCurrentView('submissions')}
          >
            <Users size={18} />
            <span>מאגר ({submissions.length})</span>
          </button>
          <button 
            type="button"
            className={`bottom-nav-item ${currentView === 'personal' ? 'active' : ''}`}
            onClick={() => setCurrentView('personal')}
          >
            <User size={18} />
            <span>לו"ז אישי</span>
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;
