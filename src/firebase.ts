import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  where, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  where, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  getDoc,
  serverTimestamp,
  signInWithPopup,
  onAuthStateChanged,
  signOut
};

export interface ScoreEntry {
  playerName: string;
  level: string;
  turns: number;
  coins: number;
  timestamp: any;
}

export const saveScore = async (score: Omit<ScoreEntry, 'timestamp'>) => {
  try {
    await addDoc(collection(db, 'leaderboard'), {
      ...score,
      timestamp: new Date()
    });
  } catch (e) {
    console.error('Error saving score:', e);
  }
};

export const getLeaderboard = async (level: string) => {
  try {
    const q = query(
      collection(db, 'leaderboard'),
      where('level', '==', level),
      orderBy('turns', 'asc'),
      orderBy('coins', 'desc'),
      limit(10)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as ScoreEntry);
  } catch (e) {
    console.error('Error fetching leaderboard:', e);
    return [];
  }
};
