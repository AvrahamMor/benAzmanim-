import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
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
