import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpDown, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Loader2, XCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LeadService, unwrapLeadCollection } from '@/services/lead.service';
import type {
  Lead,
  LeadDraft,
  LeadImportPreview,
  LeadImportJob,
  LeadImportJobStatus,
  LeadAssignmentHistoryEntry,
  LeadCampaignSummary,
} from '@/services/lead.service';
import { CampaignService } from '@/services/campaign.service';
import type { Campaign } from '@/services/campaign.service';
import { UserService } from '@/services/user.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { TextArea } from '@/components/ui/TextArea';
import { Switch } from '@/components/ui/Switch';
import { Alert } from '@/components/common/Alert';
import LeadBulkActionsBar from '@/components/crm/LeadBulkActionsBar';
import type { BulkStatusOption, BulkVendorOption, LeadBulkAction } from '@/components/crm/LeadBulkActionsBar';
import { getStatusBadgeVariant, normalizeStatusLabel } from '@/utils/badges';
import { formatDate } from '@/utils/helpers';
import { cn } from '@/utils/cn';
import { useToast } from '@/components/common/Toasts';
import { mapBackendRole, Role } from '@/utils/constants';
import { useAuth } from '@/store/auth';
import { LeadDetailDrawer } from '@/components/common/LeadDetailDrawer';
import { Accordion } from '@/components/common/Accordion';
import { Pagination } from '@/components/ui/Pagination';
import { t } from '@/i18n';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { MobileFiltersModal } from '@/components/common/MobileFiltersModal';
import { FilterPanel, FilterField } from '@/components/common/FilterPanel';
import { FilterToggleButton } from '@/components/common/FilterToggleButton';

type FiltersState = {
  search: string;
  statusId: number | 'all';
  onlyUnassigned: boolean;
  origin: string;
  campaignId: string;
  vendorId: string;
  city: string;
};

const DEFAULT_FILTERS: FiltersState = {
  search: '',
  statusId: 'all',
  onlyUnassigned: false,
  origin: 'all',
  campaignId: 'all',
  vendorId: 'all',
  city: 'all',
};

