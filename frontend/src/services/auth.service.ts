import { api, setAuthToken } from './api';
import { decodeJwt, safeJsonParse } from '@/utils/helpers';
import { mapBackendRole, Role, STORAGE_KEYS } from '@/utils/constants';
import type { SessionType } from '@/utils/constants';

type LoginResponse = {
  access_token: string;
};

type DecodedToken = {
  sub: number;
  email?: string;
  role?: string;
  type: SessionType;
  companyId?: number;
};

export type SessionUser = {
  id: number;
  email: string;
  type: SessionType;
  role: Role | null;
  companyId?: number;
  token: string;
};

const persistUser = (user: SessionUser | null) => {
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.user);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
};

const buildSessionUser = (decoded: DecodedToken, token: string): SessionUser => {
  const parsedId = Number(decoded.sub);
  return {
    id: Number.isFinite(parsedId) ? parsedId : 0,
    email: decoded.email ?? '',
    type: decoded.type,
    role: mapBackendRole(decoded.role ?? undefined),
    companyId: decoded.companyId,
    token,
  };
};

const extractCompanyId = (profile: unknown): number | undefined => {
  if (!profile || typeof profile !== 'object') return undefined;
  const candidate = (profile as { id_empresa?: number }).id_empresa;
  if (typeof candidate === 'number') return candidate;
  const nested = (profile as { empresa?: { id_empresa?: number } }).empresa;
  if (nested && typeof nested.id_empresa === 'number') return nested.id_empresa;
  return undefined;
};

const ensureEmpresaCompanyContext = async (user: SessionUser): Promise<SessionUser> => {
  if (user.type !== 'empresa') {
    persistUser(user);
    return user;
  }
  if (user.companyId) {
    persistUser(user);
    return user;
  }
  try {
    const profile = await AuthService.fetchEmpresaProfile(user.id);
    const companyId = extractCompanyId(profile);
    if (companyId) {
      const enriched = { ...user, companyId };
      persistUser(enriched);
      return enriched;
    }
  } catch {
    // swallow errors to avoid blocking login flows; UI can handle missing context
  }
  persistUser(user);
  return user;
};

export const AuthService = {
  getStoredUser(): SessionUser | null {
    const stored = safeJsonParse<SessionUser>(localStorage.getItem(STORAGE_KEYS.user));
    if (!stored) return null;
    const normalizedRole = mapBackendRole((stored.role as unknown as string) ?? null);
    const parsedId = Number((stored as any).id);
    return {
      ...stored,
      id: Number.isFinite(parsedId) ? parsedId : 0,
      role: normalizedRole,
    };
  },

  async loginFreeler(email: string, password: string) {
    const { data } = await api.post<LoginResponse>('/auth/freeler/login', {
      email,
      password,
    });
    setAuthToken(data.access_token);
    const decoded = decodeJwt<DecodedToken>(data.access_token);
    if (!decoded) throw new Error('TOKEN_INVALID');
    const user = buildSessionUser(decoded, data.access_token);
    return ensureEmpresaCompanyContext(user);
  },

  async loginEmpresa(email: string, password: string) {
    const { data } = await api.post<LoginResponse>('/auth/empresa/login', {
      email,
      password,
    });
    setAuthToken(data.access_token);
    const decoded = decodeJwt<DecodedToken>(data.access_token);
    if (!decoded) throw new Error('TOKEN_INVALID');
    const user = buildSessionUser(decoded, data.access_token);
    return ensureEmpresaCompanyContext(user);
  },

  async registerEmpresa(payload: {
    nombre_empresa: string;
    ruc: string;
    direccion: string;
    telefono: string;
    email: string;
    password: string;
  }) {
    const { data } = await api.post<LoginResponse>('/auth/empresa/register', payload);
    setAuthToken(data.access_token);
    const decoded = decodeJwt<DecodedToken>(data.access_token);
    if (!decoded) throw new Error('TOKEN_INVALID');
    const user = buildSessionUser(decoded, data.access_token);
    return ensureEmpresaCompanyContext(user);
  },

  async registerFreeler(payload: {
    nombres: string;
    apellidos: string;
    dni: string;
    email: string;
    telefono?: string;
    password: string;
  }) {
    const { data } = await api.post<LoginResponse>('/usuarios-freeler/register', payload);
    setAuthToken(data.access_token);
    const decoded = decodeJwt<DecodedToken>(data.access_token);
    if (!decoded) throw new Error('TOKEN_INVALID');
    const user = buildSessionUser(decoded, data.access_token);
    persistUser(user);
    return user;
  },

  logout() {
    setAuthToken(null);
    persistUser(null);
  },

  async fetchFreelerProfile(id: number) {
    const { data } = await api.get(`/usuarios-freeler/${id}`);
    return data;
  },

  async fetchEmpresaProfile(id: number) {
    const { data } = await api.get(`/usuarios-empresa/${id}`);
    return data;
  },

  async ensureEmpresaContext(user: SessionUser) {
    return ensureEmpresaCompanyContext(user);
  },
};
