import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentOrgId, setCurrentOrgId] = useState(() => {
    const stored = localStorage.getItem("medrelease_org_id");
    return stored ? Number(stored) : null;
  });

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem("medrelease_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.me();
      setUser(me);
      if (currentOrgId === null && me.memberships?.length) {
        setCurrentOrgId(me.memberships[0].organization_id);
      }
    } catch {
      localStorage.removeItem("medrelease_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = async (email, password) => {
    const data = await api.login({ email, password });
    localStorage.setItem("medrelease_token", data.access_token);
    setUser(data.user);
    if (data.user.memberships?.length) {
      selectOrg(data.user.memberships[0].organization_id);
    }
    return data.user;
  };

  const register = async (email, password, fullName) => {
    const data = await api.register({ email, password, full_name: fullName });
    localStorage.setItem("medrelease_token", data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("medrelease_token");
    localStorage.removeItem("medrelease_org_id");
    setUser(null);
    setCurrentOrgId(null);
  };

  const selectOrg = (orgId) => {
    setCurrentOrgId(orgId);
    localStorage.setItem("medrelease_org_id", String(orgId));
  };

  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, login, register, logout, currentOrgId, selectOrg, refresh: loadMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
