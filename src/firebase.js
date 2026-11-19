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

// Real-time listener for shift submissions (waiter requests pool)
// Listens to the dedicated 'waiter_submissions' collection where each waiter has their own isolated doc
export const subscribeToSubmissions = (callback) => {
  const database = getDb();
  if (!database) return null;

  try {
    const colRef = collection(database, 'waiter_submissions');
    return onSnapshot(colRef, (snapshot) => {
      if (!snapshot.empty) {
        const list = snapshot.docs.map(d => d.data());
        list.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
        callback(list);
      } else {
        // Fallback: check legacy single-document storage if collection is initially empty
        const docRef = doc(database, 'shift_submissions', 'current');
        getDoc(docRef).then(snap => {
          if (snap.exists() && Array.isArray(snap.data().list) && snap.data().list.length > 0) {
            callback(snap.data().list);
          } else {
            callback([]);
          }
        }).catch(() => callback([]));
      }
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
    const safeId = encodeURIComponent(submission.employeeName.trim().toLowerCase());
    const docRef = doc(database, 'waiter_submissions', safeId);
    await setDoc(docRef, {
      ...submission,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Also mirror to legacy shift_submissions/current for backup
    const legacyDocRef = doc(database, 'shift_submissions', 'current');
    const legacySnap = await getDoc(legacyDocRef);
    let currentList = [];
    if (legacySnap.exists() && Array.isArray(legacySnap.data().list)) {
      currentList = legacySnap.data().list;
    }
    const idx = currentList.findIndex(s => 
      (s.employeeName || '').trim().toLowerCase() === submission.employeeName.trim().toLowerCase()
    );
    if (idx >= 0) {
      currentList[idx] = submission;
    } else {
      currentList.push(submission);
    }
    await setDoc(legacyDocRef, {
      list: currentList,
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
    // If manager clicked "איפוס הגשות לשבוע חדש" (empty list), clear all docs in waiter_submissions
    if (!submissionsList || submissionsList.length === 0) {
      const snap = await getDocs(collection(database, 'waiter_submissions'));
      const batch = writeBatch(database);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();

      const docRef = doc(database, 'shift_submissions', 'current');
      await setDoc(docRef, { list: [], updatedAt: new Date().toISOString() });
      return;
    }

    // Otherwise, batch save every submission into its own isolated document
    const batch = writeBatch(database);
    submissionsList.forEach(sub => {
      if (sub && sub.employeeName) {
        const safeId = encodeURIComponent(sub.employeeName.trim().toLowerCase());
        const docRef = doc(database, 'waiter_submissions', safeId);
        batch.set(docRef, { ...sub, updatedAt: new Date().toISOString() }, { merge: true });
      }
    });
    await batch.commit();

    // Mirror to legacy backup
    const docRef = doc(database, 'shift_submissions', 'current');
    await setDoc(docRef, {
      list: submissionsList,
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
    const safeId = encodeURIComponent(employeeName.trim().toLowerCase());
    await deleteDoc(doc(database, 'waiter_submissions', safeId));
  } catch (err) {
    console.error('Error deleting submission from cloud:', err);
  }
};
