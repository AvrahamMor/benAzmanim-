import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc,
  setDoc, 
  deleteDoc,
  writeBatch,
  onSnapshot, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy 
} from 'firebase/firestore';

// Embedded default Firebase configuration for ben-hazmanim
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBQZt_kmX0kW0wjOzz584yZ5jjGUqXAyHY",
  authDomain: "ben-hazmanim.firebaseapp.com",
  projectId: "ben-hazmanim",
  storageBucket: "ben-hazmanim.firebasestorage.app",
  messagingSenderId: "734975842174",
  appId: "1:734975842174:web:4df388e99971a8bacac52f"
};

const getSavedFirebaseConfig = () => {
  try {
    const local = localStorage.getItem('shiftApp_firebaseConfig');
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && parsed.apiKey) return parsed;
    }
  } catch (e) {}

  return DEFAULT_FIREBASE_CONFIG;
};

let currentConfig = getSavedFirebaseConfig();
let db = null;

export const isFirebaseConfigured = () => {
  return Boolean(currentConfig && currentConfig.apiKey && currentConfig.projectId && currentConfig.apiKey.length > 5);
};

export const initFirebase = (customConfig = null) => {
  if (customConfig) {
    currentConfig = customConfig;
    localStorage.setItem('shiftApp_firebaseConfig', JSON.stringify(customConfig));
  } else {
    currentConfig = getSavedFirebaseConfig();
  }

  if (!isFirebaseConfigured()) {
    console.warn('Firebase is not configured yet.');
    return null;
  }

  try {
    const app = getApps().length === 0 ? initializeApp(currentConfig) : getApp();
    db = getFirestore(app);
    return db;
  } catch (err) {
    console.error('Error initializing Firebase:', err);
    return null;
  }
};

// Initialize immediately
initFirebase();

export const getDb = () => {
  if (!db) {
    return initFirebase();
  }
  return db;
};

export const getFirebaseConfig = () => currentConfig;

export const saveFirebaseConfig = (newConfig) => {
  localStorage.setItem('shiftApp_firebaseConfig', JSON.stringify(newConfig));
  currentConfig = newConfig;
  return initFirebase(newConfig);
};

// Real-time listener for current schedule
export const subscribeToSchedule = (callback) => {
  const database = getDb();
  if (!database) return null;

  try {
    const docRef = doc(database, 'schedules', 'current');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.shifts) {
          callback(data.shifts);
        }
      }
    }, (error) => {
      console.warn('Firestore schedule listener error:', error);
    });
  } catch (e) {
    console.error('Failed to subscribe to schedule:', e);
    return null;
  }
};

// Save schedule to Firestore
export const saveScheduleToCloud = async (shiftsData) => {
  const database = getDb();
  if (!database) return;

  try {
    const docRef = doc(database, 'schedules', 'current');
    await setDoc(docRef, {
      shifts: shiftsData,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error('Error saving schedule to Firebase:', err);
  }
};

// Real-time listener for staff list
export const subscribeToStaff = (callback) => {
  const database = getDb();
  if (!database) return null;

  try {
    const docRef = doc(database, 'staff', 'directory');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.list)) {
          callback(data.list);
        }
      }
    }, (error) => {
      console.warn('Firestore staff listener error:', error);
    });
  } catch (e) {
    console.error('Failed to subscribe to staff:', e);
    return null;
  }
};

// Save staff list to Firestore
export const saveStaffToCloud = async (staffList) => {
  const database = getDb();
  if (!database) return;

  try {
    const docRef = doc(database, 'staff', 'directory');
    await setDoc(docRef, {
      list: staffList,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error('Error saving staff to Firebase:', err);
  }
};

// Real-time listener for archives
export const subscribeToArchives = (callback) => {
  const database = getDb();
  if (!database) return null;

  try {
    const colRef = collection(database, 'archives');
    const q = query(colRef, orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const archivesList = [];
      snapshot.forEach(doc => {
        archivesList.push({ id: doc.id, ...doc.data() });
      });
      callback(archivesList);
    }, (error) => {
      console.warn('Firestore archives listener error:', error);
    });
  } catch (e) {
    console.error('Failed to subscribe to archives:', e);
    return null;
  }
};

// Save archive week to Firestore
export const saveArchiveToCloud = async (archiveData) => {
  const database = getDb();
  if (!database) return;

  try {
    const colRef = collection(database, 'archives');
    await addDoc(colRef, {
      ...archiveData,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error saving archive to Firebase:', err);
  }
};

// Helper to create a safe, normalized Firestore document ID from employee name
export const getSafeSubmissionId = (name) => {
  if (!name) return 'unknown';
  return encodeURIComponent(name.trim().toLowerCase().replace(/[\/\\]/g, '_'));
};

// Real-time listener for shift submissions (waiter requests pool)
// Listens to the dedicated 'waiter_submissions' collection where each waiter has their own isolated doc
export const subscribeToSubmissions = (callback) => {
  const database = getDb();
  if (!database) return null;

  try {
    const colRef = collection(database, 'waiter_submissions');
    return onSnapshot(colRef, (snapshot) => {
      const list = snapshot.docs.map(d => d.data());
      list.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
      callback(list);
    }, (error) => {
      console.warn('Firestore waiter_submissions listener error:', error);
    });
  } catch (e) {
    console.error('Failed to subscribe to submissions:', e);
    return null;
  }
};

// Save a single waiter submission directly into its own isolated document (prevents ANY overwrite between waiters)
export const saveSingleSubmissionToCloud = async (submission) => {
  const database = getDb();
  if (!database || !submission || !submission.employeeName) return;

  try {
    const safeId = getSafeSubmissionId(submission.employeeName);
    const docRef = doc(database, 'waiter_submissions', safeId);
    await setDoc(docRef, {
      ...submission,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error('Error saving single submission to Firebase:', err);
  }
};

// Save shift submissions list to Firestore (used when manager modifies list, re-orders, or resets)
export const saveSubmissionsToCloud = async (submissionsList) => {
  const database = getDb();
  if (!database) return;

  try {
    const colRef = collection(database, 'waiter_submissions');
    const existingSnap = await getDocs(colRef);
    const batch = writeBatch(database);

    const newSafeIds = new Set(
      (submissionsList || [])
        .filter(s => s && s.employeeName)
        .map(s => getSafeSubmissionId(s.employeeName))
    );

    // 1. Delete documents that were removed by the manager
    existingSnap.docs.forEach(docSnap => {
      if (!newSafeIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });

    // 2. Set/update all active submissions
    (submissionsList || []).forEach(sub => {
      if (sub && sub.employeeName) {
        const safeId = getSafeSubmissionId(sub.employeeName);
        const docRef = doc(database, 'waiter_submissions', safeId);
        batch.set(docRef, { ...sub, updatedAt: new Date().toISOString() }, { merge: true });
      }
    });

    await batch.commit();

    // Mirror to legacy backup
    const docRef = doc(database, 'shift_submissions', 'current');
    await setDoc(docRef, {
      list: submissionsList || [],
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error('Error saving submissions to Firebase:', err);
  }
};

// Delete a single submission from cloud
export const deleteSubmissionFromCloud = async (employeeName) => {
  const database = getDb();
  if (!database || !employeeName) return;

  try {
    const safeId = getSafeSubmissionId(employeeName);
    await deleteDoc(doc(database, 'waiter_submissions', safeId));
  } catch (err) {
    console.error('Error deleting submission from cloud:', err);
  }
};
