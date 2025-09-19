
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    type User 
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { syncUser } from '@/lib/actions';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signup: (email: string, pass: string) => Promise<void>;
  login: (email: string, pass:string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true); // Start loading when auth state changes
      if (user) {
        setUser(user);
        // Sync user data to your backend DB and wait for it to complete
        try {
            await syncUser({
                userId: user.uid,
                email: user.email!,
                displayName: user.displayName,
            });
        } catch (error) {
            console.error("Failed to sync user:", error);
            // Optionally handle user sync error (e.g., log out the user)
        }
      } else {
        setUser(null);
      }
      setLoading(false); // Stop loading after all operations are done
    });

    return () => unsubscribe();
  }, []);


  const signup = async (email: string, pass: string) => {
    // setLoading(true) is not needed here as onAuthStateChanged will handle it
    try {
        await createUserWithEmailAndPassword(auth, email, pass);
        // The onAuthStateChanged listener will handle the rest.
    } catch (error) {
        console.error("Signup failed: ", error);
        throw error; // Rethrow to be caught by the UI
    }
  };

  const login = async (email: string, pass: string) => {
    // setLoading(true) is not needed here as onAuthStateChanged will handle it
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        // The onAuthStateChanged listener will handle the rest.
    } catch (error) {
        console.error("Login failed: ", error);
        throw error; // Rethrow to be caught by the UI
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

  // Do not render children until loading is false
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

    