
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  "projectId": "edusearch-pro3-78636271-fb23b",
  "appId": "1:184535326164:web:cbe8052d15e363d32c4a41",
  "storageBucket": "edusearch-pro3-78636271-fb23b.firebasestorage.app",
  "apiKey": "AIzaSyBf3XhtrC56u6pBBi3Mh3KYvzf-GFYfDqo",
  "authDomain": "edusearch-pro3-78636271-fb23b.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "184535326164"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
