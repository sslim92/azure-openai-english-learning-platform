
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// This is a mock user type. Replace with your actual user type from the database.
interface User {
  uid: string;
  email: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  signup: (email: string, pass: string) => Promise<any>;
  logout: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// This is a mock implementation. Replace with your actual auth logic (e.g., calling your own API endpoints)
// In a real app, you would not have dummy user data like this.
const FAKE_USER: User = { uid: 'user-123-abc', email: 'test@example.com' };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // In a real app, you'd check for a session token (e.g., in localStorage or a cookie)
    // and validate it with your backend to see if the user is already logged in.
    const sessionUser = localStorage.getItem('session_user');
    if (sessionUser) {
        setUser(JSON.parse(sessionUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, pass: string) => {
    // MOCK LOGIN: In a real app, this would be an API call to your backend
    // which would validate credentials against the 'Users' table in Azure SQL.
    console.log(`Attempting login for ${email}`);
    if (email === FAKE_USER.email) { // Simple mock validation
        setUser(FAKE_USER);
        localStorage.setItem('session_user', JSON.stringify(FAKE_USER));
        return Promise.resolve();
    }
    return Promise.reject(new Error('Invalid credentials'));
  };

  const signup = async (email: string, pass:string) => {
     // MOCK SIGNUP: In a real app, this would be an API call to your backend
    // which would create a new user in the 'Users' table.
    console.log(`Attempting signup for ${email}`);
    const newUser = { uid: `new-${Date.now()}`, email };
    setUser(newUser);
    localStorage.setItem('session_user', JSON.stringify(newUser));
    return Promise.resolve();
  }

  const logout = async () => {
    // MOCK LOGOUT
    setUser(null);
    localStorage.removeItem('session_user');
    router.push('/');
    return Promise.resolve();
  };
  
  const value = {
    user,
    loading,
    login,
    signup,
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
