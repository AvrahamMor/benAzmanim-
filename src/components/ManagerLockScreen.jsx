import React, { useState } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, ArrowLeft, KeyRound, AlertCircle, Sparkles } from 'lucide-react';

export default function ManagerLockScreen({
  correctPin = '1234',
  onUnlock,
  onNavigateToSubmit,
  isDarkMode = false
}) {
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (isLockedOut) return;

    if (!pinInput.trim()) {
      setErrorMsg('נא להזין קוד גישה');
      return;
    }

    if (pinInput.trim() === String(correctPin).trim()) {
      setErrorMsg('');
      onUnlock();
    } else {
      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      setPinInput('');

      if (nextFailed >= 5) {
        setIsLockedOut(true);
        setLockoutTimer(30);
        setErrorMsg('נחסמת זמנית עקב ריבוי נסיונות שגויים (30 שניות)');
        
        const interval = setInterval(() => {
          setLockoutTimer(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              setIsLockedOut(false);
              setFailedAttempts(0);
              setErrorMsg('');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setErrorMsg(`קוד שגוי. נותרו עוד ${5 - nextFailed} נסיונות`);
      }
    }
  };

  const handleKeyPress = (num) => {
    if (isLockedOut) return;
    if (pinInput.length < 8) {
      setPinInput(prev => prev + num);
      setErrorMsg('');
    }
  };

  const handleDeleteChar = () => {
    if (isLockedOut) return;
    setPinInput(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isLockedOut) return;
    setPinInput('');
    setErrorMsg('');
  };

  return (
    <div className={`lock-screen-container ${isDarkMode ? 'dark-mode' : ''}`} dir="rtl">
      <div className="lock-card">
        {/* Brand Icon & Title */}
        <div className="lock-header">
          <div className="lock-icon-wrap">
            <Lock size={32} className="lock-icon" />
          </div>
          <h1 className="lock-title">כניסת מנהל בלבד</h1>
          <p className="lock-subtitle">
            סידור עבודה: בן הזמנים • מאובטח ומוגן
          </p>
        </div>

        {/* PIN Entry Form */}
        <form onSubmit={handleSubmit} className="lock-form">
          <label className="lock-label">הזן קוד סודי למנהל:</label>
          
          <div className="pin-input-container">
            <input 
              type={showPin ? 'text' : 'password'}
              value={pinInput}
              onChange={(e) => {
                if (!isLockedOut) {
                  setPinInput(e.target.value);
                  setErrorMsg('');
                }
              }}
              placeholder="הקלד קוד גישה..."
              className="pin-display-input"
              autoFocus
              disabled={isLockedOut}
              maxLength={8}
            />
            <button 
              type="button" 
              className="btn-toggle-pin-vis"
              onClick={() => setShowPin(!showPin)}
              title={showPin ? 'הסתר קוד' : 'הצג קוד'}
            >
              {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {errorMsg && (
            <div className="lock-error-banner">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Numeric Touch Keypad for iPad / Mobile */}
          <div className="pin-keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
              <button 
                key={digit}
                type="button"
                className="keypad-digit-btn"
                onClick={() => handleKeyPress(digit)}
                disabled={isLockedOut}
              >
                {digit}
              </button>
            ))}
            <button 
              type="button" 
              className="keypad-func-btn" 
              onClick={handleClear}
              disabled={isLockedOut}
              title="נקה"
            >
              C
            </button>
            <button 
              type="button" 
              className="keypad-digit-btn" 
              onClick={() => handleKeyPress('0')}
              disabled={isLockedOut}
            >
              0
            </button>
            <button 
              type="button" 
              className="keypad-func-btn" 
              onClick={handleDeleteChar}
              disabled={isLockedOut}
              title="מחק תו"
            >
              ⌫
            </button>
          </div>

          <button 
            type="submit" 
            className="btn-unlock-dashboard"
            disabled={isLockedOut || !pinInput}
          >
            <KeyRound size={18} />
            <span>{isLockedOut ? `נעול (${lockoutTimer}s)` : 'כניסה ללוח הניהול'}</span>
          </button>
        </form>

        {/* Safe Navigation for Waiters */}
        <div className="lock-waiter-section">
          <div className="waiter-divider">
            <span>או</span>
          </div>
          <button 
            type="button" 
            onClick={onNavigateToSubmit}
            className="btn-waiter-submit-portal"
          >
            <span>עובד או מלצר? לחץ כאן להגשת משמרות 📱</span>
            <ArrowLeft size={16} />
          </button>
        </div>

        <div className="lock-footer-hint">
          <span>🔒 קוד ברירת המחדל הראשוני הוא <strong>1234</strong> (ניתן לשינוי בלוח)</span>
        </div>
      </div>
    </div>
  );
}