const FALLBACK_STATUSES: BulkStatusOption[] = [
  { id: 1, label: 'Pendiente' },
  { id: 2, label: 'Asignado' },
  { id: 3, label: 'Contactado' },
  { id: 4, label: 'En gestion' },
  { id: 5, label: 'Perdido' },
  { id: 6, label: 'Ganado' },
  { id: 7, label: 'Volver a llamar' },
  { id: 8, label: 'Cita pendiente' },
  { id: 9, label: 'Cita concretada' },
  { id: 10, label: 'No contesta' },
  { id: 11, label: 'Seguimiento' },
  { id: 12, label: 'Otro producto' },
  { id: 13, label: 'No desea' },
  { id: 14, label: 'No califica' },
  { id: 15, label: 'Otros (no catalogados)' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;

type SortField = 'lead' | 'campania' | 'estado' | 'asignado' | 'origen' | 'creado' | 'unassigned';
type SortConfig = {
  field: SortField;
  direction: 'asc' | 'desc';
};

type LeadContactFormState = {
  nombres: string;
  apellidos: string;
  telefono: string;
  email: string;
  dni: string;
  ocupacion: string;
  ciudad: string;
  descripcion: string;
};

type LeadOperationState = {
  vendorId: string;
  statusId: string;
  active: boolean;
};

type TimelineItem = {
  id: string;
  dateLabel: string;
  message: string;
};

type LeadsAdminVariant = 'admin' | 'supervisor' | 'vendor';

type LeadsAdminProps = {
  variant?: LeadsAdminVariant;
  showOriginFilter?: boolean;
  showOriginColumn?: boolean;
  title?: string;
  subtitle?: string;
};

const getApiErrorMessage = (error: unknown) => {
  if (error && typeof error === 'object') {
    const maybeResponse = (error as { response?: { data?: unknown } }).response;
    const data = maybeResponse?.data as { message?: unknown };
    if (typeof data?.message === 'string' && data.message.trim()) {
      return data.message;
    }
    if (Array.isArray(data?.message)) {
      return data.message.join(', ');
    }
    const fallback = (error as { message?: string }).message;
    if (typeof fallback === 'string' && fallback.trim()) {
      return fallback;
    }
  }
  return t('crmLeads.errors.unexpected');
};
const REQUIRED_IMPORT_FIELDS: Array<{
  key: string;
  label: string;
  required: boolean;
  optionalLabel?: string;
}> = [
  { key: 'dni', label: 'DNI', required: false},
  { key: 'nombres', label: 'Nombres', required: true },
  { key: 'apellidos', label: 'Apellidos', required: false},
  { key: 'telefono', label: 'Telefono', required: true },
  { key: 'email', label: 'Email', required: false},
  { key: 'ciudad', label: 'Ciudad', required: false},
  { key: 'ocupacion', label: 'Ocupacion', required: false},
  { key: 'descripcion', label: 'Descripcion', required: false},
];


const getInitials = (value?: string | null) => {
  if (!value) return 'UX';
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return value.charAt(0).toUpperCase();
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
};

const buildVendorLabel = (nombres?: string | null, apellidos?: string | null, email?: string | null) => {
  const fullName = `${nombres ?? ''} ${apellidos ?? ''}`.trim();
  const initials = getInitials(fullName || email || '');
  if (!fullName) return `${initials}${email ? ` · ${email}` : ''}`;
  return `${initials} · ${fullName}`;
};

const computeUnassignedDuration = (createdAt?: string, assignedAt?: string | null) => {
  if (!createdAt) return '-';
  const created = new Date(createdAt);
  const target = assignedAt ? new Date(assignedAt) : new Date();
  const diffMs = Math.max(target.getTime() - created.getTime(), 0);
  const totalMinutes = Math.round(diffMs / (1000 * 60));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const totalHours = Math.round(diffMs / (1000 * 60 * 60));
  if (totalHours < 24) return `${totalHours}h`;
  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
};

const getActiveAssignmentEntity = (lead?: Lead | null) => {
  if (!lead?.asignaciones?.length) return null;
  return lead.asignaciones.find((assignment) => assignment.estado === 1) ?? lead.asignaciones[0];
};

const getLeadOwnerId = (lead: Lead) => {
  const assignment = lead.asignaciones?.find((item) => item?.estado === 1);
  return assignment?.id_asignado_usuario_empresa ?? assignment?.asignado?.id_usuario_empresa ?? null;
};

const normalizeStatusValue = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const buildCampaignSummaryFromLeads = (dataset: Lead[]): LeadCampaignSummary[] => {
  const map = new Map<number, LeadCampaignSummary>();
  dataset.forEach((lead) => {
    const id = lead.campania?.id_campania;
    if (!id) return;
    if (!map.has(id)) {
      map.set(id, {
        id_campania: id,
        nombre: lead.campania?.nombre ?? 'Campana',
        totalReferidos: 0,
      });
    }
    const current = map.get(id);
    if (current) current.totalReferidos += 1;
  });
  return Array.from(map.values());
};

const buildContactSnapshot = (lead?: Lead | null): LeadContactFormState => ({
  nombres: lead?.nombres ?? '',
  apellidos: lead?.apellidos ?? '',
  telefono: lead?.telefono ?? '',
  email: lead?.email ?? '',
  dni: lead?.dni ?? '',
  ocupacion: lead?.ocupacion ?? '',
  ciudad: lead?.ciudad ?? '',
  descripcion: lead?.descripcion ?? '',
});

const formatTimelineDate = (value?: string | Date | null) => {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const formatter = new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return formatter.format(date);
};

const buildUserFriendlyName = (user?: { nombres?: string | null; apellidos?: string | null; email?: string | null }) => {
  if (!user) return 'Sistema';
  const fullName = `${user.nombres ?? ''} ${user.apellidos ?? ''}`.trim();
  return fullName || user.email || 'Usuario';
};

type LeadAssignee = {
  id?: number;
  nombres?: string;
  apellidos?: string;
  email?: string;
};

const resolveAssignee = (lead: any): { assignee: LeadAssignee | null; assignedAt: string | null } => {
  if (!lead) return { assignee: null, assignedAt: null };
  const direct =
    lead.vendedor || lead.usuario || lead.asignado || lead.asignado_a || lead.usuario_asignado;
  if (direct) {
    return { assignee: direct, assignedAt: direct.fecha_asignacion ?? lead.fecha_asignacion ?? null };
  }

  if (lead.asignacion && typeof lead.asignacion === 'object') {
    return {
      assignee: lead.asignacion.usuario ?? lead.asignacion,
      assignedAt: lead.asignacion.fecha_asignacion ?? null,
    };
  }

  if (Array.isArray(lead.asignaciones) && lead.asignaciones.length) {
    const [first] = [...lead.asignaciones].sort((a: any, b: any) => {
      const dateA = new Date(a.fecha_asignacion ?? 0).getTime();
      const dateB = new Date(b.fecha_asignacion ?? 0).getTime();
      return dateB - dateA;
    });
    const assigneeCandidate = first?.usuario ?? first?.asignado ?? first;
    return {
      assignee: assigneeCandidate,
      assignedAt: first?.fecha_asignacion ?? null,
    };
  }

  return { assignee: null, assignedAt: null };
};

const extractStatusOptions = (raw: any): BulkStatusOption[] => {
  const source = unwrapLeadCollection(raw);

  const mapped = source
    .map((item: any) => ({
      id: Number(item.id_estado_lead ?? item.id ?? item.value ?? 0),
      label: String(item.nombre ?? item.label ?? item.descripcion ?? '').trim() || 'Estado',
    }))
    .filter((option) => option.id);

  return mapped.length ? mapped : FALLBACK_STATUSES;
};

const extractVendorOptions = (raw: any): BulkVendorOption[] => {
  const source = unwrapLeadCollection(raw);
  return source
    .filter((user: any) => mapBackendRole(user.rol?.nombre) === Role.VENDEDOR)
    .map((user: any) => ({
      id: Number(user.id_usuario_empresa ?? user.id ?? 0),
      label: buildVendorLabel(user.nombres, user.apellidos, user.email),
    }))
    .filter((option) => option.id);
};

const buildLeadFullName = (lead: Lead) => {
  return `${lead.nombres ?? ''} ${lead.apellidos ?? ''}`.trim() || lead.email || 'Lead sin nombre';
};

const getAssigneeLabel = (lead: Lead) => {
  const { assignee } = resolveAssignee(lead as any);
  if (!assignee) return 'Sin asignar';
  return `${assignee.nombres ?? ''} ${assignee.apellidos ?? ''}`.trim() || assignee.email || 'Usuario';
};

const buildLeadTimelineFromAssignments = (lead?: Lead | null): TimelineItem[] => {
  if (!lead) return [];
  const entries: TimelineItem[] = [];
  if (lead.fecha_creacion) {
    entries.push({
      id: `creation-${lead.id_lead}`,
      dateLabel: formatTimelineDate(lead.fecha_creacion),
      message: 'Lead registrado en el sistema.',
    });
  }
  (lead.asignaciones ?? []).forEach((assignment) => {
    entries.push({
      id: `assign-${assignment.id_asignacion}`,
      dateLabel: formatTimelineDate(assignment.fecha_asignacion ?? assignment.actualizadoEn ?? assignment.creadoEn),
      message: `${buildUserFriendlyName(assignment.actor)} asignó el lead a ${buildUserFriendlyName(assignment.asignado)}`,
    });
  });
  return entries;
};

const getSortValue = (lead: Lead, field: SortField) => {
  switch (field) {
    case 'lead':
      return buildLeadFullName(lead).toLowerCase();
    case 'campania':
      return (lead.campania?.nombre ?? '').toLowerCase();
    case 'estado':
      return (lead.estado?.nombre ?? '').toLowerCase();
    case 'asignado':
      return getAssigneeLabel(lead).toLowerCase();
    case 'origen':
      return (lead.origen ?? '').toLowerCase();
    case 'creado':
      return new Date(lead.fecha_creacion ?? 0).getTime();
    case 'unassigned': {
      const { assignedAt } = resolveAssignee(lead as any);
      const createdAt = new Date(lead.fecha_creacion ?? 0).getTime();
      const reference = assignedAt ? new Date(assignedAt).getTime() : Date.now();
      return Math.max(reference - createdAt, 0);
    }
    default:
      return '';
  }
};

type ImportReportPanelProps = {
  job: LeadImportJob;
  isOpen: boolean;
  isLoading: boolean;
  onToggle: () => void;
  onDismiss: () => void;
};

const buildImportRowEntries = (job: LeadImportJob) => {
  if (!job.total) return [];
  const rowErrors = (job.errors ?? []).filter((entry) => (entry.row ?? 0) >= 2);
  const errorMap = new Map<number, string[]>();
  rowErrors.forEach((entry) => {
    if (entry.row) {
      errorMap.set(entry.row, entry.issues ?? []);
    }
  });
  return Array.from({ length: job.total }, (_, index) => {
    const rowNumber = index + 2;
    return { rowNumber, issues: errorMap.get(rowNumber) ?? null };
  });
};

const ImportReportPanel = ({
  job,
  isOpen,
  isLoading,
  onToggle,
  onDismiss,
}: ImportReportPanelProps) => {
  const summaryLabel = job.total
    ? `${job.created} de ${job.total} leads importados. Errores: ${job.failed}`
    : 'La importación no procesó filas. Revisa los errores detectados.';
  const startedLabel = job.startedAt
    ? new Date(job.startedAt).toLocaleString()
    : new Date(job.finishedAt ?? Date.now()).toLocaleString();
  const statusLabel = job.status === 'completed' ? 'Completada' : 'Fallida';
  const statusClass =
    job.status === 'completed' ? 'text-emerald-600 bg-emerald-50' : 'text-error-600 bg-error-50';
  const entries = buildImportRowEntries(job);
  const generalIssues = (job.errors ?? []).filter((entry) => !entry.row || entry.row < 2);

  return (
    <div className="rounded-lg border border-border-subtle bg-surface shadow-sm">
      <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-start gap-3 text-left"
        >
          <ChevronRight
            className={`mt-1 h-4 w-4 text-content-muted transition-transform ${isOpen ? 'rotate-90' : ''}`}
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-content">Resultado de importación</p>
            <p className="text-xs text-content-muted">{summaryLabel}</p>
            <p className="text-xs text-content-muted">
              ID: {job.importId} · Inicio: {startedLabel}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
            {statusLabel}
          </span>
          <button
            type="button"
            className="text-sm font-medium text-primary-600 hover:underline"
            onClick={onDismiss}
          >
            Ocultar
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="border-t border-border-subtle px-4 py-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-content-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Consultando estado...</span>
            </div>
          ) : (
            <>
              <div className="mb-3 grid gap-2 text-xs text-content-muted sm:grid-cols-2 lg:grid-cols-4">
                <span>
                  <span className="font-semibold text-content">Procesadas:</span>{' '}
                  {job.processed}/{job.total}
                </span>
                <span>
                  <span className="font-semibold text-content">Creadas:</span> {job.created}
                </span>
                <span>
                  <span className="font-semibold text-content">Errores:</span> {job.failed}
                </span>
                <span>
                  <span className="font-semibold text-content">Import ID:</span> {job.importId}
                </span>
              </div>
              {generalIssues.length ? (
                <div className="mb-3 rounded-md border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700">
                  {generalIssues.map((error, index) => (
                    <p key={`general-${index}`}>
                      {error.row && error.row >= 2 ? `Fila ${error.row}: ` : ''}
                      {error.issues.join(', ')}
                    </p>
                  ))}
                </div>
                      ) : null}
              {entries.length ? (
                <div className="max-h-64 overflow-auto rounded-md border border-border-subtle">
                  <ul className="divide-y divide-border-subtle text-sm">
                    {entries.map((entry) => (
                      <li key={`import-row-${entry.rowNumber}`} className="flex items-start gap-3 p-3">
                        {entry.issues ? (
                          <XCircle className="mt-0.5 h-4 w-4 text-error-500" />
                        ) : (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                        )}
                        <div>
                          <p className="font-medium text-content">Fila {entry.rowNumber}</p>
                          <p className="text-xs text-content-muted">
                            {entry.issues ? entry.issues.join('; ') : 'Lead creado correctamente.'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-content-muted">
                  No hay filas detalladas para esta importación. Revisa los mensajes generales.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const LeadsAdmin = ({
  variant,
  showOriginFilter = true,
  showOriginColumn = true,
  title,
  subtitle,
}: LeadsAdminProps = {}) => {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const resolvedVariant =
    variant ??
    (user?.role === Role.VENDEDOR ? 'vendor' : user?.role === Role.SUPERVISOR ? 'supervisor' : 'admin');
  const [searchParams, setSearchParams] = useSearchParams();
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const isVendorMode = resolvedVariant === 'vendor';
  const isSupervisorMode = resolvedVariant === 'supervisor';
  const originFilterVisible = showOriginFilter && !isSupervisorMode;
  const originColumnVisible = showOriginColumn && !isSupervisorMode;
  const parsedUserId = Number(user?.id ?? NaN);
  const currentUserId = Number.isFinite(parsedUserId) ? parsedUserId : null;
  const pendingStatusLabel = 'pendiente';
  const assignedStatusLabel = 'asignado';
  const canEditLead = isVendorMode || user?.role === Role.ADMIN || user?.role === Role.SUPERVISOR;
  const translate = useCallback(
    (key: string, fallback: string) => {
      const value = t(key);
      return value === key ? fallback : value;
    },
    [],
  );
  const searchLabel = translate('crmLeads.search.label', 'Buscar');
  const searchPlaceholder = translate('crmLeads.search.placeholder', 'Nombre, telefono, DNI o correo');
  const filtersLabel = translate('crmLeads.actions.filters', 'Filtros');
  const bulkPendingWarning = translate(
    'crmLeads.bulk.pendingWarning',
    'Los leads pendientes no permiten cambiar el estado manualmente. Asigna un vendedor primero.',
  );

  const invalidateLeadQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['crm-admin-leads'] });
    queryClient.invalidateQueries({ queryKey: ['crm-vendor-leads-table'] });
    queryClient.invalidateQueries({ queryKey: ['crm-kanban'] });
  }, [queryClient]);

  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 768px)').matches;
  });
  const isMobile = useIsMobile();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(DEFAULT_FILTERS.search);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedAction, setSelectedAction] = useState<LeadBulkAction>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [selectedStatusId, setSelectedStatusId] = useState<number | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [isMetaDialogOpen, setMetaDialogOpen] = useState(false);
  const [isImportDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<LeadImportPreview | null>(null);
  const [headerMapping, setHeaderMapping] = useState<Record<string, string>>({});
  const [importError, setImportError] = useState<string | null>(null);
  const [isUploadingImport, setUploadingImport] = useState(false);
  const [isConfirmingImport, setConfirmingImport] = useState(false);
  const [activeImportJob, setActiveImportJob] = useState<LeadImportJob | null>(null);
  const [isDownloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importReport, setImportReport] = useState<LeadImportJob | null>(null);
  const [isImportReportOpen, setImportReportOpen] = useState(false);
  const [isImportReportLoading, setImportReportLoading] = useState(false);
  useEffect(() => {
    if (isMobile) {
      setFiltersExpanded(false);
    }
  }, [isMobile]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'creado', direction: 'desc' });
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [contactForm, setContactForm] = useState<LeadContactFormState>(() => ({
    nombres: '',
    apellidos: '',
    telefono: '',
    email: '',
    dni: '',
    ocupacion: '',
    ciudad: '',
    descripcion: '',
  }));
  const [operationState, setOperationState] = useState<LeadOperationState>({
    vendorId: '',
    statusId: '',
    active: true,
  });
  const [activeLeadTab, setActiveLeadTab] = useState<'details' | 'history'>('details');
  const importJobHandledRef = useRef<Record<string, LeadImportJobStatus | undefined>>({});
  const pendingUrlLeadIdRef = useRef<number | null>(null);
  const isImportProcessing = activeImportJob?.status === 'pending' || activeImportJob?.status === 'processing';

  const companyId = user?.companyId ?? null;
  const resetToFirstPage = useCallback(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, []);

  const statusFilterId = filters.statusId === 'all' ? undefined : Number(filters.statusId);
  const campaignFilterId =
    filters.campaignId === 'all' || filters.campaignId === 'none'
      ? undefined
      : Number(filters.campaignId);
  const vendorFilterId = filters.vendorId === 'all' ? undefined : Number(filters.vendorId);

  const leadsQueryKey = isVendorMode
    ? [
        'crm-vendor-leads-table',
        currentUserId,
        pagination.page,
        pagination.pageSize,
        debouncedSearch || 'all',
        statusFilterId ?? 'all',
        filters.onlyUnassigned ? 'unassigned' : 'all',
        filters.campaignId,
      ]
    : [
        'crm-admin-leads',
        user?.companyId,
        pagination.page,
        pagination.pageSize,
        debouncedSearch,
        statusFilterId ?? 'all',
        filters.onlyUnassigned ? 'unassigned' : 'all',
        campaignFilterId ?? 'all',
        vendorFilterId ?? 'all',
      ];

  const leadsQuery = useQuery({
    queryKey: leadsQueryKey,
    queryFn: async () => {
      if (isVendorMode) {
        const vendorFilters: Record<string, unknown> = {
          limit: 1000,
          search: debouncedSearch || undefined,
          id_estado_lead: statusFilterId,
          id_campania: campaignFilterId,
        };

        if (user?.type === 'empresa') {
          if (!currentUserId) {
            return {
              data: [],
              total: 0,
              page: pagination.page,
              limit: pagination.pageSize,
              campaigns: [],
            };
          }
          try {
            const response = await LeadService.listByEmpresa({
              page: pagination.page,
              limit: pagination.pageSize,
              search: debouncedSearch || undefined,
              id_estado_lead: statusFilterId,
              solo_sin_asignar: filters.onlyUnassigned || undefined,
              id_campania: campaignFilterId,
              asignado_a_usuario_empresa_id: currentUserId,
            });
            const dataset = unwrapLeadCollection<Lead>(response);
            const filtered = filters.campaignId === 'none' ? dataset.filter((lead) => !lead.campania) : dataset;
            const patchedTotal =
              filters.campaignId === 'none'
                ? filtered.length
                : (response as { total?: number }).total ?? filtered.length;
            return {
              ...response,
              data: filtered,
              total: patchedTotal,
              campaigns: buildCampaignSummaryFromLeads(filtered),
            };
          } catch (error) {
            console.error('[CRM][Vendor] listByEmpresa fallback', error);
            const fallbackRows = await LeadService.listVendorUniverse({
              filters: vendorFilters,
              includeEmpresa: false,
              freelerUserId: null,
              empresaUserId: currentUserId,
            });
            const dataset = Array.isArray(fallbackRows) ? fallbackRows : [];
            const filtered = dataset
              .filter((lead) => (filters.onlyUnassigned ? !getActiveAssignmentEntity(lead) : true))
              .filter((lead) => (filters.campaignId === 'none' ? !lead.campania : true));
            const total = filtered.length;
            const startIndex = Math.max((pagination.page - 1) * pagination.pageSize, 0);
            const pageItems = filtered.slice(startIndex, startIndex + pagination.pageSize);
            return {
              data: pageItems,
              total,
              page: pagination.page,
              limit: pagination.pageSize,
              campaigns: buildCampaignSummaryFromLeads(filtered),
            };
          }
        }

        const rows = await LeadService.listVendorUniverse({
          filters: vendorFilters,
          includeEmpresa: false,
          freelerUserId: user?.type === 'freeler' ? currentUserId : null,
          empresaUserId: user?.type === 'empresa' ? currentUserId : null,
        });
        const dataset = Array.isArray(rows) ? rows : [];
        const filtered = dataset
          .filter((lead) => (filters.onlyUnassigned ? !getActiveAssignmentEntity(lead) : true))
          .filter((lead) => (filters.campaignId === 'none' ? !lead.campania : true));
        const total = filtered.length;
        const startIndex = Math.max((pagination.page - 1) * pagination.pageSize, 0);
        const pageItems = filtered.slice(startIndex, startIndex + pagination.pageSize);
        return {
          data: pageItems,
          total,
          page: pagination.page,
          limit: pagination.pageSize,
          campaigns: buildCampaignSummaryFromLeads(filtered),
        };
      }
      return LeadService.listByEmpresa({
        page: pagination.page,
        limit: pagination.pageSize,
        search: debouncedSearch || undefined,
        id_estado_lead: statusFilterId,
        solo_sin_asignar: filters.onlyUnassigned || undefined,
        id_campania: campaignFilterId,
        asignado_a_usuario_empresa_id: vendorFilterId,
      });
    },
    enabled: Boolean(user?.id),
    keepPreviousData: true,
  });

  const importCampaignsQuery = useQuery({
    queryKey: ['crm-import-campaigns', companyId],
    queryFn: () => CampaignService.getAll({ id_empresa: companyId ?? undefined, estado: 1, limit: 500 }),
    enabled: Boolean(companyId) && isImportDialogOpen,
  });

  const campaignOptions = useMemo(() => {
    const payload = importCampaignsQuery.data;
    const campaigns: Campaign[] = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
      ? payload
      : [];
    return campaigns
      .filter((camp) => typeof camp?.id_campania === 'number')
      .map((camp) => ({ value: String(camp.id_campania), label: camp.nombre }));
  }, [importCampaignsQuery.data]);

  const hasCampaignOptions = campaignOptions.length > 0;
  const selectedCampaignLabel = useMemo(() => {
    return campaignOptions.find((option) => option.value === selectedCampaignId)?.label ?? '';
  }, [campaignOptions, selectedCampaignId]);
  const canUploadFile = hasCampaignOptions;
  const importProgressPercent = useMemo(() => {
    if (!activeImportJob || !activeImportJob.total) return 0;
    return Math.min(100, Math.round((activeImportJob.processed / activeImportJob.total) * 100));
  }, [activeImportJob]);
  const importProgressSummary = useMemo(() => {
    if (!activeImportJob) return '';
    if (!activeImportJob.total) return 'Preparando archivo...';
    return `${activeImportJob.processed}/${activeImportJob.total} filas procesadas`;
  }, [activeImportJob]);

  const resetImportState = () => {
    setImportPreview(null);
    setHeaderMapping({});
    setSelectedCampaignId('');
    setImportError(null);
    setUploadingImport(false);
    setConfirmingImport(false);
    setActiveImportJob(null);
    importJobHandledRef.current = {};
  };

  const toggleSortField = (field: SortField) => {
    setSortConfig((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: field === 'creado' ? 'desc' : 'asc' };
    });
  };

  const renderSortableHead = (label: string, field: SortField, alignRight = false) => {
    const isActive = sortConfig.field === field;
    const Icon = isActive ? (sortConfig.direction === 'asc' ? ChevronUp : ChevronDown) : ArrowUpDown;
    return (
      <TableHead className={alignRight ? 'text-right' : undefined}>
        <button
          type="button"
          className={`group inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${alignRight ? 'justify-end' : 'justify-start'} text-content-muted transition-colors hover:text-content`}
          onClick={() => toggleSortField(field)}
        >
          <span>{label}</span>
          <Icon className="h-3.5 w-3.5 text-content-muted group-hover:text-content" />
        </button>
      </TableHead>
    );
  };

  const handleDismissImportReport = () => {
    setImportReport(null);
    setImportReportOpen(false);
  };

  const loadImportReport = useCallback(async (job: LeadImportJob) => {
    setImportReportLoading(true);
    try {
      const latest = await LeadService.getImportProgress(job.importId);
      setImportReport(latest);
      setImportReportOpen(true);
    } catch {
      setImportReport(job);
      setImportReportOpen(true);
    } finally {
      setImportReportLoading(false);
    }
  }, []);

  const handleImportDialogChange = (open: boolean) => {
    if (!open && isImportProcessing) return;
    setImportDialogOpen(open);
    if (!open) resetImportState();
  };

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    setActiveImportJob(null);
    importJobHandledRef.current = {};
    setUploadingImport(true);
    setImportError(null);
    try {
      const preview = await LeadService.previewImport(file);
      setImportPreview(preview);
      setHeaderMapping(preview.suggestedMapping || {});
    } catch (error) {
      setImportError(getApiErrorMessage(error));
    } finally {
      setUploadingImport(false);
    }
  };

  const handleImportJobResult = useCallback(
    async (job: LeadImportJob) => {
      if (job.status === 'completed') {
        await loadImportReport(job);
        resetImportState();
        setImportDialogOpen(false);
        invalidateLeadQueries();
        return;
      }
      if (job.status === 'failed') {
        await loadImportReport(job);
        const summary =
          job.errors
            .slice(0, 3)
            .map((item) => `Fila ${item.row || '?'}: ${item.issues.join(', ')}`)
            .join(' | ') || 'La importaci?n fall?. Revisa el archivo e int?ntalo nuevamente.';
        setImportError(summary);
      }
    },
    [invalidateLeadQueries, loadImportReport, resetImportState, setImportDialogOpen],
  );
  const handleImportFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    void handleImportFile(file);
    event.target.value = '';
  };

  const handleMappingChange = (field: string, header: string) => {
    setHeaderMapping((prev) => ({ ...prev, [field]: header }));
  };

  const handleConfirmImport = async () => {
    if (!importPreview || isImportProcessing) return;
    if (!selectedCampaignId) {
      setImportError('Selecciona una campaña para continuar.');
      return;
    }
    const missing = REQUIRED_IMPORT_FIELDS.filter((field) => field.required && !headerMapping[field.key]);
    if (missing.length) {
      setImportError('Completa el mapeo de todos los campos obligatorios antes de confirmar.');
      return;
    }
    setConfirmingImport(true);
    setImportError(null);
    try {
      const actorLabel = (user?.email || `Usuario ${user?.id ?? ''}`).trim();
      const job = await LeadService.confirmImport({
        importId: importPreview.importId,
        mapping: headerMapping,
        campaignId: Number(selectedCampaignId),
        actorLabel: actorLabel || undefined,
      });
      setActiveImportJob(job);
    } catch (error) {
      setImportError(getApiErrorMessage(error));
    } finally {
      setConfirmingImport(false);
    }
  };

  useEffect(() => {
    if (!activeImportJob) return;
    if (activeImportJob.status === 'completed' || activeImportJob.status === 'failed') {
      const handledStatus = importJobHandledRef.current[activeImportJob.importId];
      if (handledStatus === activeImportJob.status) return;
      importJobHandledRef.current[activeImportJob.importId] = activeImportJob.status;
      void handleImportJobResult(activeImportJob);
      return;
    }
    const intervalId = window.setInterval(async () => {
      try {
        const nextJob = await LeadService.getImportProgress(activeImportJob.importId);
        setActiveImportJob(nextJob);
      } catch {
        // ignore polling errors
      }
    }, 1500);
    return () => window.clearInterval(intervalId);
  }, [activeImportJob, handleImportJobResult]);

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await LeadService.downloadImportTemplate();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'plantilla_leads.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      push({
        title: 'No se pudo descargar la plantilla',
        description: 'Revisa tu conexión e intenta nuevamente.',
        variant: 'danger',
      });
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const statusesQuery = useQuery({
    queryKey: ['crm-lead-statuses'],
    queryFn: () => LeadService.getStatuses(),
  });

  const vendorsQuery = useQuery({
    queryKey: ['crm-vendors'],
    queryFn: () => UserService.getUsuariosEmpresa(),
  });

  const leads = leadsQuery.data?.data ?? [];
  const totalLeads = leadsQuery.data?.total ?? 0;
  const currentPage = leadsQuery.data?.page ?? pagination.page;
  const currentLimit = leadsQuery.data?.limit ?? pagination.pageSize;
  const totalPages = Math.max(1, Math.ceil(Math.max(totalLeads, 0) / Math.max(currentLimit, 1)));
  const pageStart = totalLeads === 0 ? 0 : (currentPage - 1) * currentLimit + 1;
  const pageEnd = totalLeads === 0 ? 0 : Math.min(totalLeads, pageStart + leads.length - 1);
  const statusOptions = useMemo(() => extractStatusOptions(statusesQuery.data), [statusesQuery.data]);
  const getStatusIdByLabel = useCallback(
    (label: string) => {
      const normalized = normalizeStatusValue(label);
      const match =
        statusOptions.find((status) => normalizeStatusValue(status.label) === normalized) ??
        FALLBACK_STATUSES.find((status) => normalizeStatusValue(status.label) === normalized);
      return match?.id ?? null;
    },
    [statusOptions],
  );
  const vendorOptions = useMemo(() => {
    const options = extractVendorOptions(vendorsQuery.data);
    if (isVendorMode && currentUserId) {
      return options.filter((vendor) => vendor.id === currentUserId);
    }
    return options;
  }, [currentUserId, isVendorMode, vendorsQuery.data]);
  const vendorFilterOptions = useMemo(
    () =>
      vendorOptions
        .filter((option) => option.id)
        .map((option) => ({ value: String(option.id), label: option.label })),
    [vendorOptions],
  );
  const originFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach((lead) => {
      const origin = (lead.origen ?? '').trim();
      if (!origin) return;
      const key = origin.toLowerCase();
      if (!map.has(key)) map.set(key, origin);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }, [leads]);
  const cityFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach((lead) => {
      const city = (lead.ciudad ?? '').trim();
      if (!city) return;
      const key = city.toLowerCase();
      if (!map.has(key)) map.set(key, city);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }, [leads]);
  const campaignFilterOptions = useMemo(() => {
    const campaignsSummary =
      ((leadsQuery.data as { campaigns?: LeadCampaignSummary[] } | undefined)?.campaigns) ?? [];
    const mapped = campaignsSummary
      .filter((campaign): campaign is LeadCampaignSummary => typeof campaign?.id_campania === 'number')
      .map((campaign) => ({ value: String(campaign.id_campania), label: campaign.nombre }));
    const options =
      mapped.length > 0
        ? mapped.sort((a, b) => a.label.localeCompare(b.label))
        : Array.from(
            leads.reduce((acc, lead) => {
              if (lead.campania?.id_campania) {
                acc.set(lead.campania.id_campania, lead.campania.nombre ?? 'Sin campa??a');
              }
              return acc;
            }, new Map<number, string>()),
          )
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([id, label]) => ({ value: String(id), label }));
    if (isVendorMode) {
      const hasNoCampaign = leads.some((lead) => !lead.campania);
      if (hasNoCampaign) {
        options.unshift({ value: 'none', label: t('crmLeads.filters.campaign.none') });
      }
    }
    return options;
  }, [isVendorMode, leadsQuery.data, leads]);
  const filtersForm = (
    <FilterPanel>
      {originFilterVisible && (
        <FilterField>
          <Select
            label={t('crmLeads.filters.origin.label')}
            value={filters.origin}
            onChange={(event) => setFilters((prev) => ({ ...prev, origin: event.target.value }))}
            options={[{ label: t('crmLeads.filters.origin.all'), value: 'all' }, ...originFilterOptions]}
            className="w-full"
          />
        </FilterField>
      )}
      <FilterField>
        <Select
          label={t('crmLeads.filters.campaign.label')}
          value={filters.campaignId}
          onChange={(event) => setFilters((prev) => ({ ...prev, campaignId: event.target.value }))}
          options={campaignFilterOptions}
          className="w-full"
        />
      </FilterField>
      <FilterField>
        <Select
          label={t('crmLeads.filters.status.label')}
          value={filters.statusId === 'all' ? 'all' : String(filters.statusId)}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              statusId: event.target.value === 'all' ? 'all' : Number(event.target.value),
            }))
          }
          options={[
            { label: t('crmLeads.filters.status.all'), value: 'all' },
            ...statusOptions.map((status) => ({ value: status.id, label: status.label })),
          ]}
          className="w-full"
        />
      </FilterField>
      {!isVendorMode && (
        <FilterField>
          <Select
            label={t('crmLeads.filters.vendor.label')}
            value={filters.vendorId}
            onChange={(event) => setFilters((prev) => ({ ...prev, vendorId: event.target.value }))}
            options={[{ label: t('crmLeads.filters.vendor.all'), value: 'all' }, ...vendorFilterOptions]}
            className="w-full"
          />
        </FilterField>
      )}
      <FilterField>
        <Select
          label={t('crmLeads.filters.city.label')}
          value={filters.city}
          onChange={(event) => setFilters((prev) => ({ ...prev, city: event.target.value }))}
          options={[{ label: t('crmLeads.filters.city.all'), value: 'all' }, ...cityFilterOptions]}
          className="w-full"
        />
      </FilterField>
      {!isVendorMode && (
        <FilterField className="w-full max-w-xs">
          <div className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              {translate('crmLeads.filters.unassignedShortLabel', 'Pendientes de asignar')}
            </span>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-content">
                {translate('crmLeads.filters.unassignedToggle', 'Solo pendientes')}
              </span>
              <Switch
                checked={filters.onlyUnassigned}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, onlyUnassigned: event.target.checked }))
                }
                aria-label={translate('crmLeads.filters.unassignedToggle', 'Solo pendientes')}
              />
            </div>
          </div>
        </FilterField>
      )}
    </FilterPanel>
  );
  const pageSizeOptions = useMemo(
    () => PAGE_SIZE_OPTIONS.map((value) => ({ value: String(value), label: `${value} por pagina` })),
    [],
  );
  const historyQuery = useQuery({
    queryKey: ['lead-history', editingLead?.id_lead],
    queryFn: () => LeadService.getAssignmentHistory(editingLead!.id_lead),
    enabled: Boolean(isEditDialogOpen && editingLead?.id_lead && !isVendorMode),
    staleTime: 1000 * 60,
  });


  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(filters.search), 400);
    return () => clearTimeout(handler);
  }, [filters.search]);

  useEffect(() => {
    resetToFirstPage();
    setSelectedIds([]);
  }, [
    debouncedSearch,
    filters.statusId,
    filters.onlyUnassigned,
    filters.campaignId,
    filters.vendorId,
    filters.origin,
    filters.city,
    resetToFirstPage,
  ]);

  useEffect(() => {
    if (!leadsQuery.data) return;
    const total = Math.max(leadsQuery.data.total ?? 0, 0);
    const limit = Math.max(leadsQuery.data.limit ?? pagination.pageSize, 1);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    if (pagination.page > totalPages) {
      setPagination((prev) => ({ ...prev, page: totalPages }));
    }
  }, [leadsQuery.data, pagination.page, pagination.pageSize]);

  useEffect(() => {
    if (!editingLead) {
      setContactForm(buildContactSnapshot(null));
      setOperationState({ vendorId: '', statusId: '', active: true });
      return;
    }
    setContactForm(buildContactSnapshot(editingLead));
    const assignment = getActiveAssignmentEntity(editingLead);
    setOperationState({
      vendorId: assignment ? String(assignment.id_asignado_usuario_empresa) : '',
      statusId: editingLead.estado?.id_estado_lead ? String(editingLead.estado.id_estado_lead) : '',
      active: (assignment?.estado ?? 1) === 1,
    });
  }, [editingLead]);

  const visibleLeads = useMemo(() => {
    const normalizedOrigin = filters.origin === 'all' ? null : filters.origin;
    const normalizedCity = filters.city === 'all' ? null : filters.city;
    const campaignFilterValue = filters.campaignId;
    const vendorFilterValue = filters.vendorId;
    const filteredDataset = leads.filter((lead) => {
      if (normalizedOrigin) {
        const leadOrigin = (lead.origen ?? '').trim().toLowerCase();
        if (!leadOrigin || leadOrigin !== normalizedOrigin) return false;
      }
      if (campaignFilterValue !== 'all') {
        if (campaignFilterValue === 'none') {
          if (lead.campania) return false;
        } else {
          const leadCampaignId = lead.campania?.id_campania ? String(lead.campania.id_campania) : '';
          if (leadCampaignId !== campaignFilterValue) return false;
        }
      }
      if (vendorFilterValue !== 'all') {
        const ownerId = getLeadOwnerId(lead);
        if (String(ownerId ?? '') !== vendorFilterValue) return false;
      }
      if (normalizedCity) {
        const leadCity = (lead.ciudad ?? '').trim().toLowerCase();
        if (!leadCity || leadCity !== normalizedCity) return false;
      }
      return true;
    });
    const directionFactor = sortConfig.direction === 'asc' ? 1 : -1;
    const sorted = [...filteredDataset].sort((a, b) => {
      const valueA = getSortValue(a, sortConfig.field);
      const valueB = getSortValue(b, sortConfig.field);

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * directionFactor;
      }

      const textA = String(valueA ?? '').toLowerCase();
      const textB = String(valueB ?? '').toLowerCase();
      return textA.localeCompare(textB) * directionFactor;
    });

    return sorted;
  }, [leads, sortConfig, filters.origin, filters.campaignId, filters.vendorId, filters.city]);

  const allSelected =
    visibleLeads.length > 0 && visibleLeads.every((lead) => selectedIds.includes(lead.id_lead));
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = selectedIds.length > 0 && !allSelected;
    }
  }, [allSelected, selectedIds]);

  const contactBaseline = useMemo(() => buildContactSnapshot(editingLead), [editingLead]);
  const contactChanged = useMemo(
    () =>
      (Object.keys(contactBaseline) as Array<keyof LeadContactFormState>).some(
        (key) => contactBaseline[key] !== contactForm[key],
      ),
    [contactBaseline, contactForm],
  );
  const canEditContactValue = useCallback(
    (value: string) => !isVendorMode || !(value ?? '').trim().length,
    [isVendorMode],
  );
  const currentAssignment = editingLead ? getActiveAssignmentEntity(editingLead) : null;
  const hasVendorAssigned = Boolean(currentAssignment);
  const vendorBaseline = currentAssignment ? String(currentAssignment.id_asignado_usuario_empresa) : '';
  const statusBaseline = editingLead?.estado?.id_estado_lead ? String(editingLead.estado.id_estado_lead) : '';
  const vendorChanged = operationState.vendorId !== vendorBaseline;
  const statusChanged = operationState.statusId !== statusBaseline;
  const editingLeadStatusSlug = editingLead ? normalizeStatusValue(editingLead.estado?.nombre) : '';
  const editingLeadIsPending = editingLeadStatusSlug === pendingStatusLabel;
  const finalStateSet = useMemo(() => new Set(['ganado', 'perdido']), []);
  const isFinalState = finalStateSet.has(editingLeadStatusSlug);
  const canChangeVendor = !isVendorMode && !isFinalState;
  const canChangeStatus = hasVendorAssigned && !editingLeadIsPending;
  const isAssignedToCurrentUser =
    Boolean(currentAssignment?.id_asignado_usuario_empresa) &&
    currentAssignment?.id_asignado_usuario_empresa === currentUserId;
  const canSelfAssign = Boolean(
    isVendorMode && currentUserId && (!currentAssignment || isAssignedToCurrentUser),
  );
  const statusBlockedMessage = !hasVendorAssigned
    ? translate('crmLeads.drawer.statusBlocked.noVendor', 'Asigna un vendedor antes de cambiar el estado.')
    : editingLeadIsPending
    ? translate(
        'crmLeads.drawer.statusBlocked.pending',
        'Los leads pendientes cambian a Asignado automáticamente al asignarlos.',
      )
    : null;
  const selectedVisibleLeads = useMemo(
    () => visibleLeads.filter((lead) => selectedIds.includes(lead.id_lead)),
    [selectedIds, visibleLeads],
  );
  const selectedPendingLeadIds = useMemo(
    () =>
      selectedVisibleLeads
        .filter((lead) => normalizeStatusValue(lead.estado?.nombre) === pendingStatusLabel)
        .map((lead) => lead.id_lead),
    [pendingStatusLabel, selectedVisibleLeads],
  );
  const hasPendingLeadSelected = selectedPendingLeadIds.length > 0;
  const historyEntries = historyQuery.data?.entries ?? [];
  const fallbackTimeline = useMemo(() => buildLeadTimelineFromAssignments(editingLead), [editingLead]);
  const timelineItems = useMemo<TimelineItem[]>(() => {
    if (!historyEntries.length) return fallbackTimeline;
    return historyEntries.flatMap((entry, index) => {
      const previous = index > 0 ? historyEntries[index - 1] : null;
      const dateLabel = formatTimelineDate(entry.fecha_asignacion);
      const actorName = buildUserFriendlyName(entry.actor);
      const items: TimelineItem[] = [];
      if (!previous || previous.asignado?.id_usuario_empresa !== entry.asignado?.id_usuario_empresa) {
        items.push({
          id: `${entry.id_asignacion}-assign`,
          dateLabel,
          message: `El ${dateLabel}, ${actorName} asignó el lead a ${buildUserFriendlyName(entry.asignado)}`,
        });
      }
      if (!previous || previous.estado?.id_estado_lead !== entry.estado?.id_estado_lead) {
        items.push({
          id: `${entry.id_asignacion}-status`,
          dateLabel,
          message: `El ${dateLabel}, ${actorName} cambió a ${entry.estado?.nombre ?? 'Sin estado'}`,
        });
      }
      if (!items.length) {
        items.push({
          id: `${entry.id_asignacion}-event`,
          dateLabel,
          message: `El ${dateLabel}, ${actorName} registró una actualización.`,
        });
      }
      return items;
    });
  }, [fallbackTimeline, historyEntries]);
  const assignmentInfo = editingLead ? resolveAssignee(editingLead as any) : { assignee: null, assignedAt: null };
  const assignedAtLabel = assignmentInfo.assignedAt ? formatDate(assignmentInfo.assignedAt) : 'Sin registro';
  const unassignedLabel = computeUnassignedDuration(
    editingLead?.fecha_creacion,
    assignmentInfo.assignedAt,
  );
  const originLabel = editingLead?.origen ?? 'No indicado';
  const campaignLabel = editingLead?.campania?.nombre ?? 'Sin campaña';
  const creationLabel = editingLead?.fecha_creacion ? formatDate(editingLead.fecha_creacion) : '-';
  const assignmentDisplayName = assignmentInfo.assignee
    ? `${assignmentInfo.assignee.nombres ?? ''} ${assignmentInfo.assignee.apellidos ?? ''}`.trim() ||
      assignmentInfo.assignee.email ||
      'Usuario'
    : 'Sin asignar';

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleLeads.some((lead) => lead.id_lead === id)));
    } else {
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...visibleLeads.map((lead) => lead.id_lead)])),
      );
    }
  };

  const toggleLeadSelection = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((leadId) => leadId !== id) : [...prev, id]));
  };

  const resetBulkState = () => {
    setSelectedIds([]);
    setSelectedAction(null);
    setSelectedVendorId(null);
    setSelectedStatusId(null);
  };

  const handlePageChange = (nextPage: number) => {
    setPagination((prev) => (prev.page === nextPage ? prev : { ...prev, page: nextPage }));
  };

  const handlePageSizeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextSize = Number(event.target.value);
    setPagination({
      page: 1,
      pageSize: Number.isFinite(nextSize) && nextSize > 0 ? nextSize : DEFAULT_PAGE_SIZE,
    });
  };

  const bulkMutation = useMutation({
    mutationFn: async ({
      payload,
      pendingLeadIds,
    }: {
      payload: Parameters<typeof LeadService.bulkUpdate>[0];
      pendingLeadIds: number[];
    }) => {
      await LeadService.bulkUpdate(payload);
      if (payload.action === 'assign' && pendingLeadIds.length) {
        const assignedStatusId = getStatusIdByLabel(assignedStatusLabel);
        if (assignedStatusId && payload.usuarioEmpresaId) {
          await Promise.all(
            pendingLeadIds.map((leadId) =>
              LeadService.updateStatus({
                leadId,
                id_estado_lead: assignedStatusId,
                usuarioEmpresaId: payload.usuarioEmpresaId,
              }),
            ),
          );
        }
      }
    },
    onSuccess: () => {
      push({ title: 'Accion aplicada', description: 'Los leads se actualizaron correctamente.' });
      resetBulkState();
      invalidateLeadQueries();
    },
    onError: () => {
      push({
        title: 'No se pudo aplicar la accion',
        description: 'Intentalo nuevamente.',
        variant: 'danger',
      });
    },
  });

  const handleActionChange = (action: LeadBulkAction) => {
    setSelectedAction(action);
    if (action !== 'assign') {
      setSelectedVendorId(null);
    }
    if (action !== 'change-status') {
      setSelectedStatusId(null);
    }
  };

  const handleBulkConfirm = () => {
    if (selectedAction === 'change-status' && hasPendingLeadSelected) {
      push({
        title: 'No disponible para pendientes',
        description: 'Asigna los leads pendientes antes de cambiar su estado manualmente.',
        variant: 'warning',
      });
      return;
    }
    if (!selectedAction || !user) {
      if (!selectedAction) return;
      push({
        title: 'Sin sesion de empresa',
        description: 'Inicia sesion nuevamente para aplicar acciones masivas.',
        variant: 'danger',
      });
      return;
    }
    const payload: Parameters<typeof LeadService.bulkUpdate>[0] = {
      leadIds: selectedIds,
      action: selectedAction,
      usuarioEmpresaId: user.id,
    };
    if (selectedAction === 'assign') payload.vendedorId = selectedVendorId ?? undefined;
    if (selectedAction === 'change-status') payload.estadoId = selectedStatusId ?? undefined;
    bulkMutation.mutate({
      payload,
      pendingLeadIds: selectedPendingLeadIds,
    });
  };

  const refreshEditingLead = useCallback(async (leadId: number) => {
    try {
      const fresh = await LeadService.findById(leadId);
      setEditingLead(fresh);
    } catch {
      // Si falla la actualización silenciosamente, mantenemos el estado actual
    }
  }, []);

  const contactMutation = useMutation({
    mutationFn: ({ leadId, data }: { leadId: number; data: Partial<LeadDraft> }) =>
      LeadService.update(leadId, data),
    onSuccess: async (_response, variables) => {
      push({ title: 'Lead actualizado', description: 'Los datos de contacto se guardaron.' });
      refreshEditingLead(variables.leadId);
      invalidateLeadQueries();
    },
    onError: () => {
      push({
        title: 'No se pudieron guardar los datos',
        description: 'Revisa la información e intenta nuevamente.',
        variant: 'danger',
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      leadId,
      statusId,
      usuarioEmpresaId,
    }: {
      leadId: number;
      statusId: number;
      usuarioEmpresaId: number;
    }) =>
      LeadService.updateStatus({
        leadId,
        id_estado_lead: statusId,
        usuarioEmpresaId,
      }),
    onSuccess: (_response, variables) => {
      push({ title: 'Estado actualizado', description: 'El lead cambió de estado.' });
      refreshEditingLead(variables.leadId);
      invalidateLeadQueries();
    },
    onError: () => {
      push({
        title: 'No se pudo cambiar el estado',
        description: 'Intenta nuevamente en unos segundos.',
        variant: 'danger',
      });
    },
  });

  const assignVendorMutation = useMutation({
    mutationFn: ({
      leadId,
      usuarioEmpresaId,
      vendedorId,
    }: {
      leadId: number;
      usuarioEmpresaId: number;
      vendedorId: number;
    }) =>
      LeadService.assignLead({
        leadId,
        usuarioEmpresaId,
        asignarAUsuarioEmpresaId: vendedorId,
      }),
    onSuccess: async (_response, variables) => {
      push({ title: 'Asignaci?n actualizada', description: 'El lead fue asignado.' });
      const wasPending = normalizeStatusValue(editingLead?.estado?.nombre) === pendingStatusLabel;
      if (wasPending) {
        const assignedStatusId = getStatusIdByLabel(assignedStatusLabel);
        if (assignedStatusId && user?.id) {
          try {
            await LeadService.updateStatus({
              leadId: variables.leadId,
              id_estado_lead: assignedStatusId,
              usuarioEmpresaId: Number(user.id),
            });
          } catch {
            push({
              title: 'Estado no actualizado',
              description: 'No se pudo marcar el lead como asignado automaticamente.',
              variant: 'warning',
            });
          }
        }
      }
      await refreshEditingLead(variables.leadId);
      invalidateLeadQueries();
    },
    onError: () => {
      push({
        title: 'No se pudo asignar el lead',
        description: 'Revisa la selección e intenta nuevamente.',
        variant: 'danger',
      });
    },
  });

  const assignmentStateMutation = useMutation({
    mutationFn: (payload: {
      asignacionId: number;
      estado: 'activo' | 'inactivo';
      usuarioEmpresaId: number;
      leadId: number;
    }) =>
      LeadService.updateAsignacion(payload.asignacionId, {
        usuarioEmpresaId: payload.usuarioEmpresaId,
        estado: payload.estado,
      }),
    onSuccess: async (_response, variables) => {
      push({ title: 'Asignación actualizada', description: 'El estado del vendedor cambió.' });
      await refreshEditingLead(variables.leadId);
      invalidateLeadQueries();
    },
    onError: () => {
      push({
        title: 'No se pudo actualizar la asignación',
        description: 'Inténtalo nuevamente.',
        variant: 'danger',
      });
    },
  });

  const openEditLeadDialog = useCallback(
    (lead: Lead) => {
      if (!canEditLead) {
        push({
          title: 'Sin permisos',
          description: 'Solo los roles Admin y Supervisor pueden editar leads.',
          variant: 'danger',
        });
        return;
      }
      setEditingLead(lead);
      setActiveLeadTab('details');
      setEditDialogOpen(true);
    },
    [canEditLead, push],
  );

  useEffect(() => {
    const targetIdParam = searchParams.get('leadId');
    if (!targetIdParam || !canEditLead) return;
    const parsedId = Number(targetIdParam);
    if (!Number.isFinite(parsedId)) return;
    if (editingLead?.id_lead === parsedId || pendingUrlLeadIdRef.current === parsedId) {
      return;
    }
    pendingUrlLeadIdRef.current = parsedId;
    let isMounted = true;

    const cleanup = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('leadId');
      setSearchParams(next, { replace: true });
      pendingUrlLeadIdRef.current = null;
    };

    const resolveLead = async () => {
      const localMatch = leads.find((lead) => lead.id_lead === parsedId);
      if (localMatch) {
        openEditLeadDialog(localMatch);
        cleanup();
        return;
      }
      try {
        const fetched = await LeadService.findById(parsedId);
        if (!isMounted) return;
        openEditLeadDialog(fetched);
      } catch {
        if (isMounted) {
          push({
            title: 'No se pudo abrir el lead',
            description: 'Revisa que el lead siga disponible.',
            variant: 'danger',
          });
        }
      } finally {
        if (isMounted) {
          cleanup();
        }
      }
    };

    void resolveLead();

    return () => {
      isMounted = false;
    };
  }, [searchParams, canEditLead, leads, openEditLeadDialog, push, setSearchParams, editingLead]);

  const closeLeadDrawer = () => {
    setEditDialogOpen(false);
    setEditingLead(null);
    setContactForm(buildContactSnapshot(null));
    setOperationState({ vendorId: '', statusId: '', active: true });
  };

  const handleContactInputChange = (field: keyof LeadContactFormState, value: string) => {
    setContactForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleContactReset = () => {
    if (editingLead) {
      setContactForm(buildContactSnapshot(editingLead));
    }
  };

  const handleContactSave = () => {
    if (!editingLead) return;
    const leadId = editingLead.id_lead;
    const data: Partial<LeadDraft> = {
      nombres: contactForm.nombres.trim() || undefined,
      apellidos: contactForm.apellidos.trim() || undefined,
      telefono: contactForm.telefono.trim() || undefined,
      email: contactForm.email.trim() || undefined,
      dni: contactForm.dni.trim() || undefined,
      ocupacion: contactForm.ocupacion.trim() || undefined,
      ciudad: contactForm.ciudad.trim() || undefined,
      descripcion: contactForm.descripcion.trim() || undefined,
    };
    contactMutation.mutate({ leadId, data });
  };

  const handleStatusSave = () => {
    if (!editingLead) return;
    if (!canChangeStatus) {
      push({
        title: 'No disponible',
        description: hasVendorAssigned
          ? 'Asigna el lead antes de cambiar su estado.'
          : 'Debes asignar un vendedor antes de actualizar el estado.',
        variant: 'warning',
      });
      return;
    }
    if (!operationState.statusId) {
      push({
        title: 'Selecciona un estado',
        description: 'Elige un estado antes de guardar.',
        variant: 'warning',
      });
      return;
    }
    if (!user?.id) {
      push({
        title: 'Sesion requerida',
        description: 'Vuelve a iniciar sesion para actualizar el estado.',
        variant: 'danger',
      });
      return;
    }
    statusMutation.mutate({
      leadId: editingLead.id_lead,
      statusId: Number(operationState.statusId),
      usuarioEmpresaId: Number(user.id),
    });
  };

  const handleVendorSave = () => {
    if (!editingLead) return;
    if (!operationState.vendorId) {
      push({
        title: 'Selecciona un vendedor',
        description: 'Elige un vendedor antes de actualizar.',
        variant: 'warning',
      });
      return;
    }
    if (!user?.id) {
      push({
        title: 'Sesion requerida',
        description: 'Vuelve a iniciar sesion para reasignar el lead.',
        variant: 'danger',
      });
      return;
    }
    assignVendorMutation.mutate({
      leadId: editingLead.id_lead,
      vendedorId: Number(operationState.vendorId),
      usuarioEmpresaId: Number(user.id),
    });
  };

  const handleSelfAssign = () => {
    if (!editingLead || !currentUserId || !user?.id) return;
    if (currentAssignment && currentAssignment.id_asignado_usuario_empresa && currentAssignment.id_asignado_usuario_empresa !== currentUserId) {
      push({
        title: 'No disponible',
        description: 'El lead ya cuenta con un vendedor asignado.',
        variant: 'warning',
      });
      return;
    }
    assignVendorMutation.mutate({
      leadId: editingLead.id_lead,
      vendedorId: currentUserId,
      usuarioEmpresaId: Number(user.id),
    });
  };

  const handleAssignmentToggle = (checked: boolean) => {
    if (!editingLead) return;
    const assignment = currentAssignment;
    if (!assignment) {
      push({
        title: 'Sin asignación activa',
        description: 'Asigna el lead a un vendedor antes de cambiar su estado.',
        variant: 'warning',
      });
      setOperationState((prev) => ({ ...prev, active: false }));
      return;
    }
    if (!user?.id) {
      push({
        title: 'Sesion requerida',
        description: 'Vuelve a iniciar sesion para modificar la asignacion.',
        variant: 'danger',
      });
      return;
    }
    setOperationState((prev) => ({ ...prev, active: checked }));
    assignmentStateMutation.mutate(
      {
        asignacionId: assignment.id_asignacion,
        estado: checked ? 'activo' : 'inactivo',
        usuarioEmpresaId: Number(user.id),
        leadId: editingLead.id_lead,
      },
      {
        onError: () => {
          setOperationState((prev) => ({ ...prev, active: !checked }));
        },
      },
    );
  };

  return (
    <>
      <div>
        <section className="flex-1 min-w-0 space-y-6">
        <header className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-content">
                {title ?? 'Gestor de leads'}
              </h1>
              <p className="text-sm text-content-muted">
                {subtitle ?? 'Filtra, asigna y actualiza el estado de los leads de tu empresa desde un solo lugar.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isVendorMode && (
                <>
                  <Button
                    type="button"
                    className="border-transparent bg-[#1877F2] text-white shadow-card hover:bg-[#0f5bd7]"
                    onClick={() => setMetaDialogOpen(true)}
                  >
                    Conectar Meta Ads
                  </Button>
                  <Button
                    type="button"
                    className="border-transparent bg-[#107C41] text-white shadow-card hover:bg-[#0d6434]"
                    onClick={() => setImportDialogOpen(true)}
                  >
                    Importar desde Excel
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="w-full md:max-w-md">
              <Input
                label={searchLabel}
                placeholder={searchPlaceholder}
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                autoComplete="off"
                className="w-full"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterToggleButton
                label={filtersLabel}
                expanded={filtersExpanded}
                isMobile={isMobile}
                onToggle={() => {
                  if (isMobile) {
                    setIsMobileFiltersOpen(true);
                  } else {
                    setFiltersExpanded((prev) => !prev);
                  }
                }}
              />
            </div>
          </div>
        </header>
        {importReport ? (
        <ImportReportPanel
          job={importReport}
          isOpen={isImportReportOpen}
          isLoading={isImportReportLoading}
          onToggle={() => setImportReportOpen((prev) => !prev)}
          onDismiss={handleDismissImportReport}
        />
              ) : null}

        {!isMobile && filtersExpanded ? filtersForm : null}
        {isMobile && (
          <MobileFiltersModal
            open={isMobileFiltersOpen}
            onOpenChange={setIsMobileFiltersOpen}
            onApply={() => {
              resetToFirstPage();
            }}
          >
            {filtersForm}
          </MobileFiltersModal>
        )}

      {leadsQuery.isLoading ? (
        <p className="text-sm text-content-muted">Cargando leads...</p>
      ) : visibleLeads.length ? (
        <Table minWidthClass="min-w-[1100px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  className="h-5 w-5 rounded border-2 border-border-subtle text-primary-600 focus:ring-primary-500"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-checked={
                    selectedIds.length
                      ? (allSelected ? 'true' : 'mixed')
                      : 'false'
                  }
                  aria-label="Seleccionar todos los leads filtrados"
                />
              </TableHead>
              {renderSortableHead('Lead', 'lead')}
              {renderSortableHead('Campaña', 'campania')}
              {renderSortableHead('Estado', 'estado')}
              {renderSortableHead('Asignado a', 'asignado')}
              {originColumnVisible && renderSortableHead('Origen', 'origen')}
              {renderSortableHead('Creado', 'creado')}
              {!isVendorMode && renderSortableHead('Tiempo sin asignar', 'unassigned')}
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleLeads.map((lead) => {
              const isSelected = selectedIds.includes(lead.id_lead);
              const { assignee, assignedAt } = resolveAssignee(lead as any);
              const fullName = buildLeadFullName(lead);
              const assigneeName = assignee
                ? `${assignee.nombres ?? ''} ${assignee.apellidos ?? ''}`.trim() ||
                  assignee.email ||
                  'Usuario'
                : 'Sin asignar';
              const assigneeInitials = assignee ? getInitials(assigneeName) : null;
              const unassignedDuration = computeUnassignedDuration(lead.fecha_creacion, assignedAt);

              return (
                <TableRow key={lead.id_lead} className={isSelected ? 'bg-surface-muted/60' : undefined}>
                  <TableCell className="w-10">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-2 border-border-subtle text-primary-600 focus:ring-primary-500"
                      checked={isSelected}
                      onChange={() => toggleLeadSelection(lead.id_lead)}
                      aria-label={`Seleccionar lead ${fullName}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-content">{fullName}</span>
                      <span className="text-xs text-content-muted">
                        {lead.email ?? 'Sin correo registrado'}
                      </span>
                      {lead.telefono && (
                        <span className="text-xs text-content-muted">Tel: {lead.telefono}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{lead.campania?.nombre ?? 'Sin campaña'}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(lead.estado?.nombre ?? lead.estado)}>
                      {normalizeStatusLabel(lead.estado?.nombre ?? lead.estado, 'Pendiente')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {assignee ? (
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600/10 text-xs font-semibold text-primary-700">
                          {assigneeInitials}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-content">{assigneeName}</p>
                          <p className="text-xs text-content-muted">{assignee.email ?? 'Sin correo'}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-content-muted">Sin asignar</span>
                    )}
                  </TableCell>
                  {originColumnVisible && <TableCell>{lead.origen ?? 'No indicado'}</TableCell>}
                  <TableCell>{formatDate(lead.fecha_creacion)}</TableCell>
                  {!isVendorMode && (
                    <TableCell className="text-sm text-content-muted">{unassignedDuration}</TableCell>
                  )}
                  <TableCell className="text-right">
                    {canEditLead ? (
                      <Button size="sm" variant="outline" onClick={() => openEditLeadDialog(lead)}>
                        Editar
                      </Button>
                    ) : (
                      <span className="text-xs text-content-subtle">Sin acceso</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-content-muted">No encontramos leads con los filtros seleccionados.</p>
      )}

      {totalLeads > 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-content">
              {`Mostrando ${pageStart || 0} - ${pageEnd || 0} de ${totalLeads} leads`}
            </p>
            <p className="text-xs text-content-muted">{`Pagina ${currentPage} de ${totalPages}`}</p>
          </div>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center md:justify-end">
            <div className="w-full max-w-[200px]">
              <Select
                label="Leads por pagina"
                value={String(pagination.pageSize)}
                onChange={handlePageSizeChange}
                options={pageSizeOptions}
              />
            </div>
            <Pagination page={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
          </div>
        </div>
              ) : null}

      <LeadBulkActionsBar
        selectedCount={selectedIds.length}
        action={selectedAction}
        onActionChange={handleActionChange}
        vendors={vendorOptions}
        statuses={statusOptions}
        selectedVendorId={selectedVendorId}
        onVendorSelect={setSelectedVendorId}
        selectedStatusId={selectedStatusId}
        onStatusSelect={setSelectedStatusId}
        onClear={resetBulkState}
        onConfirm={handleBulkConfirm}
        disabled={bulkMutation.isPending}
        disableChangeStatus={hasPendingLeadSelected}
      />
      {selectedAction === 'change-status' && hasPendingLeadSelected ? (
        <p className="mt-2 text-center text-xs font-medium text-warning-600 dark:text-warning-300">
          {bulkPendingWarning}
        </p>
      ) : null}
        </section>
        {isEditDialogOpen && editingLead ? (
          <div className="hidden">
            <LeadDetailDrawer
              open={isEditDialogOpen && Boolean(editingLead)}
              onClose={closeLeadDrawer}
              title={buildLeadFullName(editingLead)}
              footer={
                <div className="flex justify-end">
                  <Button variant="ghost" onClick={closeLeadDrawer}>
                    Cerrar
                  </Button>
                </div>
              }
            >
            {editingLead ? (
              <div className="space-y-4">
            <div className="flex gap-3 border-b border-border-subtle pb-2">
              {[
                { id: 'details', label: 'Detalles de lead' },
                { id: 'history', label: 'Historial' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveLeadTab(tab.id as 'details' | 'history')}
                  className={cn(
                    'rounded-full px-3 py-1 text-sm transition',
                    activeLeadTab === tab.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-muted text-content-muted hover:text-content',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeLeadTab === 'details' ? (
              <div className="space-y-4">
                <Accordion title="Datos de contacto" defaultOpen>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      label="DNI"
                      value={contactForm.dni}
                      onChange={(event) => handleContactInputChange('dni', event.target.value)}
                      disabled={!canEditContactValue(contactForm.dni)}
                    />
                    <Input
                      label="Nombres"
                      value={contactForm.nombres}
                      onChange={(event) => handleContactInputChange('nombres', event.target.value)}
                      disabled={!canEditContactValue(contactForm.nombres)}
                    />
                    <Input
                      label="Apellidos"
                      value={contactForm.apellidos}
                      onChange={(event) => handleContactInputChange('apellidos', event.target.value)}
                      disabled={!canEditContactValue(contactForm.apellidos)}
                    />
                    <Input
                      label="Teléfono"
                      value={contactForm.telefono}
                      onChange={(event) => handleContactInputChange('telefono', event.target.value)}
                      disabled={!canEditContactValue(contactForm.telefono)}
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={contactForm.email}
                      onChange={(event) => handleContactInputChange('email', event.target.value)}
                      disabled={!canEditContactValue(contactForm.email)}
                    />
                    <Input
                      label="Ocupación"
                      value={contactForm.ocupacion}
                      onChange={(event) => handleContactInputChange('ocupacion', event.target.value)}
                      disabled={!canEditContactValue(contactForm.ocupacion)}
                    />
                    <Input
                      label="Ciudad"
                      value={contactForm.ciudad}
                      onChange={(event) => handleContactInputChange('ciudad', event.target.value)}
                      disabled={!canEditContactValue(contactForm.ciudad)}
                    />
                  </div>
                  <TextArea
                    label="Descripción"
                    minRows={3}
                    value={contactForm.descripcion}
                    onChange={(event) => handleContactInputChange('descripcion', event.target.value)}
                    disabled={!canEditContactValue(contactForm.descripcion)}
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={handleContactReset} disabled={!editingLead}>
                      Restablecer
                    </Button>
                    <Button
                      type="button"
                      onClick={handleContactSave}
                      disabled={!contactChanged || contactMutation.isPending}
                      isLoading={contactMutation.isPending}
                    >
                      Guardar datos
                    </Button>
                  </div>
                </Accordion>

                <Accordion title="Datos de operación" defaultOpen>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs text-content-muted">Campaña</p>
                      <p className="text-sm font-semibold text-content">{campaignLabel}</p>
                    </div>
                    <div>
                      <p className="text-xs text-content-muted">Fecha de creación</p>
                      <p className="text-sm font-semibold text-content">{creationLabel}</p>
                    </div>
                    <div>
                      <p className="text-xs text-content-muted">Tiempo sin asignar</p>
                      <p className="text-sm font-semibold text-content">{unassignedLabel}</p>
                    </div>
                    <div>
                      <p className="text-xs text-content-muted">Vendedor asignado</p>
                      <p className="text-sm font-semibold text-content">{assignmentDisplayName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-content-muted">Fecha de asignación</p>
                      <p className="text-sm font-semibold text-content">{assignedAtLabel}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">

                    {!isVendorMode && (
                      <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="space-y-1 text-sm text-content">
                            <span className="font-medium">Cambiar vendedor</span>
                            <Select
                              value={operationState.vendorId}
                              onChange={(event) =>
                                setOperationState((prev) => ({ ...prev, vendorId: event.target.value }))
                              }
                              disabled={!canChangeVendor}
                            >
                              <option value="">Sin asignar</option>
                              {vendorOptions.map((vendor) => (
                                <option key={vendor.id} value={vendor.id}>
                                  {vendor.label}
                                </option>
                              ))}
                            </Select>
                          </label>
                          <div className="flex items-end">
                            <Button
                              type="button"
                              onClick={handleVendorSave}
                              disabled={!vendorChanged || assignVendorMutation.isPending || !canChangeVendor}
                              isLoading={assignVendorMutation.isPending}
                            >
                              Actualizar asignaciИn
                            </Button>
                          </div>
                        </div>
                        {!canChangeVendor && (
                          <p className="text-xs text-content-muted">
                            {translate(
                              'crmLeads.drawer.vendorLocked',
                              'No puedes cambiar el vendedor en este estado.',
                            )}
                          </p>
                        )}
                      </div>
                    )}
                    {isVendorMode && (
                      <div className="rounded-xl border border-border-subtle bg-surface-muted px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">
                            {translate('crmLeads.drawer.assignmentTitle', 'AsignaciЗn')}
                          </span>
                          <p className="text-sm font-semibold text-content">
                            {assignmentDisplayName ||
                              translate('crmLeads.drawer.assignmentEmpty', 'Sin vendedor asignado')}
                          </p>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
                          <Button
                            type="button"
                            onClick={handleSelfAssign}
                            disabled={!canSelfAssign || assignVendorMutation.isPending}
                            isLoading={assignVendorMutation.isPending}
                            className="flex-1"
                          >
                            {isAssignedToCurrentUser
                              ? translate('crmLeads.drawer.alreadyAssigned', 'Ya estбs asignado')
                              : translate('crmLeads.drawer.selfAssign', 'Autoasignarme')}
                          </Button>
                          {currentAssignment && !canSelfAssign && !isAssignedToCurrentUser ? (
                            <span className="text-xs text-warning-600">
                              {translate(
                                'crmLeads.drawer.selfAssignBlocked',
                                'Lead ya asignado a otro vendedor.',
                              )}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-sm text-content">
                        <span className="font-medium">Estado del lead</span>
                        <Select
                          value={operationState.statusId}
                          onChange={(event) =>
                            setOperationState((prev) => ({ ...prev, statusId: event.target.value }))
                          }
                          disabled={!canChangeStatus}
                        >
                          <option value="">Selecciona un estado</option>
                          {statusOptions.map((status) => (
                            <option key={status.id} value={status.id}>
                              {status.label}
                            </option>
                          ))}
                        </Select>
                        {statusBlockedMessage ? (
                          <span className="text-xs text-warning-600 dark:text-warning-300">
                            {statusBlockedMessage}
                          </span>
                        ) : null}
                      </label>
                      <div className="flex flex-col items-end gap-1">
                        <Button
                          type="button"
                          onClick={handleStatusSave}
                          disabled={!statusChanged || statusMutation.isPending || !canChangeStatus}
                          isLoading={statusMutation.isPending}
                        >
                          Actualizar estado
                        </Button>
                      </div>
                    </div>

                    {!isVendorMode && (
                      <div className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-content">Asignación activa</p>
                        <p className="text-xs text-content-muted">
                          Controla si el vendedor puede gestionar este lead.
                        </p>
                      </div>
                      <Switch
                        checked={operationState.active}
                        onChange={(event) => handleAssignmentToggle(event.target.checked)}
                        disabled={!currentAssignment || assignmentStateMutation.isPending}
                      />
                    </div>
                    )}
                  </div>
                </Accordion>
              </div>
            ) : (
            <div className="space-y-3">
              <p className="text-xs text-content-muted">
                Este historial es provisional; la versión detallada se mostrará más adelante.
              </p>
              {historyQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-content-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                    Consultando historial...
                  </div>
                ) : timelineItems.length ? (
                  <ul className="relative border-l border-border-subtle pl-4">
                    {timelineItems.map((item) => (
                      <li key={item.id} className="mb-4 last:mb-0">
                        <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full bg-primary-500" />
                        <p className="text-xs text-content-muted">{item.dateLabel}</p>
                        <p className="text-sm text-content">{item.message}</p>
                      </li>
                    ))}
                  </ul>
                ) : historyQuery.isError ? (
                  <p className="text-sm text-content-muted">
                    No se pudo cargar el historial. Intenta nuevamente.
                  </p>
                ) : (
                  <p className="text-sm text-content-muted">
                    Aún no hay movimientos registrados en la asignación de este lead.
                  </p>
                )}
              </div>
            )}
          </div>
            ) : (
              <p className="text-sm text-content-muted">Selecciona un lead para ver sus detalles.</p>
            )}
            </LeadDetailDrawer>
          </div>
                ) : null}
      </div>

      <Dialog
        open={isImportDialogOpen}
        onOpenChange={handleImportDialogChange}
        title="Importar leads desde Excel"
        description="Sube tu archivo y mapea las columnas para crear leads en bloque."
      >
        <div className="space-y-4">
          {!importPreview ? (
            <>
              <div className="space-y-2">
                {importCampaignsQuery.isLoading ? (
                  <p className="text-xs text-content-muted">Cargando campañas disponibles...</p>
                ) : !hasCampaignOptions ? (
                  <Alert
                    variant="warning"
                    title="No hay campañas activas"
                    description="Crea una campaña para poder importar leads."
                    onClose={() => handleImportDialogChange(false)}
                  />
                ) : (
                  <p className="text-xs text-content-muted">
                    Luego de subir el archivo podrás elegir la campaña destino durante el mapeo.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-content">Archivo</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleImportFileInput}
                  disabled={!canUploadFile || isUploadingImport}
                  className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm"
                />
                {importError ? (
                  <p className="text-sm text-error-500">{importError}</p>
                ) : (
                  <p className="text-xs text-content-muted">Formatos soportados: CSV, XLSX, XLS (máx. 5 MB).</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={handleDownloadTemplate} isLoading={isDownloadingTemplate}>
                  Descargar plantilla
                </Button>
                <Button type="button" variant="ghost" onClick={() => handleImportDialogChange(false)}>
                  Cerrar
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-content">Vista previa detectada</p>
                  <p className="text-xs text-content-muted">
                    Ajusta el mapeo de columnas antes de confirmar la importación.
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={resetImportState} disabled={isImportProcessing}>
                  Subir otro archivo
                </Button>
              </div>
              {activeImportJob ? (
                <div className="space-y-3 rounded-lg border border-border-subtle p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-content">Procesando importación</p>
                      <p className="text-xs text-content-muted">{importProgressSummary}</p>
                    </div>
                    <span className="text-sm font-semibold text-content">{importProgressPercent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-border-subtle">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{ width: `${importProgressPercent}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap justify-between text-xs text-content-muted">
                    <span>
                      Creados: <span className="font-semibold text-content">{activeImportJob.created}</span>
                    </span>
                    <span>
                      Con errores: <span className="font-semibold text-content">{activeImportJob.failed}</span>
                    </span>
                  </div>
                  {activeImportJob.errors.length ? (
                    <div className="rounded-md bg-surface-muted/60 p-3">
                      <p className="text-xs font-semibold uppercase text-content-muted">Errores recientes</p>
                      <ul className="mt-2 space-y-1 text-xs text-content">
                        {activeImportJob.errors.slice(0, 3).map((error, index) => (
                          <li key={`import-error-${index}`}>
                            Fila {error.row || '?'}: {error.issues.join(', ')}
                          </li>
                        ))}
                      </ul>
                    </div>
                          ) : null}
                </div>
              ) : (
                <>
                  <div className="space-y-2 rounded-lg border border-border-subtle p-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-content">Campaña destino</p>
                      {selectedCampaignLabel ? (
                        <span className="text-xs text-content-muted">Seleccionada: {selectedCampaignLabel}</span>
                              ) : null}
                    </div>
                    <Select
                      label="Campaña"
                      required
                      value={selectedCampaignId}
                      onChange={(event) => setSelectedCampaignId(event.target.value)}
                      disabled={importCampaignsQuery.isLoading || !hasCampaignOptions || isImportProcessing}
                      options={[
                        { label: 'Selecciona una campaña', value: '' },
                        ...campaignOptions,
                      ]}
                    />
                    {importCampaignsQuery.isLoading ? (
                      <p className="text-xs text-content-muted">Actualizando campañas...</p>
                    ) : !hasCampaignOptions ? (
                      <Alert
                        variant="warning"
                        title="No hay campañas activas"
                        description="Crea una campaña para poder confirmar la importación."
                        onClose={() => handleImportDialogChange(false)}
                      />
                    ) : (
                      <p className="text-xs text-content-muted">
                        Selecciona la campaña que recibirá todos los leads de esta importación.
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    {REQUIRED_IMPORT_FIELDS.map((field) => (
                      <div key={field.key} className="flex flex-col gap-1 sm:flex-row sm:items-center">
                        <span className="w-full text-sm font-medium text-content sm:w-48">
                          {field.label}
                          {field.required ? (
                            <span className="text-error-500"> *</span>
                          ) : field.optionalLabel ? (
                            <span className="ml-1 text-xs font-normal text-content-muted">
                              ({field.optionalLabel})
                            </span>
                                  ) : null}
                        </span>
                        <select
                          className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm"
                          value={headerMapping[field.key] ?? ''}
                          onChange={(event) => handleMappingChange(field.key, event.target.value)}
                          disabled={isImportProcessing}
                        >
                          <option value="">Selecciona una columna</option>
                          {importPreview.headers.map((header) => (
                            <option key={`${field.key}-${header}`} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="space-y-2 rounded-lg border border-border-subtle p-3">
                <p className="text-sm font-medium text-content">Muestra de filas</p>
                <div className="max-h-60 overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-surface-muted">
                      <tr>
                        {importPreview.headers.map((header) => (
                          <th key={`header-${header}`} className="px-2 py-1 text-left font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.sampleRows.map((row, index) => (
                        <tr key={`sample-${index}`} className="odd:bg-surface even:bg-surface-muted/40">
                          {importPreview.headers.map((header) => (
                            <td key={`sample-${index}-${header}`} className="px-2 py-1">
                              {row[header] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {importError ? <p className="text-sm text-error-500">{importError}</p> : null}
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => handleImportDialogChange(false)} disabled={isImportProcessing}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmImport}
                  isLoading={isConfirmingImport || isImportProcessing}
                  disabled={!selectedCampaignId || isImportProcessing}
                >
                  {isImportProcessing ? 'Procesando...' : 'Confirmar importación'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
      <Dialog
        open={isMetaDialogOpen}
        onOpenChange={setMetaDialogOpen}
        title="Conectar con Meta Ads"
        description="Sincroniza los formularios publicitarios para recibir leads automaticamente."
      >
        <div className="space-y-3">
          <p className="text-sm text-content-muted">
            Estamos finalizando la integracion con Meta Ads. Muy pronto podras conectar tus formularios y
            recibir leads en tiempo real.
          </p>
          <Alert
            variant="info"
            title="Proximamente"
            description="Recibiras una notificacion cuando esta integracion este disponible."
            onClose={() => setMetaDialogOpen(false)}
          />
        </div>
      </Dialog>
    </>
  );
};

export default LeadsAdmin;






