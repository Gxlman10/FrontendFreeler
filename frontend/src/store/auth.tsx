import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AuthService } from '@/services/auth.service';
import type { SessionUser } from '@/services/auth.service';
import { setAuthToken } from '@/services/api';

type AuthContextValue = {
  user: SessionUser | null;
  isLoading: boolean;
  loginReferidos: (email: string, password: string) => Promise<SessionUser>;
  loginEmpresa: (email: string, password: string) => Promise<SessionUser>;
  registerEmpresa: (payload: {
    nombre_empresa: string;
    ruc: string;
    direccion: string;
    telefono: string;
    email: string;
    password: string;
  }) => Promise<SessionUser>;
  registerFreeler: (payload: {
    nombres: string;
    apellidos: string;
    dni: string;
    email: string;
    telefono?: string;
    password: string;
  }) => Promise<SessionUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type Props = { children: ReactNode };

export const AuthProvider = ({ children }: Props) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const stored = AuthService.getStoredUser();
      if (stored) {
        setAuthToken(stored.token);
        const session = await AuthService.ensureEmpresaContext(stored);
        if (!isMounted) return;
        setUser(session);
      }
      if (isMounted) setIsLoading(false);
    };

    void restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const loginReferidos = useCallback(async (email: string, password: string) => {
    const session = await AuthService.loginFreeler(email, password);
    setUser(session);
    return session;
  }, []);

  const loginEmpresa = useCallback(async (email: string, password: string) => {
    const session = await AuthService.loginEmpresa(email, password);
    setUser(session);
    return session;
  }, []);

  const registerEmpresa = useCallback(
    async (payload: {
      nombre_empresa: string;
      ruc: string;
      direccion: string;
      telefono: string;
      email: string;
      password: string;
    }) => {
      const session = await AuthService.registerEmpresa(payload);
      setUser(session);
      return session;
    },
    [],
  );

  const registerFreeler = useCallback(
    async (payload: {
      nombres: string;
      apellidos: string;
      dni: string;
      email: string;
      telefono?: string;
      password: string;
    }) => {
      const session = await AuthService.registerFreeler(payload);
      setUser(session);
      return session;
    },
    [],
  );

  const logout = useCallback(() => {
    AuthService.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      loginReferidos,
      loginEmpresa,
      registerEmpresa,
      registerFreeler,
      logout,
    }),
    [user, isLoading, loginReferidos, loginEmpresa, registerEmpresa, registerFreeler, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
