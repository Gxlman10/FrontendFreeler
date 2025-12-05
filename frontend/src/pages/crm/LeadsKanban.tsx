import { FormEvent, TouchEvent as ReactTouchEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LeadService, unwrapLeadCollection } from '@/services/lead.service';
import type { Lead } from '@/services/lead.service';
import { FileText, History as HistoryIcon, Pencil, RotateCcw, UserRound, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Dialog } from '@/components/ui/Dialog';
import { TextArea } from '@/components/ui/TextArea';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/store/auth';
import { t } from '@/i18n';
import { useToast } from '@/components/common/Toasts';
import { LeadEditorDrawer } from '@/components/crm/LeadEditorDrawer';
import { UserService } from '@/services/user.service';
import { FilterPanel, FilterField } from '@/components/common/FilterPanel';
import { MobileFiltersModal } from '@/components/common/MobileFiltersModal';
import { FilterToggleButton } from '@/components/common/FilterToggleButton';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Role } from '@/utils/constants';

type KanbanVariant = 'vendor' | 'admin' | 'supervisor';

type FiltersState = {
  search: string;
  campaignId: 'all' | 'none' | number;
  vendorId: 'all' | number;
};

const DEFAULT_FILTERS: FiltersState = {
  search: '',
  campaignId: 'all',
  vendorId: 'all',
};

