
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCKBg2rhAwA1FDG7ANza8SyGZKM5AZB5jM",
  authDomain: "examprep-ai-2tes1.firebaseapp.com",
  projectId: "examprep-ai-2tes1",
  storageBucket: "examprep-ai-2tes1.firebasestorage.app",
  messagingSenderId: "100080345107",
  appId: "1:100080345107:web:313fa38a95f7f9ac7b5fe6"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
