export enum Role {
  ADMIN = 'admin',
  SUPERVISOR = 'supervisor',
  VENDEDOR = 'vendedor',
  ANALISTA = 'analista',
}

export type SessionType = 'freeler' | 'empresa';

export const STORAGE_KEYS = {
  token: 'freeler:auth:token',
  user: 'freeler:auth:user',
  theme: 'freeler:theme',
  leadDraft: 'freeler:lead:draft',
} as const;

export const APP_ROUTES = {
  referidos: {
    home: '/',
    login: '/login',
    register: '/registro',
    misReferidos: '/mis-referidos',
    dashboard: '/dashboard',
    capacitacion: '/capacitacion',
  },
  crm: {
    login: '/crm/login',
    register: '/crm/registro',
    home: '/crm/home',
    empresas: '/crm/empresas',
    campanas: '/crm/campanas',
    leads: '/crm/leads',
    leadsKanban: '/crm/leads/kanban',
    usuarios: '/crm/usuarios',
    comisiones: '/crm/comisiones',
    iaConfig: '/crm/configuracion/ia',
    supervisor: {
      home: '/crm/supervisor/home',
      leads: '/crm/supervisor/leads',
    },
    vendedor: {
      home: '/crm/vendedor/home',
      leads: '/crm/vendedor/leads',
      kanban: '/crm/vendedor/kanban',
    },
    analitica: '/crm/analitica/home',
    sinAcceso: '/crm/sin-acceso',
    proximamente: '/crm/proximamente',
  },
} as const;

export const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]: 'Admin',
  [Role.SUPERVISOR]: 'Supervisor',
  [Role.VENDEDOR]: 'Vendedor',
  [Role.ANALISTA]: 'Analista',
};

export const mapBackendRole = (role?: string | null): Role | null => {
  if (!role) return null;
  const normalized = role.toUpperCase();
  switch (normalized) {
    case 'ADMIN':
      return Role.ADMIN;
    case 'SUPERVISOR':
    case 'SUPERADMIN':
      return Role.SUPERVISOR;
    case 'VENDEDOR':
    case 'SALES':
      return Role.VENDEDOR;
    case 'ANALISTA':
    case 'ANALITICA':
    case 'ANALYTICS':
      return Role.ANALISTA;
    default:
      return null;
  }
};