const normalizeLabel = (value?: string | null) =>
  (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();

type ColumnPalette = {
  headerBg: string;
  headerText: string;
  border: string;
  pillBg: string;
  pillText: string;
  accent: string;
};

type ColumnConfig = {
  label: string;
  key: string;
  statusAliases: string[];
  palette: ColumnPalette;
};

const COLUMN_CONFIGS: ColumnConfig[] = [
  {
    label: 'PENDIENTE',
    key: 'pendiente',
    statusAliases: ['pendiente', 'pendiente sin asignar', 'pendiente (sin asignar)'],
    palette: {
      headerBg: '#E5E7EB',
      headerText: '#374151',
      border: '#D1D5DB',
      pillBg: '#9CA3AF',
      pillText: '#111827',
      accent: '#6B7280',
    },
  },
  {
    label: 'ASIGNADO',
    key: 'asignado',
    statusAliases: ['asignado', 'asignada'],
    palette: {
      headerBg: '#DBEAFE',
      headerText: '#1D4ED8',
      border: '#93C5FD',
      pillBg: '#60A5FA',
      pillText: '#0F172A',
      accent: '#3B82F6',
    },
  },
  {
    label: 'CONTACTADO',
    key: 'contactado',
    statusAliases: ['contactado', 'contactar', 'contactado nuevamente', 'contactado otra vez'],
    palette: {
      headerBg: '#E0F2FE',
      headerText: '#0C4A6E',
      border: '#7DD3FC',
      pillBg: '#38BDF8',
      pillText: '#0F172A',
      accent: '#0EA5E9',
    },
  },
  {
    label: 'EN GESTION',
    key: 'en gestion',
    statusAliases: ['en gestion', 'gestion', 'gestión', 'en gestion comercial'],
    palette: {
      headerBg: '#E0E7FF',
      headerText: '#312E81',
      border: '#C7D2FE',
      pillBg: '#818CF8',
      pillText: '#111827',
      accent: '#6366F1',
    },
  },
  {
    label: 'VOLVER A LLAMAR',
    key: 'volver a llamar',
    statusAliases: ['volver a llamar', 'llamar de nuevo', 'reintentar llamada'],
    palette: {
      headerBg: '#FEF9C3',
      headerText: '#78350F',
      border: '#FDE047',
      pillBg: '#FACC15',
      pillText: '#422006',
      accent: '#CA8A04',
    },
  },
  {
    label: 'CITA PENDIENTE',
    key: 'cita pendiente',
    statusAliases: ['cita pendiente', 'cita programada', 'pendiente de cita'],
    palette: {
      headerBg: '#CCFBF1',
      headerText: '#134E4A',
      border: '#99F6E4',
      pillBg: '#2DD4BF',
      pillText: '#022C22',
      accent: '#14B8A6',
    },
  },
  {
    label: 'CITA CONCRETADA',
    key: 'cita concretada',
    statusAliases: ['cita concretada', 'cita realizada', 'cita confirmada'],
    palette: {
      headerBg: '#DCFCE7',
      headerText: '#166534',
      border: '#A7F3D0',
      pillBg: '#34D399',
      pillText: '#064E3B',
      accent: '#10B981',
    },
  },
  {
    label: 'NO CONTESTA',
    key: 'no contesta',
    statusAliases: ['no contesta', 'sin contestar', 'no responde'],
    palette: {
      headerBg: '#F3E8FF',
      headerText: '#6B21A8',
      border: '#E9D5FF',
      pillBg: '#C084FC',
      pillText: '#4C1D95',
      accent: '#A855F7',
    },
  },
  {
    label: 'SEGUIMIENTO',
    key: 'seguimiento',
    statusAliases: ['seguimiento', 'follow up'],
    palette: {
      headerBg: '#CFFAFE',
      headerText: '#155E75',
      border: '#99F6E4',
      pillBg: '#22D3EE',
      pillText: '#0F172A',
      accent: '#06B6D4',
    },
  },
  {
    label: 'GANADO',
    key: 'ganado',
    statusAliases: ['ganado'],
    palette: {
      headerBg: '#DCFCE7',
      headerText: '#065F46',
      border: '#A7F3D0',
      pillBg: '#34D399',
      pillText: '#064E3B',
      accent: '#16A34A',
    },
  },
  {
    label: 'OTRO PRODUCTO',
    key: 'otro producto',
    statusAliases: ['otro producto', 'producto alterno'],
    palette: {
      headerBg: '#E5E7EB',
      headerText: '#1F2937',
      border: '#D1D5DB',
      pillBg: '#9CA3AF',
      pillText: '#111827',
      accent: '#6B7280',
    },
  },
  {
    label: 'PERDIDO',
    key: 'perdido',
    statusAliases: ['perdido'],
    palette: {
      headerBg: '#FEE2E2',
      headerText: '#991B1B',
      border: '#FCA5A5',
      pillBg: '#F87171',
      pillText: '#FEF2F2',
      accent: '#DC2626',
    },
  },
  {
    label: 'NO DESEA',
    key: 'no desea',
    statusAliases: ['no desea', 'no interesado', 'no desea continuar'],
    palette: {
      headerBg: '#FFE4E6',
      headerText: '#9F1239',
      border: '#FECDD3',
      pillBg: '#FB7185',
      pillText: '#881337',
      accent: '#F43F5E',
    },
  },
  {
    label: 'NO CALIFICA',
    key: 'no califica',
    statusAliases: ['no califica', 'no calificado'],
    palette: {
      headerBg: '#FECACA',
      headerText: '#7F1D1D',
      border: '#FCA5A5',
      pillBg: '#F87171',
      pillText: '#7F1D1D',
      accent: '#B91C1C',
    },
  },
  {
    label: 'OTROS (NO CATALOGADOS)',
    key: 'otros',
    statusAliases: ['otros', 'otro', 'no catalogado', 'no catalogados', 'sin estado', 'sin clasificar', 'sin categoria'],
    palette: {
      headerBg: '#E2E8F0',
      headerText: '#1E293B',
      border: '#CBD5F5',
      pillBg: '#94A3B8',
      pillText: '#0F172A',
      accent: '#94A3B8',
    },
  },
];

const FALLBACK_COLUMN = COLUMN_CONFIGS[COLUMN_CONFIGS.length - 1];

const COLUMN_LABELS = COLUMN_CONFIGS.map((config) => config.label);
const COLUMN_KEY_TO_LABEL = new Map<string, string>(
  COLUMN_CONFIGS.map((config) => [config.key, config.label]),
);
const PENDING_COLUMN_KEY = COLUMN_CONFIGS[0]?.key ?? 'pendiente';
const PENDING_COLUMN_LABEL = COLUMN_CONFIGS[0]?.label ?? 'Pendiente';
const ASSIGNED_COLUMN_LABEL =
  COLUMN_CONFIGS.find((config) => config.key === 'asignado')?.label ?? PENDING_COLUMN_LABEL;

const getColumnConfigFromValue = (value?: string | null): ColumnConfig => {
  if (!value) return FALLBACK_COLUMN;
  const normalized = normalizeLabel(value);
  if (!normalized) return FALLBACK_COLUMN;
  return (
    COLUMN_CONFIGS.find((column) => column.key === normalized) ??
    COLUMN_CONFIGS.find((column) =>
      column.statusAliases.some((alias) => normalizeLabel(alias) === normalized),
    ) ??
    FALLBACK_COLUMN
  );
};

const getKanbanPalette = (label: string) => getColumnConfigFromValue(label).palette;

const extractStatusOptions = (raw: unknown) => {
  const source = unwrapLeadCollection(raw);
  return source
    .map((item: any) => ({
      id: Number(item.id_estado_lead ?? item.id ?? item.value ?? 0),
      label: String(item.nombre ?? item.label ?? item.descripcion ?? '').trim() || 'Estado',
    }))
    .filter((option) => option.id);
};

const hasActiveAssignment = (lead?: Lead | null) =>
  Boolean(lead?.asignaciones?.some((assignment) => assignment?.estado === 1));

const resolveDetailValue = (
  lead: Lead,
  field: DetailField,
  fallbacks: {
    phone: string;
    city: string;
    origin: string;
    vendor: string;
    email: string;
    dni: string;
    occupation: string;
    description: string;
  },
) => {
  switch (field) {
    case 'telefono':
      return lead.telefono ?? fallbacks.phone;
    case 'ciudad':
      return lead.ciudad ?? fallbacks.city;
    case 'correo':
      return lead.email ?? fallbacks.email;
    case 'dni':
      return lead.dni ?? fallbacks.dni;
    case 'ocupacion':
      return lead.ocupacion ?? fallbacks.occupation;
    case 'descripcion':
      return lead.descripcion ?? fallbacks.description;
    case 'vendedor':
      return getLeadOwnerName(lead) ?? fallbacks.vendor;
    case 'origen':
    default:
      return lead.origen ?? fallbacks.origin;
  }
};

type LeadsKanbanProps = {
  variant?: KanbanVariant;
};

type DetailField =
  | 'origen'
  | 'vendedor'
  | 'ciudad'
  | 'telefono'
  | 'correo'
  | 'dni'
  | 'ocupacion'
  | 'descripcion';

const DEFAULT_DETAIL_FIELD: DetailField = 'telefono';
const TOUCH_DRAG_DELAY = 1000;
const ENABLE_TOUCH_DRAG = false;

export const LeadsKanban = ({ variant }: LeadsKanbanProps) => {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const { user } = useAuth();
  const resolvedVariant =
    variant ??
    (user?.role === Role.VENDEDOR ? 'vendor' : user?.role === Role.SUPERVISOR ? 'supervisor' : 'admin');
  const isVendorVariant = resolvedVariant === 'vendor';
  const isSupervisorVariant = resolvedVariant === 'supervisor';
  const isManagementVariant = !isVendorVariant;
  const isAdminVariant = resolvedVariant === 'admin';
  const currentUserId = user?.id ? Number(user.id) : null;
  const fallbackLeadName = t('crmKanban.defaults.leadName');
  const fallbackCampaignLabel = t('crmKanban.defaults.fallbackCampaign');
  const fallbackDetailLabels = useMemo(
    () => ({
      phone: t('crmKanban.defaults.details.phone'),
      city: t('crmKanban.defaults.details.city'),
      origin: t('crmKanban.defaults.details.origin'),
      vendor: t('crmKanban.defaults.details.vendor'),
      email: t('crmKanban.defaults.details.email'),
      dni: t('crmKanban.defaults.details.dni'),
      occupation: t('crmKanban.defaults.details.occupation'),
      description: t('crmKanban.defaults.details.description'),
    }),
    [t],
  );
  const detailLabelMap = useMemo<Record<DetailField, string>>(
    () => ({
      origen: t('crmKanban.filters.detailOrigin'),
      vendedor: t('crmKanban.filters.detailVendor'),
      ciudad: t('crmKanban.filters.detailCity'),
      telefono: t('crmKanban.filters.detailPhone'),
      correo: t('crmKanban.filters.detailEmail'),
      dni: t('crmKanban.filters.detailDni'),
      ocupacion: t('crmKanban.filters.detailOccupation'),
      descripcion: t('crmKanban.filters.detailDescription'),
    }),
    [t],
  );

  const detailSelectOptions = useMemo<Array<{ value: DetailField; label: string }>>(() => {
    const adminOptions: Array<{ value: DetailField; label: string }> = [
      { value: 'origen', label: detailLabelMap.origen },
      { value: 'vendedor', label: detailLabelMap.vendedor },
    ];
    const sharedOptions: Array<{ value: DetailField; label: string }> = [
      { value: 'telefono', label: detailLabelMap.telefono },
      { value: 'correo', label: detailLabelMap.correo },
      { value: 'dni', label: detailLabelMap.dni },
      { value: 'ciudad', label: detailLabelMap.ciudad },
      { value: 'ocupacion', label: detailLabelMap.ocupacion },
      { value: 'descripcion', label: detailLabelMap.descripcion },
    ];
    return (isManagementVariant ? adminOptions : []).concat(sharedOptions);
  }, [detailLabelMap, isManagementVariant]);

  const availableDetailValues = useMemo(
    () => detailSelectOptions.map((option) => option.value),
    [detailSelectOptions],
  );

  const [filtersVisible, setFiltersVisible] = useState(true);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [kanbanDetails, setKanbanDetails] = useState<DetailField[]>([DEFAULT_DETAIL_FIELD]);
  const [boardOverrides, setBoardOverrides] = useState<Record<number, string>>({});
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false);
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [isNotesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesDialog, setNotesDialog] = useState<{ lead: Lead | null; value: string }>({ lead: null, value: '' });
  const [isHistoryDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyDialogLead, setHistoryDialogLead] = useState<Lead | null>(null);
  const isVendorFilterActive = filters.vendorId !== 'all';
  const filtersLabel = t('crmLeads.actions.filters', 'Filtros');
  const searchPlaceholder = t('crmKanban.filters.searchPlaceholder');
  const searchAriaLabel = t('crmKanban.filters.searchLabel');
  const clearSearchLabel = t('crmLeads.search.clear', 'Limpiar búsqueda');
  const isMobile = useIsMobile();
  const [isDraggingCard, setDraggingCard] = useState(false);
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const [isTouchMode, setTouchMode] = useState(false);
  const [touchDraggableIds, setTouchDraggableIds] = useState<Set<number>>(new Set());
  const [touchDraggingLeadId, setTouchDraggingLeadId] = useState<number | null>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [assigningLeadId, setAssigningLeadId] = useState<number | null>(null);
  const shouldShowPendingUnassigned = isManagementVariant && isVendorFilterActive && showOnlyUnassigned;
  const hasSearchValue = filters.search.trim().length > 0;
  const handleClearSearch = () => setFilters((prev) => ({ ...prev, search: '' }));

  useEffect(() => {
    if (!isVendorFilterActive && showOnlyUnassigned) {
      setShowOnlyUnassigned(false);
    }
  }, [isVendorFilterActive, showOnlyUnassigned]);

  useEffect(() => {
    setKanbanDetails((prev) => {
      const filtered = prev.filter((field) => availableDetailValues.includes(field));
      if (filtered.length) return filtered;
      const fallbackField = availableDetailValues.includes(DEFAULT_DETAIL_FIELD)
        ? DEFAULT_DETAIL_FIELD
        : availableDetailValues[0];
      return fallbackField ? [fallbackField] : [];
    });
  }, [availableDetailValues]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const updateTouchMode = () => setTouchMode(mediaQuery.matches);
    updateTouchMode();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateTouchMode);
      return () => mediaQuery.removeEventListener('change', updateTouchMode);
    }
    mediaQuery.addListener(updateTouchMode);
    return () => mediaQuery.removeListener(updateTouchMode);
  }, []);

  useEffect(() => () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }
  }, []);

  const enableTouchDragForLead = useCallback((leadId: number) => {
    setTouchDraggableIds((prev) => {
      if (prev.has(leadId)) return prev;
      const next = new Set(prev);
      next.add(leadId);
      return next;
    });
  }, []);

  const disableTouchDragForLead = useCallback((leadId: number) => {
    setTouchDraggableIds((prev) => {
      if (!prev.has(leadId)) return prev;
      const next = new Set(prev);
      next.delete(leadId);
      return next;
    });
  }, []);

  const handleTouchHoldStart = useCallback(
    (leadId: number) => {
      if (!ENABLE_TOUCH_DRAG || !isTouchMode) return;
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
      }
      touchTimerRef.current = setTimeout(() => {
        enableTouchDragForLead(leadId);
        setTouchDraggingLeadId(leadId);
        setDraggingCard(true);
        touchTimerRef.current = null;
      }, TOUCH_DRAG_DELAY);
    },
    [enableTouchDragForLead, isTouchMode],
  );

  const cancelTouchTimer = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const clearTouchDragState = useCallback(
    (leadId?: number | null) => {
      const targetId = typeof leadId === 'number' ? leadId : touchDraggingLeadId;
      if (targetId !== null && targetId !== undefined) {
        disableTouchDragForLead(targetId);
      }
      setTouchDraggingLeadId(null);
      setDraggingCard(false);
      setHoveredColumn(null);
    },
    [disableTouchDragForLead, touchDraggingLeadId],
  );


  const normalizedSearch = filters.search.trim();
  const campaignFilterId =
    filters.campaignId === 'all' || filters.campaignId === 'none'
      ? undefined
      : Number(filters.campaignId);

  const leadsQuery = useQuery({
    queryKey: [
      'crm-kanban',
      variant,
      user?.companyId ?? null,
      currentUserId,
      normalizedSearch || 'all',
      filters.campaignId,
    ],
    enabled: isManagementVariant ? Boolean(user?.companyId) : Boolean(currentUserId),
    queryFn: async () => {
      if (isManagementVariant) {
        const response = await LeadService.listByEmpresa({
          page: 1,
          limit: 500,
          search: normalizedSearch || undefined,
          id_campania: campaignFilterId,
        });
        return unwrapLeadCollection<Lead>(response);
      }

      if (user?.type === 'empresa' && currentUserId) {
        try {
          const response = await LeadService.listByEmpresa({
            page: 1,
            limit: 500,
            search: normalizedSearch || undefined,
            id_campania: campaignFilterId,
            asignado_a_usuario_empresa_id: currentUserId,
          });
          return unwrapLeadCollection<Lead>(response);
        } catch (error) {
          console.warn('[CRM][Kanban] listByEmpresa vendor fallback', error);
        }
      }

      const rows = await LeadService.listVendorUniverse({
        filters: {
          limit: 500,
          search: normalizedSearch || undefined,
          id_campania: campaignFilterId,
        },
        includeEmpresa: user?.type === 'empresa',
        freelerUserId: user?.type === 'freeler' ? currentUserId : null,
        empresaUserId: user?.type === 'empresa' ? currentUserId : null,
      });
      return Array.isArray(rows) ? rows : [];
    },
    keepPreviousData: true,
  });

  const unassignedLeadsQuery = useQuery({
    queryKey: [
      'crm-kanban-unassigned',
      variant,
      user?.companyId ?? null,
      normalizedSearch || 'all',
      filters.campaignId,
      filters.vendorId,
    ],
    enabled: shouldShowPendingUnassigned,
    queryFn: async () => {
      const response = await LeadService.listByEmpresa({
        page: 1,
        limit: 500,
        search: normalizedSearch || undefined,
        id_campania: campaignFilterId,
        solo_sin_asignar: true,
        id_empresa: user?.companyId ?? undefined,
      });
      return response;
    },
  });

  const campaignOptions = useMemo(() => {
    const dataset = leadsQuery.data ?? [];
    const map = new Map<number, string>();
    let hasNoCampaign = false;
    dataset.forEach((lead) => {
      const campaignId = lead.campania?.id_campania;
      if (campaignId) {
        map.set(campaignId, lead.campania?.nombre ?? fallbackCampaignLabel);
      } else {
        hasNoCampaign = true;
      }
    });
    const options = Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, label]) => ({ value: String(id), label }));
    if (hasNoCampaign) {
      options.unshift({ value: 'none', label: t('crmKanban.filters.campaignNone') });
    }
    return options;
  }, [fallbackCampaignLabel, leadsQuery.data, t]);

  const statusesQuery = useQuery({
    queryKey: ['crm-lead-statuses'],
    queryFn: () => LeadService.getStatuses(),
  });
  const fallbackStatuses = useMemo(
    () => [
      { id: 1, id_estado_lead: 1, label: 'Pendiente' },
      { id: 2, id_estado_lead: 2, label: 'Asignado' },
      { id: 3, id_estado_lead: 3, label: 'Contactado' },
      { id: 4, id_estado_lead: 4, label: 'En gestion' },
      { id: 5, id_estado_lead: 5, label: 'Perdido' },
      { id: 6, id_estado_lead: 6, label: 'Ganado' },
      { id: 7, id_estado_lead: 7, label: 'Volver a llamar' },
      { id: 8, id_estado_lead: 8, label: 'Cita pendiente' },
      { id: 9, id_estado_lead: 9, label: 'Cita concretada' },
      { id: 10, id_estado_lead: 10, label: 'No contesta' },
      { id: 11, id_estado_lead: 11, label: 'Seguimiento' },
      { id: 12, id_estado_lead: 12, label: 'Otro producto' },
      { id: 13, id_estado_lead: 13, label: 'No desea' },
      { id: 14, id_estado_lead: 14, label: 'No califica' },
      { id: 15, id_estado_lead: 15, label: 'Otros (no catalogados)' },
    ],
    [],
  );
  const statusOptions = useMemo(() => {
    const extracted = extractStatusOptions(statusesQuery.data);
    return extracted.length ? extracted : fallbackStatuses;
  }, [fallbackStatuses, statusesQuery.data]);
  const statusCatalogById = useMemo(() => {
    const map = new Map<number, string>();
    statusOptions.forEach((status) => map.set(status.id, status.label));
    return map;
  }, [statusOptions]);
  const getStatusIdForColumn = useCallback(
    (columnLabel: string) => {
      const config = getColumnConfigFromValue(columnLabel);
      const candidates = [config.label, ...config.statusAliases];
      for (const candidate of candidates) {
        const normalizedCandidate = normalizeLabel(candidate);
        const fromOptions = statusOptions.find(
          (status) => normalizeLabel(status.label) === normalizedCandidate,
        );
        if (fromOptions) return fromOptions.id;
        const fallback = fallbackStatuses.find(
          (status) => normalizeLabel(status.label) === normalizedCandidate,
        );
        if (fallback) return fallback.id ?? fallback.id_estado_lead ?? null;
      }
      return null;
    },
    [fallbackStatuses, statusOptions],
  );
  const assignedStatusId = useMemo(
    () => getStatusIdForColumn(ASSIGNED_COLUMN_LABEL),
    [getStatusIdForColumn],
  );
  const pendingStatusId = useMemo(
    () => getStatusIdForColumn(PENDING_COLUMN_LABEL),
    [getStatusIdForColumn],
  );
  const statusSelectOptions = useMemo(
    () =>
      statusOptions.map((status) => ({
        value: String(status.id),
        label: status.label,
      })),
    [statusOptions],
  );
  const getColumnLabelFromStatusId = useCallback(
    (statusId?: number | null) => {
      if (!statusId) return PENDING_COLUMN_LABEL;
      const label = statusCatalogById.get(statusId);
      if (!label) return PENDING_COLUMN_LABEL;
      return getColumnConfigFromValue(label).label;
    },
    [statusCatalogById],
  );
  const columns = COLUMN_LABELS;
  const defaultColumnLabel = PENDING_COLUMN_LABEL;
  const getLeadStatusLabel = useCallback(
    (lead: Lead) => {
      const directLabel = lead.estado?.nombre;
      if (directLabel && directLabel.trim()) return directLabel;
      if (typeof lead.id_estado_lead === 'number') {
        const fromCatalog = statusCatalogById.get(lead.id_estado_lead);
        if (fromCatalog && fromCatalog.trim()) return fromCatalog;
      }
      return PENDING_COLUMN_LABEL;
    },
    [statusCatalogById],
  );
  const handleCallLead = (phone?: string | null) => {
    if (!phone) {
      push({
        title: t('crmKanban.messages.noPhoneTitle'),
        description: t('crmKanban.messages.noPhoneDescription'),
        variant: 'warning',
      });
      return;
    }
    window.open(`tel:${phone}`);
  };

  const handleWhatsappLead = (lead: Lead) => {
    const phone = lead.telefono?.replace(/\D/g, '');
    if (!phone) {
      push({
        title: t('crmKanban.messages.noPhoneTitle'),
        description: t('crmKanban.messages.noWhatsappDescription'),
        variant: 'warning',
      });
      return;
    }
    const message = encodeURIComponent(
      t('crmKanban.messages.whatsappTemplate', { name: lead.nombres ?? fallbackLeadName }),
    );
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${message}`, '_blank');
  };

  const openNotesDialog = (lead: Lead) => {
    setNotesDialog({ lead, value: lead.descripcion ?? '' });
    setNotesDialogOpen(true);
  };

  const closeNotesDialog = () => {
    setNotesDialogOpen(false);
    setNotesDialog({ lead: null, value: '' });
  };

  const openHistoryDialog = (lead: Lead) => {
    setHistoryDialogLead(lead);
    setHistoryDialogOpen(true);
  };

  const closeHistoryDialog = () => {
    setHistoryDialogOpen(false);
    setHistoryDialogLead(null);
  };

  const handleNotesSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!notesDialog.lead) return;
    notesMutation.mutate({
      leadId: notesDialog.lead.id_lead,
      descripcion: notesDialog.value,
    });
  };

  const leads = leadsQuery.data ?? [];
  const unassignedLeadPool = shouldShowPendingUnassigned
    ? unwrapLeadCollection<Lead>(unassignedLeadsQuery.data ?? [])
    : [];

  const vendorFilterOptions = useMemo(() => {
    const map = new Map<number, { value: string; label: string }>();
    leads.forEach((lead) => {
      lead.asignaciones?.forEach((assignment) => {
        const id = assignment.id_asignado_usuario_empresa ?? assignment.asignado?.id_usuario_empresa;
        if (!id) return;
        if (!map.has(id)) {
          const label = `${assignment.asignado?.nombres ?? ''} ${assignment.asignado?.apellidos ?? ''}`.trim() ||
            assignment.asignado?.email ||
            t('crmKanban.defaults.leadName');
          map.set(id, { value: String(id), label });
        }
      });
    });
    return [{ value: 'all', label: t('crmKanban.filters.vendorAll') }, ...Array.from(map.values())];
  }, [leads, t]);
  const vendorsQuery = useQuery({
    queryKey: ['crm-kanban-vendors', user?.companyId],
    queryFn: () => UserService.getUsuariosEmpresa({ id_empresa: user?.companyId }),
    enabled: isManagementVariant && Boolean(user?.companyId),
    staleTime: 5 * 60 * 1000,
  });
  const vendorAssignmentOptions = useMemo(() => {
    if (!isManagementVariant) return [];
    const dataset = (() => {
      const payload = vendorsQuery.data as any;
      if (Array.isArray(payload)) return payload;
      if (payload && Array.isArray(payload?.data)) return payload.data;
      return [];
    })();
    return dataset
      .filter((user: any) => {
        const role = String(user?.rol?.nombre ?? '').toLowerCase();
        return role.includes('vend');
      })
      .map((user: any) => {
        const id = Number(user?.id_usuario_empresa ?? user?.id ?? 0);
        const label =
          `${user?.nombres ?? ''} ${user?.apellidos ?? ''}`.trim() || user?.email || t('crmKanban.filters.vendor');
        return { value: String(id), label };
      })
      .filter((option) => Number(option.value));
  }, [isManagementVariant, t, vendorsQuery.data]);

  const matchesCampaignFilter = useCallback(
    (lead: Lead) => {
      if (filters.campaignId === 'none') {
        return !lead.campania;
      }
      if (filters.campaignId !== 'all' && Number(filters.campaignId) !== lead.id_campania) {
        return false;
      }
      return true;
    },
    [filters.campaignId],
  );

  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => matchesCampaignFilter(lead))
      .filter((lead) => {
        if (filters.vendorId === 'all') return true;
        const ownerId = getLeadOwnerId(lead);
        return ownerId === Number(filters.vendorId);
      })
      .sort((a, b) => {
        const dateA = new Date(a.fecha_creacion ?? 0).getTime();
        const dateB = new Date(b.fecha_creacion ?? 0).getTime();
        return dateB - dateA;
      });
  }, [filters.vendorId, leads, matchesCampaignFilter]);

  const pendingUnassignedLeads = useMemo(() => {
    if (!shouldShowPendingUnassigned) return [];
    return unassignedLeadPool
      .filter((lead) => matchesCampaignFilter(lead))
      .filter((lead) => !hasActiveAssignment(lead))
      .filter((lead) => {
        if (pendingStatusId && typeof lead.id_estado_lead === 'number') {
          return lead.id_estado_lead === pendingStatusId;
        }
        const label = getLeadStatusLabel(lead);
        return normalizeLabel(label) === PENDING_COLUMN_KEY;
      })
      .sort((a, b) => {
        const dateA = new Date(a.fecha_creacion ?? 0).getTime();
        const dateB = new Date(b.fecha_creacion ?? 0).getTime();
        return dateB - dateA;
      });
  }, [
    getLeadStatusLabel,
    matchesCampaignFilter,
    pendingStatusId,
    shouldShowPendingUnassigned,
    unassignedLeadPool,
  ]);

  const allKanbanLeads = useMemo(() => {
    const map = new Map<number, Lead>();
    filteredLeads.forEach((lead) => map.set(lead.id_lead, lead));
    pendingUnassignedLeads.forEach((lead) => map.set(lead.id_lead, lead));
    return Array.from(map.values());
  }, [filteredLeads, pendingUnassignedLeads]);

  const leadLookup = useMemo(() => {
    const map = new Map<number, Lead>();
    allKanbanLeads.forEach((lead) => map.set(lead.id_lead, lead));
    return map;
  }, [allKanbanLeads]);
  const invalidateRelatedQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['crm-kanban'] });
    queryClient.invalidateQueries({ queryKey: ['crm-admin-leads'] });
    queryClient.invalidateQueries({ queryKey: ['crm-vendor-leads-table'] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ leadId, estadoId }: { leadId: number; estadoId: number }) => {
      if (!currentUserId) throw new Error('NO_USER_CONTEXT');
      return LeadService.updateStatus({
        leadId,
        id_estado_lead: estadoId,
        usuarioEmpresaId: currentUserId,
      });
    },
    onSuccess: () => {
      invalidateRelatedQueries();
    },
    onError: () => {
      push({
        title: t('crmKanban.messages.statusUnknown'),
        description: t('crmKanban.messages.statusUnknown'),
        variant: 'danger',
      });
    },
  });

  const applyColumnChange = useCallback(
    (leadId: number, columnLabel: string) => {
      const draggedLead = leadLookup.get(leadId);
      if (!draggedLead) return;
      const fallbackLabel =
        boardOverrides[leadId] ?? getColumnConfigFromValue(getLeadStatusLabel(draggedLead)).label;
      const normalizedTarget = getColumnConfigFromValue(columnLabel).key;
      const normalizedCurrent = getColumnConfigFromValue(fallbackLabel).key;
      if (normalizedCurrent === normalizedTarget) {
        return;
      }
      const statusId = getStatusIdForColumn(columnLabel);
      if (!statusId) {
        push({
          title: t('crmKanban.messages.statusUnknown'),
          description: t('crmKanban.messages.statusUnknown'),
          variant: 'danger',
        });
        return;
      }
      setBoardOverrides((prev) => ({ ...prev, [leadId]: columnLabel }));
      statusMutation.mutate(
        { leadId, estadoId: statusId },
        {
          onError: () => {
            setBoardOverrides((prev) => {
              const next = { ...prev };
              const fallbackColumn = getColumnConfigFromValue(draggedLead.estado?.nombre).label;
              next[leadId] = fallbackColumn;
              return next;
            });
          },
        },
      );
    },
    [
      boardOverrides,
      getColumnConfigFromValue,
      getLeadStatusLabel,
      getStatusIdForColumn,
      leadLookup,
      push,
      statusMutation,
      t,
    ],
  );

  useEffect(() => {
    setBoardOverrides((prev) => {
      if (!Object.keys(prev).length) return prev;
      if (!allKanbanLeads.length) {
        return Object.keys(prev).length ? {} : prev;
      }
      const byId = new Map<number, Lead>();
      allKanbanLeads.forEach((lead) => byId.set(lead.id_lead, lead));
      const allowedColumns = new Set(COLUMN_CONFIGS.map((column) => column.key));
      let changed = false;
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const id = Number(key);
        const normalizedValue = getColumnConfigFromValue(value).key;
        if (!allowedColumns.has(normalizedValue)) {
          changed = true;
          return;
        }
        const lead = byId.get(id);
        if (!lead) {
          changed = true;
          return;
        }
        const currentColumnKey = getColumnConfigFromValue(lead.estado?.nombre).key;
        if (currentColumnKey === normalizedValue) {
          changed = true;
          return;
        }
        next[id] = value;
      });
      return changed ? next : prev;
    });
  }, [allKanbanLeads]);

  const groupedByColumn = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    columns.forEach((column) => {
      grouped[column] = [];
    });
    filteredLeads.forEach((lead) => {
      const overrideLabel = boardOverrides[lead.id_lead];
      const baseLabel = getLeadStatusLabel(lead);
      const targetConfig = getColumnConfigFromValue(overrideLabel ?? baseLabel);
      const label = COLUMN_KEY_TO_LABEL.get(targetConfig.key) ?? defaultColumnLabel;
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push(lead);
    });
    return grouped;
  }, [boardOverrides, columns, filteredLeads, defaultColumnLabel, getLeadStatusLabel]);

  const assignVendorMutation = useMutation({
    mutationFn: async ({ leadId, vendorId }: { leadId: number; vendorId: number }) => {
      if (!currentUserId) throw new Error('NO_USER_CONTEXT');
      if (!assignedStatusId) throw new Error('ASSIGNED_STATUS_UNAVAILABLE');
      await LeadService.assignLead({
        leadId,
        usuarioEmpresaId: currentUserId,
        asignarAUsuarioEmpresaId: vendorId,
      });
      await LeadService.updateStatus({
        leadId,
        id_estado_lead: assignedStatusId,
        usuarioEmpresaId: currentUserId,
      });
      return { leadId };
    },
    onMutate: ({ leadId }) => {
      setAssigningLeadId(leadId);
    },
    onSuccess: (_data, variables) => {
      if (variables?.leadId) {
        setBoardOverrides((prev) => ({ ...prev, [variables.leadId]: ASSIGNED_COLUMN_LABEL }));
      }
      push({
        title: t('crmKanban.messages.assignedTitle'),
        description: t('crmKanban.messages.assignedDescription'),
      });
      invalidateRelatedQueries();
    },
    onError: () => {
      push({
        title: t('crmKanban.messages.assignedErrorTitle'),
        description: t('crmKanban.messages.assignedErrorDescription'),
        variant: 'danger',
      });
    },
    onSettled: () => {
      setAssigningLeadId(null);
    },
  });

  const notesMutation = useMutation({
    mutationFn: ({ leadId, descripcion }: { leadId: number; descripcion: string }) =>
      LeadService.update(leadId, { descripcion }),
    onSuccess: () => {
      push({ title: t('crmKanban.messages.notesSavedTitle'), description: t('crmKanban.messages.notesSavedDescription') });
      invalidateRelatedQueries();
      closeNotesDialog();
    },
    onError: () => {
      push({
        title: t('crmKanban.messages.notesErrorTitle'),
        description: t('crmKanban.messages.notesErrorDescription'),
        variant: 'danger',
      });
    },
  });

  const handleVendorAssignment = (lead: Lead, value: string) => {
    if (!lead?.id_lead) return;
    const vendorId = Number(value);
    if (!Number.isFinite(vendorId) || vendorId <= 0) return;
    assignVendorMutation.mutate({ leadId: lead.id_lead, vendorId });
  };

  const handleStatusSelection = (lead: Lead, rawValue: string) => {
    if (!lead?.id_lead) return;
    const statusId = Number(rawValue);
    if (!Number.isFinite(statusId)) return;
    const currentStatusId =
      boardOverrides[lead.id_lead] && getStatusIdForColumn(boardOverrides[lead.id_lead])
        ? getStatusIdForColumn(boardOverrides[lead.id_lead])
        : lead.estado?.id_estado_lead;
    if (currentStatusId === statusId) return;
    const targetLabel = getColumnLabelFromStatusId(statusId);
    setBoardOverrides((prev) => ({ ...prev, [lead.id_lead]: targetLabel }));
    statusMutation.mutate(
      { leadId: lead.id_lead, estadoId: statusId },
      {
        onError: () => {
          setBoardOverrides((prev) => {
            const next = { ...prev };
            const fallbackLabel = getColumnConfigFromValue(lead.estado?.nombre).label;
            next[lead.id_lead] = fallbackLabel;
            return next;
          });
        },
      },
    );
  };

  const handleCardEdit = (lead: Lead) => {
    setDrawerLead(lead);
    setDrawerOpen(true);
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, leadId: number) => {
    event.dataTransfer.setData('lead-id', String(leadId));
    event.dataTransfer.effectAllowed = 'move';
    setDraggingCard(true);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, columnLabel: string) => {
    event.preventDefault();
    setHoveredColumn(null);
    const leadId = Number(event.dataTransfer.getData('lead-id'));
    if (!Number.isFinite(leadId)) return;
    applyColumnChange(leadId, columnLabel);
    setDraggingCard(false);
    disableTouchDragForLead(leadId);
  };

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!ENABLE_TOUCH_DRAG) return;
      if (touchDraggingLeadId === null) return;
      if (!event.touches.length) return;
      event.preventDefault();
      const touch = event.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const columnElement = target?.closest('[data-column-key]');
      if (columnElement instanceof HTMLElement) {
        const columnKey = columnElement.getAttribute('data-column-key');
        if (columnKey) {
          setHoveredColumn(columnKey);
        }
      }
    },
    [touchDraggingLeadId],
  );

  useEffect(() => {
    if (!ENABLE_TOUCH_DRAG) return;
    if (touchDraggingLeadId === null) return;
    const handler = (event: TouchEvent) => handleTouchMove(event);
    document.addEventListener('touchmove', handler, { passive: false });
    return () => {
      document.removeEventListener('touchmove', handler);
    };
  }, [handleTouchMove, touchDraggingLeadId]);

  const finalizeTouchDrop = useCallback(
    (event?: ReactTouchEvent<HTMLDivElement>) => {
      const leadId = touchDraggingLeadId;
      if (leadId === null) {
        cancelTouchTimer();
        return;
      }
      cancelTouchTimer();
      let columnLabel = hoveredColumn;
      if (event && event.changedTouches.length) {
        const touch = event.changedTouches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const columnElement = target?.closest('[data-column-key]');
        if (columnElement instanceof HTMLElement) {
          columnLabel = columnElement.getAttribute('data-column-key') ?? columnLabel;
        }
      }
      if (columnLabel) {
        applyColumnChange(leadId, columnLabel);
      }
      clearTouchDragState(leadId);
    },
    [applyColumnChange, cancelTouchTimer, clearTouchDragState, hoveredColumn, touchDraggingLeadId],
  );

  const handleTouchHoldEnd = useCallback(
    (leadId: number, event?: ReactTouchEvent<HTMLDivElement>) => {
      if (!ENABLE_TOUCH_DRAG) return;
      cancelTouchTimer();
      if (touchDraggingLeadId === leadId) {
        finalizeTouchDrop(event);
      } else {
        disableTouchDragForLead(leadId);
      }
    },
    [disableTouchDragForLead, finalizeTouchDrop, touchDraggingLeadId],
  );

  const handleCardDragEnd = (leadId?: number) => {
    setDraggingCard(false);
    setHoveredColumn(null);
    if (typeof leadId === 'number') {
      disableTouchDragForLead(leadId);
    }
  };

  const filtersPanel = (
    <FilterPanel className="bg-surface/75">
      <FilterField>
        <Select
          label={t('crmKanban.filters.campaign')}
          value={filters.campaignId === 'all' ? 'all' : String(filters.campaignId)}
          onChange={(event) => {
            const value = event.target.value;
            setFilters((prev) => ({
              ...prev,
              campaignId:
                value === 'all'
                  ? 'all'
                  : value === 'none'
                    ? 'none'
                    : (Number(value) as FiltersState['campaignId']),
            }));
          }}
          options={[{ label: t('crmKanban.filters.campaignAll'), value: 'all' }, ...campaignOptions]}
          className="w-full"
        />
      </FilterField>
      {isManagementVariant && (
        <FilterField>
          <Select
            label={t('crmKanban.filters.vendor')}
            value={filters.vendorId === 'all' ? 'all' : String(filters.vendorId)}
            onChange={(event) => {
              const value = event.target.value;
              setFilters((prev) => ({
                ...prev,
                vendorId: value === 'all' ? 'all' : Number(value),
              }));
            }}
            options={vendorFilterOptions}
            className="w-full"
          />
        </FilterField>
      )}
      <FilterField>
        <MultiSelect
          label={t('crmKanban.filters.detail')}
          placeholder={t('crmKanban.filters.detailPlaceholder')}
          values={kanbanDetails}
          options={detailSelectOptions}
          onChange={(selection) => {
            const sanitized = selection.filter((value): value is DetailField =>
              availableDetailValues.includes(value as DetailField),
            );
            if (sanitized.length) {
              setKanbanDetails(sanitized);
              return;
            }
            const fallbackField = availableDetailValues.includes(DEFAULT_DETAIL_FIELD)
              ? DEFAULT_DETAIL_FIELD
              : availableDetailValues[0];
            setKanbanDetails(fallbackField ? [fallbackField] : []);
          }}
        />
      </FilterField>
    </FilterPanel>
  );

  return (
    <>
      <div className="space-y-6">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-content">{t('crmKanban.title')}</h1>
              <span className="rounded-full border border-border-subtle px-3 py-1 text-xs font-medium text-content-muted">
                {t('crmKanban.header.total', { count: leads.length })}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
              <div className="w-full flex-1">
                <Input
                  aria-label={searchAriaLabel}
                  placeholder={searchPlaceholder}
                  value={filters.search}
                  onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                  autoComplete="off"
                  trailingElement={
                    hasSearchValue ? (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        aria-label={clearSearchLabel}
                        className="rounded-full bg-surface-muted/80 p-1 text-content-muted transition hover:text-red-500"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    ) : null
                  }
                  trailingInteractive={hasSearchValue}
                  className="w-full"
                />
              </div>
              <FilterToggleButton
                label={filtersLabel}
                expanded={filtersVisible}
                isMobile={isMobile}
                className="flex-shrink-0 sm:w-auto"
                onToggle={() => {
                  if (isMobile) {
                    setIsMobileFiltersOpen(true);
                  } else {
                    setFiltersVisible((prev) => !prev);
                  }
                }}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-10 p-0"
                onClick={() => leadsQuery.refetch()}
                aria-label={t('crmKanban.actions.refresh')}
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

      {!isMobile && filtersVisible ? filtersPanel : null}

      {leadsQuery.isLoading ? (
        <p className="text-sm text-content-muted">{t('crmKanban.messages.loading')}</p>
      ) : (
        <div className="overflow-x-auto pb-3">
          <div className="flex gap-4 pr-4">
            {columns.map((column) => {
              const columnConfig = getColumnConfigFromValue(column);
              const isPendingColumn = columnConfig.key === PENDING_COLUMN_KEY;
              const baseLeads = groupedByColumn[column] ?? [];
              const leadsForColumn = isPendingColumn
                ? shouldShowPendingUnassigned
                  ? pendingUnassignedLeads
                  : baseLeads
                : baseLeads;
              const palette = getKanbanPalette(column);
              const columnWidth = leadsForColumn.length ? '7.5cm' : '3.75cm';
              const isDropTarget = isDraggingCard && hoveredColumn === column;
              return (
                <div
                  key={column}
                  data-column-key={column}
                  className={`flex h-[480px] flex-col rounded-2xl border bg-surface transition-shadow ${
                    isDropTarget ? 'ring-2 ring-primary-400' : ''
                  }`}
                  style={{ width: columnWidth, minWidth: columnWidth, borderColor: palette.border }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (isDraggingCard) setHoveredColumn(column);
                  }}
                  onDragLeave={(event) => {
                    const related = event.relatedTarget as Node | null;
                    if (!related || !event.currentTarget.contains(related)) {
                      setHoveredColumn((current) => (current === column ? null : current));
                    }
                  }}
                  onDrop={(event) => handleDrop(event, column)}
                >
                  <div
                    className="flex items-center justify-between gap-2 rounded-t-2xl border-b px-3 py-2 font-bold"
                    style={{
                      backgroundColor: palette.headerBg,
                      color: palette.headerText,
                      borderColor: palette.border,
                      boxShadow: isDropTarget ? `inset 0 4px 0 ${palette.accent}` : undefined,
                    }}
                  >
                    <h2 className="text-xs font-bold uppercase tracking-wider md:text-sm">{column}</h2>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ backgroundColor: palette.pillBg, color: palette.pillText }}
                    >
                      {leadsForColumn.length}
                    </span>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto px-2 py-3">
                    {leadsForColumn.map((lead) => {
                      const fullName =
                        `${lead.nombres ?? ''} ${lead.apellidos ?? ''}`.trim() ||
                        lead.email ||
                        fallbackLeadName;
                      const detailEntries = kanbanDetails.map((detailKey) => ({
                        key: detailKey,
                        label: detailLabelMap[detailKey] ?? detailKey,
                        value: resolveDetailValue(lead, detailKey, fallbackDetailLabels),
                      }));
                      const overrideLabel = boardOverrides[lead.id_lead];
                      const columnConfigForLead = overrideLabel
                        ? getColumnConfigFromValue(overrideLabel)
                        : getColumnConfigFromValue(getLeadStatusLabel(lead));
                      const currentColumnLabel = columnConfigForLead.label;
                      const isPendingCard = columnConfigForLead.key === PENDING_COLUMN_KEY;
                      const isTouchDraggable = !isTouchMode || touchDraggableIds.has(lead.id_lead);
                      const leadVendorId = getLeadOwnerId(lead);
                      const vendorValue = leadVendorId ? String(leadVendorId) : '';
                      const isAssigningThisLead =
                        assigningLeadId === lead.id_lead && assignVendorMutation.isPending;
                      const overrideStatusId = overrideLabel ? getStatusIdForColumn(overrideLabel) : null;
                      const defaultStatusOption = statusSelectOptions.length
                        ? Number(statusSelectOptions[0].value)
                        : null;
                      const fallbackStatusId =
                        typeof defaultStatusOption === 'number' && Number.isFinite(defaultStatusOption)
                          ? defaultStatusOption
                          : null;
                      const statusSelectValue =
                        overrideStatusId ??
                        (typeof lead.estado?.id_estado_lead === 'number' ? lead.estado.id_estado_lead : null) ??
                        (typeof pendingStatusId === 'number' ? pendingStatusId : null) ??
                        fallbackStatusId;
                      const hasVendorAssigned = Boolean(leadVendorId);
                      const optionsForLead =
                        hasVendorAssigned && pendingStatusId
                          ? statusSelectOptions.filter((option) => option.value !== String(pendingStatusId))
                          : statusSelectOptions;
                      const fallbackStatusValue = optionsForLead[0]?.value ?? '';
                      const normalizedStatusValue =
                        statusSelectValue !== null && statusSelectValue !== undefined
                          ? String(statusSelectValue)
                          : fallbackStatusValue;
                      const statusValueFinal = optionsForLead.some((option) => option.value === normalizedStatusValue)
                        ? normalizedStatusValue
                        : fallbackStatusValue;
                      return (
                        <div
                          key={lead.id_lead}
                          draggable={isTouchDraggable}
                          onDragStart={(event) => handleDragStart(event, lead.id_lead)}
                          onDragEnd={() => handleCardDragEnd(lead.id_lead)}
                          onTouchStart={() => ENABLE_TOUCH_DRAG && handleTouchHoldStart(lead.id_lead)}
                          onTouchEnd={(event) => ENABLE_TOUCH_DRAG && handleTouchHoldEnd(lead.id_lead, event)}
                          onTouchCancel={(event) => ENABLE_TOUCH_DRAG && handleTouchHoldEnd(lead.id_lead, event)}
                          className="w-full cursor-grab rounded-md border bg-surface px-3 py-2 text-xs shadow-sm transition hover:shadow-md active:cursor-grabbing"
                          style={{
                            borderColor: palette.border,
                            borderLeftColor: palette.accent,
                            borderLeftWidth: '6px',
                            borderLeftStyle: 'solid',
                            touchAction:
                              touchDraggingLeadId === lead.id_lead ? 'none' : undefined,
                          }}
                        >
                          <div className="mb-2 rounded-2xl bg-surface-muted/60 px-3 py-2 dark:bg-surface/40">
                            <div className="flex items-start justify-between gap-2">
                              <p className="flex min-w-0 items-center gap-2 text-lg font-semibold text-content">
                                <UserRound className="h-5 w-5 text-content-muted" />
                                <span className="truncate">{fullName}</span>
                              </p>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-content-muted hover:text-content"
                                onClick={() => handleCardEdit(lead)}
                                aria-label={t('crmKanban.actions.editLead')}
                              >
                                <Pencil className="h-5 w-5" />
                              </Button>
                            </div>
                            {detailEntries.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {detailEntries.map((entry) => (
                                  <Badge
                                    key={`${lead.id_lead}-${entry.key}`}
                                    variant="secondary"
                                    className="rounded-full border border-border-subtle bg-surface px-2.5 py-0.5 text-[11px] font-medium normal-case text-content"
                                  >
                                    {entry.value}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          {!isPendingCard && (
                            <div className="mb-3 flex gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                className="flex-1 justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-900/30 dark:text-blue-300"
                                onClick={() => handleCallLead(lead.telefono)}
                              >
                                <PhoneFilledIcon className="h-5 w-5" />
                                {t('crmKanban.actions.call')}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="flex-1 justify-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/25 dark:text-emerald-300"
                                onClick={() => handleWhatsappLead(lead)}
                              >
                                <WhatsappIcon className="h-5 w-5" />
                                {t('crmKanban.actions.whatsapp')}
                              </Button>
                            </div>
                          )}
                          {isManagementVariant && isPendingCard ? (
                            <Select
                              aria-label={t('crmKanban.actions.assignVendorLabel')}
                              value={vendorValue}
                              onChange={(event) => handleVendorAssignment(lead, event.target.value)}
                              disabled={!vendorAssignmentOptions.length || isAssigningThisLead}
                              options={[
                                { value: '', label: t('crmKanban.actions.assignVendorPlaceholder') },
                                ...vendorAssignmentOptions,
                              ]}
                            />
                          ) : (
                            <Select
                              value={statusValueFinal}
                              onChange={(event) => handleStatusSelection(lead, event.target.value)}
                              options={optionsForLead}
                            />
                          )}
                          <div className="mt-2 flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="flex-1 text-xs"
                              onClick={() => openNotesDialog(lead)}
                              leftIcon={<FileText className="h-3.5 w-3.5" />}
                            >
                              {t('crmKanban.actions.notes')}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="flex-1 text-xs"
                              onClick={() => openHistoryDialog(lead)}
                              leftIcon={<HistoryIcon className="h-3.5 w-3.5" />}
                            >
                              {t('crmKanban.actions.history')}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {!leadsForColumn.length && (
                      <div className="rounded-md border border-dashed border-border-subtle p-3 text-[11px] text-content-subtle">
                        {t('crmKanban.messages.columnEmpty')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {!columns.length && <p className="text-sm text-content-muted">{t('crmKanban.messages.empty')}</p>}
        </div>
      )}
      </div>
      {isMobile && (
        <MobileFiltersModal
          open={isMobileFiltersOpen}
          onOpenChange={setIsMobileFiltersOpen}
        >
          {filtersPanel}
        </MobileFiltersModal>
      )}
      <LeadEditorDrawer
        open={isDrawerOpen}
        lead={drawerLead}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerLead(null);
        }}
        variant={isVendorVariant ? 'vendor' : isSupervisorVariant ? 'supervisor' : 'admin'}
        onUpdated={() => invalidateRelatedQueries()}
      />
      <Dialog
        open={isNotesDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeNotesDialog();
          }
        }}
        title={t('crmKanban.notesDialog.title')}
        description={t('crmKanban.notesDialog.description')}
        size="lg"
      >
        <form onSubmit={handleNotesSubmit} className="space-y-4">
          <TextArea
            minRows={4}
            value={notesDialog.value}
            onChange={(event) => setNotesDialog((prev) => ({ ...prev, value: event.target.value }))}
            className="min-h-[200px] resize-y"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeNotesDialog}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={notesMutation.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={isHistoryDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeHistoryDialog();
          }
        }}
        title={t('crmKanban.historyDialog.title')}
        description={historyDialogLead?.nombres ?? ''}
      >
        <p className="text-sm text-content-muted">{t('crmKanban.historyDialog.body')}</p>
      </Dialog>
    </>
  );
};

export default LeadsKanban;

const getLeadOwnerId = (lead: Lead) => {
  const assignments = lead?.asignaciones ?? [];
  const active = assignments.find((assignment) => assignment?.estado === 1) ?? assignments[0];
  return (
    active?.id_asignado_usuario_empresa ??
    active?.asignado?.id_usuario_empresa ??
    lead?.id_usuario_empresa ??
    null
  );
};

const WhatsappIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-hidden="true"
    className={className}
    fill="currentColor"
  >
    <path d="M17.472 14.382c-.297-.148-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.149-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.003c-1.746 0-3.458-.467-4.975-1.352l-.356-.211-3.701.974.988-3.604-.231-.37c-.969-1.55-1.48-3.337-1.479-5.164 0-5.34 4.354-9.693 9.694-9.693 2.59 0 5.026 1.01 6.854 2.838 1.828 1.828 2.834 4.266 2.833 6.854-.003 5.34-4.356 9.693-9.724 9.693" />
  </svg>
);

const PhoneFilledIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-hidden="true"
    className={className}
    fill="currentColor"
  >
    <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.25 11.72 11.72 0 003.67.59 1 1 0 011 1V20a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1h3.5a1 1 0 011 1 11.72 11.72 0 00.59 3.67 1 1 0 01-.25 1.01z" />
  </svg>
);

const getLeadOwnerName = (lead: Lead) => {
  const assignments = lead?.asignaciones ?? [];
  const active = assignments.find((assignment) => assignment?.estado === 1) ?? assignments[0];
  if (!active) return null;
  const firstName = active.asignado?.nombres ?? '';
  const lastName = active.asignado?.apellidos ?? '';
  const full = `${firstName} ${lastName}`.trim();
  return full || active.asignado?.email || null;
};
