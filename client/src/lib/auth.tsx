import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "@shared/schema";

interface OneClickResult {
  user: User;
  token: string;
  credentials: {
    accountId: string;
    password: string;
  };
  message: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  loginByAccount: (accountId: string, password: string) => Promise<void>;
  loginByPhone: (phone: string, password: string) => Promise<void>;
  oneClickRegister: () => Promise<OneClickResult>;
  confirmOneClickLogin: (user: User, token: string) => void;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  username: string;
  password: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  referralCode?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("pwm_token");
    if (savedToken) {
      setToken(savedToken);
      fetchUser(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        localStorage.removeItem("pwm_token");
        setToken(null);
      }
    } catch {
      localStorage.removeItem("pwm_token");
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Login failed");
    }
    
    const data = await res.json();
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("pwm_token", data.token);
  };

  const loginByAccount = async (accountId: string, password: string) => {
    const res = await fetch("/api/auth/login-by-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, password }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Login failed");
    }
    
    const data = await res.json();
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("pwm_token", data.token);
  };

  const loginByPhone = async (phone: string, password: string) => {
    const res = await fetch("/api/auth/login-by-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Login failed");
    }
    
    const data = await res.json();
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("pwm_token", data.token);
  };

  const oneClickRegister = async (): Promise<OneClickResult> => {
    const res = await fetch("/api/auth/one-click-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Registration failed");
    }
    
    const data = await res.json();
    return data;
  };

  const confirmOneClickLogin = (userData: User, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem("pwm_token", authToken);
  };

  const register = async (data: RegisterData) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Registration failed");
    }
    
    const result = await res.json();
    setUser(result.user);
    setToken(result.token);
    localStorage.setItem("pwm_token", result.token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("pwm_token");
  };

  const updateUser = (newUser: User) => {
    setUser(newUser);
  };

  const refreshUser = async () => {
    const savedToken = localStorage.getItem("pwm_token");
    if (savedToken) {
      await fetchUser(savedToken);
    }
  };

  useEffect(() => {
    if (!token) return;
    
    const interval = setInterval(() => {
      fetchUser(token);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        loginByAccount,
        loginByPhone,
        oneClickRegister,
        confirmOneClickLogin,
        register,
        logout,
        isLoading,
        isAuthenticated: !!user,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function useAuthHeaders() {
  const { token } = useAuth();
  return {
    Authorization: token ? `Bearer ${token}` : "",
    "Content-Type": "application/json",
  };
}
