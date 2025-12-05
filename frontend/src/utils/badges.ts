import { Role } from '@/utils/constants';
import type { BadgeVariant } from '@/components/ui/Badge';

export const ROLE_BADGE_VARIANTS: Record<Role, BadgeVariant> = {
  [Role.ADMIN]: 'role-admin',
  [Role.SUPERVISOR]: 'role-supervisor',
  [Role.VENDEDOR]: 'role-vendedor',
  [Role.ANALISTA]: 'role-analista',
};

export const getRoleBadgeVariant = (role?: Role | null): BadgeVariant =>
  role ? ROLE_BADGE_VARIANTS[role] : 'role-pending';

const normalizeToken = (value: string) =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const LEAD_STATUS_BADGES: Record<string, BadgeVariant> = {
  pendiente: 'status-pending',
  '1': 'status-pending',
  asignado: 'info',
  '2': 'info',
  contactado: 'info',
  '3': 'info',
  'en gestion': 'warning',
  gestion: 'warning',
  'en gestion comercial': 'warning',
  '4': 'warning',
  perdido: 'danger',
  '5': 'danger',
  ganado: 'success',
  '6': 'success',
  'volver a llamar': 'warning',
  'llamar de nuevo': 'warning',
  '7': 'warning',
  'cita pendiente': 'info',
  'pendiente de cita': 'info',
  '8': 'info',
  'cita concretada': 'success',
  'cita realizada': 'success',
  '9': 'success',
  'no contesta': 'neutral',
  '10': 'neutral',
  seguimiento: 'info',
  'follow up': 'info',
  '11': 'info',
  'otro producto': 'secondary',
  '12': 'secondary',
  'no desea': 'danger',
  'no interesado': 'danger',
  '13': 'danger',
  'no califica': 'danger',
  '14': 'danger',
  'otros (no catalogados)': 'neutral',
  otros: 'neutral',
  '15': 'neutral',
};

export const getStatusBadgeVariant = (status?: string | number | null): BadgeVariant => {
  if (typeof status === 'number') {
    if (status === 1) return 'status-active';
    if (status === 0) return 'status-inactive';
  }

  if (!status) return 'status-pending';

  const normalized =
    typeof status === 'number' ? String(status) : normalizeToken(String(status));

  if (LEAD_STATUS_BADGES[normalized]) {
    return LEAD_STATUS_BADGES[normalized];
  }

  if (['1', 'activo', 'active', 'habilitado', 'enabled'].includes(normalized)) {
    return 'status-active';
  }

  if (['0', 'inactivo', 'inactive', 'inhabilitado', 'disabled', 'cerrado'].includes(normalized)) {
    return 'status-inactive';
  }

  if (['pendiente', 'pending', 'en revision', 'sin asignar', 'prospecto'].includes(normalized)) {
    return 'status-pending';
  }

  if (['archivado', 'archived', 'cerrado'].includes(normalized)) {
    return 'status-archived';
  }

  return 'neutral';
};

export const normalizeStatusLabel = (status?: string | number | null, fallback = 'Sin estado'): string => {
  if (status === null || status === undefined) return fallback;
  if (typeof status === 'number') return status === 1 ? 'Activo' : status === 0 ? 'Inactivo' : fallback;
  const label = status.toString().trim();
  return label.length ? label.charAt(0).toUpperCase() + label.slice(1).toLowerCase() : fallback;
};
