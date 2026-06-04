import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Primary Project: English Department Rubrics
const firebaseConfig = {
  apiKey: "AIzaSyCHnMsKLG9Wv7Fh4MBsewJv0UudIA9lFkQ",
  authDomain: "umbral-rubrics.firebaseapp.com",
  projectId: "umbral-rubrics",
  storageBucket: "umbral-rubrics.firebasestorage.app",
  messagingSenderId: "65802143949",
  appId: "1:65802143949:web:5f8fd6d4cf0614e91d0184"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence and multi-tab management
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// For shared library
export const rubricsDb = db;


