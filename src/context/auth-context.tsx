
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    type User as FirebaseUser 
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { syncUser, getUserProfile, getUserStats, upsertUser } from '@/lib/actions';
import type { UserProfile, UserStats } from '@/lib/data';
import { useRouter } from 'next/navigation';

type AppUser = FirebaseUser & UserProfile & UserStats;

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signup: (email: string, pass: string, displayName: string) => Promise<void>;
  login: (email: string, pass:string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        try {
            // This syncUser is for general login and state changes.
            await syncUser({
                userId: firebaseUser.uid,
                email: firebaseUser.email!,
                displayName: firebaseUser.displayName, // Pass whatever is in firebase auth
            });
            
            const [userProfile, userStats] = await Promise.all([
              getUserProfile(firebaseUser.uid),
              getUserStats(firebaseUser.uid)
            ]);
            
            if (userProfile) {
                const appUser: AppUser = {
                    ...firebaseUser,
                    ...userProfile,
                    ...userStats,
                };
                setUser(appUser);
            } else {
                 console.error("Failed to fetch user profile after sync.");
                 const fallbackUser: AppUser = {
                    ...firebaseUser,
                    level: 1,
                    experiencePoints: 0,
                    stage: '알',
                    totalQuestionsSolved: 0,
                    correctAnswers: 0,
                    accuracy: 0,
                 };
                 setUser(fallbackUser);
            }

        } catch (error) {
            console.error("Failed to sync or fetch user profile on auth state change:", error);
            const errorFallbackUser: AppUser = {
                ...firebaseUser,
                level: 1,
                experiencePoints: 0,
                stage: '알',
                totalQuestionsSolved: 0,
                correctAnswers: 0,
                accuracy: 0,
            };
            setUser(errorFallbackUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);


  const signup = async (email: string, pass: string, displayName: string) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const firebaseUser = userCredential.user;

        // Immediately update Firebase Auth profile with the new display name
        await updateProfile(firebaseUser, { displayName });
        
        // **Crucially, directly write to our DB here with the displayName from the form**
        // This avoids any race conditions with onAuthStateChanged.
        await upsertUser({
            userId: firebaseUser.uid,
            email: firebaseUser.email!,
            displayName: displayName // Use the name from the form directly
        });

    } catch (error) {
        console.error("Signup failed: ", error);
        throw error; // Re-throw to be caught by the UI
    }
  };

  const login = async (email: string, pass: string) => {
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        // onAuthStateChanged will handle the rest
        router.push('/');
    } catch (error) {
        console.error("Login failed: ", error);
        throw error;
    }
  };


  const logout = async () => {
    try {
      await signOut(auth);
      router.push('/landing');
    } catch (error) {
      console.error("Logout failed: ", error);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signup,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
