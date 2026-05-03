// firebase-auth.js — v18
// Handles Google sign-in and cloud progress/completion saving via Firestore.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyA-QbwUgprGtna18gCHKMHfctmT9lcVBFA",
  authDomain: "arrowword.firebaseapp.com",
  projectId: "arrowword",
  storageBucket: "arrowword.firebasestorage.app",
  messagingSenderId: "523122165795",
  appId: "1:523122165795:web:69e308770df7fc75114996"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── Auth state ────────────────────────────────────────────────────────────────
let _currentUser = null;
let _authCallbacks = [];

onAuthStateChanged(auth, user => {
  _currentUser = user;
  _authCallbacks.forEach(cb => cb(user));
});

export function onUserChanged(cb) { _authCallbacks.push(cb); if (_currentUser !== null) cb(_currentUser); }
export function getCurrentUser()  { return _currentUser; }

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch(e) {
    if (e.code !== 'auth/popup-closed-by-user') throw e;
  }
}

export async function signOutUser() {
  await signOut(auth);
}

// ── Progress storage (Firestore) ──────────────────────────────────────────────
// Path: users/{uid}/progress/{puzzleId}  → { answers:{}, savedAt, complete }

export async function saveProgressCloud(puzzleId, answers, complete = false) {
  if (!_currentUser) return false;
  const ref = doc(db, 'users', _currentUser.uid, 'progress', puzzleId);
  await setDoc(ref, { answers, complete, savedAt: Date.now(), puzzleId });
  return true;
}

export async function loadProgressCloud(puzzleId) {
  if (!_currentUser) return null;
  const ref = doc(db, 'users', _currentUser.uid, 'progress', puzzleId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function loadAllProgressCloud() {
  if (!_currentUser) return {};
  const col = collection(db, 'users', _currentUser.uid, 'progress');
  const snaps = await getDocs(col);
  const result = {};
  snaps.forEach(s => { result[s.id] = s.data(); });
  return result;
}

export async function clearProgressCloud(puzzleId) {
  if (!_currentUser) return;
  const ref = doc(db, 'users', _currentUser.uid, 'progress', puzzleId);
  await deleteDoc(ref);
}
