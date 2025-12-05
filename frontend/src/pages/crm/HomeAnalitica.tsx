import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
} from 'recharts';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, ChevronUp, PhoneCall, Target, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { LeadService } from '@/services/lead.service';
import type { Lead } from '@/services/lead.service';
import { CommissionService, type Commission } from '@/services/commission.service';
import { CampaignService } from '@/services/campaign.service';
import { UserService } from '@/services/user.service';
import type { UsuarioEmpresa } from '@/services/user.service';
import { useAuth } from '@/store/auth';
import { mapBackendRole, Role } from '@/utils/constants';
import { t } from '@/i18n';
import { FilterPanel, FilterField } from '@/components/common/FilterPanel';
import { MobileFiltersModal } from '@/components/common/MobileFiltersModal';
import { FilterToggleButton } from '@/components/common/FilterToggleButton';
import { useIsMobile } from '@/hooks/useMediaQuery';

const CURRENT_YEAR = new Date().getFullYear();
const FALLBACK_STATUSES = [
  { id_estado_lead: 1, nombre: 'Pendiente' },
  { id_estado_lead: 2, nombre: 'Asignado' },
  { id_estado_lead: 3, nombre: 'Contactado' },
  { id_estado_lead: 4, nombre: 'En gestion' },
  { id_estado_lead: 5, nombre: 'Perdido' },
  { id_estado_lead: 6, nombre: 'Ganado' },
  { id_estado_lead: 7, nombre: 'Volver a llamar' },
  { id_estado_lead: 8, nombre: 'Cita pendiente' },
  { id_estado_lead: 9, nombre: 'Cita concretada' },
  { id_estado_lead: 10, nombre: 'No contesta' },
  { id_estado_lead: 11, nombre: 'Seguimiento' },
  { id_estado_lead: 12, nombre: 'Otro producto' },
  { id_estado_lead: 13, nombre: 'No desea' },
  { id_estado_lead: 14, nombre: 'No califica' },
  { id_estado_lead: 15, nombre: 'Otros (no catalogados)' },
];

const FOLLOW_UP_STATUS_TOKENS = [
  'En gestion',
  'Seguimiento',
  'Volver a llamar',
  'Cita pendiente',
  'Cita concretada',
  'No contesta',
];

const numberFormatter = new Intl.NumberFormat('es-PE');
const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  maximumFractionDigits: 0,
});
const formatNumber = (value: number) => numberFormatter.format(value);
const formatCurrency = (value: number) => currencyFormatter.format(Math.round(value));

const normalizeStatusName = (value?: string | null) => {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

const FOLLOW_UP_STATUS_SET = new Set(FOLLOW_UP_STATUS_TOKENS.map((status) => normalizeStatusName(status)));

type AnalyticsFilters = {
  year: string;
  month: string;
  origin: string;
  campaignId: string;
  vendorId: string;
  statusId: string;
};

type AnalyticsKpiCard = {
  key: string;
  label: string;
  value: string;
  description: string;
  Icon: LucideIcon;
  accent: string;
  iconBg: string;
};

const DEFAULT_FILTERS: AnalyticsFilters = {
  year: String(CURRENT_YEAR),
  month: 'all',
  origin: 'all',
  campaignId: 'all',
  vendorId: 'all',
  statusId: 'all',
};

const ORIGIN_COLORS = ['#f97316', '#6366f1', '#0ea5e9', '#14b8a6', '#f472b6', '#facc15'];
const FUNNEL_COLORS = ['#6366f1', '#7c3aed', '#0ea5e9', '#14b8a6', '#f97316', '#f43f5e', '#6b7280'];

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

const resolveUserName = (usuario?: UsuarioEmpresa | null) => {
  if (!usuario) return '-';
  const fullName = `${usuario.nombres ?? ''} ${usuario.apellidos ?? ''}`.trim();
  return fullName || usuario.email || '-';
};

const normalizeStatus = (lead: Lead) => normalizeStatusName(lead.estado?.nombre);
const getLeadOwnerId = (lead: Lead) => {
  const assignment = lead.asignaciones?.find((item) => item?.estado === 1);
  return assignment?.id_asignado_usuario_empresa ?? assignment?.asignado?.id_usuario_empresa ?? null;
};

const matchesMonth = (rawDate?: string | null, year?: number | null, month?: number | null) => {
  if (!rawDate) return false;
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return false;
  if (year && date.getFullYear() !== year) return false;
  if (month && date.getMonth() + 1 !== month) return false;
  return true;
};

const sumAmountInRange = (
  commissions: Commission[],
  start: Date,
  end: Date,
  accessor: (commission: Commission) => string | null | undefined,
) => {
  const startTime = start.getTime();
  const endTime = end.getTime();
  return commissions.reduce((acc, commission) => {
    const raw = accessor(commission);
    if (!raw) return acc;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return acc;
    const time = date.getTime();
    if (time < startTime || time > endTime) return acc;
    const amount = Number(commission.monto ?? 0);
    return acc + (Number.isFinite(amount) ? amount : 0);
  }, 0);
};

const getCommissionGeneratedDate = (commission: Commission) => {
  const leadDate = commission.lead?.fecha_creacion ?? null;
  return commission.fecha_generada ?? leadDate ?? commission.fecha_pago ?? null;
};

const FunnelValueLabel = ({ x = 0, y = 0, width = 0, height = 0, value }: LabelProps) => {
  if (value === undefined || value === null) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  const centerX = Number(x) + Number(width) / 2;
  const centerY = Number(y) + Number(height) / 2 + 4;
  return (
    <text
      x={centerX}
      y={centerY}
      fill="var(--color-content, #0f172a)"
      fontWeight={700}
      fontSize={12}
      textAnchor="middle"
    >
      {formatNumber(Math.abs(numeric))}
    </text>
  );
};

type FunnelBarShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
};

const FunnelBarShape = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill = 'var(--color-primary, #6366f1)',
}: FunnelBarShapeProps) => {
  const radius = Math.min(height / 2, 18);
  return <rect x={x} y={y} width={width} height={height} rx={radius} fill={fill} opacity={0.95} />;
};

export const HomeAnalitica = () => {
  const { user } = useAuth();
  const companyId = user?.companyId;
  const isAdmin = user?.role === Role.ADMIN;
  const canFilterByVendor = user?.role === Role.ADMIN || user?.role === Role.SUPERVISOR;
  const [filters, setFilters] = useState<AnalyticsFilters>(DEFAULT_FILTERS);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const applyVisibility = () => setFiltersVisible(mediaQuery.matches);
    const handleChange = (event: MediaQueryListEvent) => setFiltersVisible(event.matches);
    applyVisibility();
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['crm-analytics', companyId, user?.role],
    enabled: Boolean(companyId),
    queryFn: async () => {
      if (!companyId) throw new Error('MISSING_COMPANY');
      const useEmpresaEndpoint = user?.role === Role.ADMIN || user?.role === Role.SUPERVISOR;
      const leadsPromise = useEmpresaEndpoint
        ? LeadService.collectForEmpresa(companyId, {}, 250)
        : LeadService.collectAll({ id_empresa: companyId }, 250);
      const [leadsPayload, campaignsResponse, statusesResponse, usuariosResponse] = await Promise.all([
        leadsPromise,
        CampaignService.getAll({ id_empresa: companyId, limit: 200 }),
        LeadService.getStatuses(),
        UserService.getUsuariosEmpresa({ id_empresa: companyId, limit: 500 }),
      ]);
      let commissionsPayload: { data: any[] } = { data: [] };
      try {
        commissionsPayload = await CommissionService.collectAll({ id_empresa: companyId }, 250);
      } catch (error) {
        console.warn('[CRM][Analytics] commissions fallback', error);
        try {
          commissionsPayload = await CommissionService.collectAll({}, 250);
        } catch (fallbackError) {
          console.warn('[CRM][Analytics] commissions secondary fallback', fallbackError);
          commissionsPayload = { data: [] };
        }
      }

      const campaigns = Array.isArray(campaignsResponse?.data)
        ? campaignsResponse.data
        : Array.isArray(campaignsResponse)
          ? campaignsResponse
          : [];
      const usuarios = Array.isArray(usuariosResponse?.data)
        ? usuariosResponse.data
        : Array.isArray(usuariosResponse)
          ? usuariosResponse
          : [];
      const statuses = Array.isArray(statusesResponse?.data)
        ? statusesResponse.data
        : Array.isArray(statusesResponse)
          ? statusesResponse
          : [];

      return {
        leads: leadsPayload.data,
        commissions: commissionsPayload.data,
        campaigns,
        usuarios,
        statuses,
      };
    },
  });

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    data?.leads.forEach((lead) => {
      if (!lead.fecha_creacion) return;
      const year = new Date(lead.fecha_creacion).getFullYear();
      if (Number.isFinite(year)) years.add(String(year));
    });
    data?.commissions.forEach((commission) => {
      if (!commission.fecha_pago) return;
      const year = new Date(commission.fecha_pago).getFullYear();
      if (Number.isFinite(year)) years.add(String(year));
    });
    if (!years.size) {
      years.add(String(CURRENT_YEAR));
    }
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [data]);

  useEffect(() => {
    if (!availableYears.length) return;
    if (filters.year !== 'all' && !availableYears.includes(filters.year)) {
      setFilters((prev) => ({ ...prev, year: availableYears[0] ?? 'all' }));
    }
  }, [availableYears, filters.year]);

  const vendors = useMemo(
    () =>
      (data?.usuarios ?? []).filter(
        (usuario) => mapBackendRole(usuario.rol?.nombre) === Role.VENDEDOR,
      ),
    [data?.usuarios],
  );

  const statusesCatalog = useMemo(() => {
    const catalog = data?.statuses?.length ? data.statuses : FALLBACK_STATUSES;
    return catalog;
  }, [data?.statuses]);

  const campaignOptions = useMemo(() => {
    const base = [{ value: 'all', label: t('common.allCampaigns') }];
    const items =
      data?.campaigns?.map((campaign) => ({
        value: String(campaign.id_campania),
        label: campaign.nombre,
      })) ?? [];
    return base.concat(items);
  }, [data?.campaigns]);

  const originOptions = useMemo(() => {
    const entries = new Map<string, string>();
    data?.leads?.forEach((lead) => {
      if (!lead.origen) return;
      const normalized = lead.origen.trim().toLowerCase();
      if (!entries.has(normalized)) {
        entries.set(normalized, lead.origen);
      }
    });
    return [
      { value: 'all', label: t('common.allOrigins') },
      ...Array.from(entries.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [data?.leads]);

  const vendorOptions = useMemo(() => {
    return [
      { value: 'all', label: t('common.allVendors') },
      ...vendors.map((vendor) => ({
        value: String(vendor.id_usuario_empresa),
        label: resolveUserName(vendor),
      })),
    ];
  }, [vendors]);

  const statusOptions = useMemo(() => {
    return [
      { value: 'all', label: t('common.allStatuses') },
      ...statusesCatalog.map((status) => ({
        value: String(status.id_estado_lead),
        label: status.nombre,
      })),
    ];
  }, [statusesCatalog]);

  const monthOptions = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, index) => {
      const monthNumber = index + 1;
      return {
        value: String(monthNumber),
        label: t(`common.months.${monthNumber}`),
      };
    });
    return [{ value: 'all', label: t('common.allMonths') }, ...months];
  }, []);

  const yearOptions = useMemo(() => {
    return [
      { value: 'all', label: t('common.all') },
      ...availableYears.map((year) => ({ value: year, label: year })),
    ];
  }, [availableYears]);

  const yearFilter = filters.year === 'all' ? null : Number(filters.year);
  const monthFilter = filters.month === 'all' ? null : Number(filters.month);

  const leadById = useMemo(() => {
    const map = new Map<number, Lead>();
    data?.leads?.forEach((lead) => {
      map.set(lead.id_lead, lead);
    });
    return map;
  }, [data?.leads]);

  const matchDate = useCallback((rawDate?: string | null) => {
    if (!rawDate) return false;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return false;
    if (yearFilter && date.getFullYear() !== yearFilter) return false;
    if (monthFilter && date.getMonth() + 1 !== monthFilter) return false;
    return true;
  }, [yearFilter, monthFilter]);

  const filteredLeads = useMemo(() => {
    if (!data?.leads?.length) return [];
    return data.leads.filter((lead) => {
      if (!matchDate(lead.fecha_creacion)) return false;
      if (filters.origin !== 'all') {
        const normalized = (lead.origen ?? '').trim().toLowerCase();
        if (normalized !== filters.origin) return false;
      }
      if (filters.campaignId !== 'all' && Number(filters.campaignId) !== lead.id_campania) {
        return false;
      }
      if (filters.statusId !== 'all' && Number(filters.statusId) !== lead.id_estado_lead) {
        return false;
      }
      if (filters.vendorId !== 'all') {
        const ownerId = getLeadOwnerId(lead);
        if (ownerId !== Number(filters.vendorId)) return false;
      }
      return true;
    });
  }, [data?.leads, filters, matchDate]);

  const matchesCommissionFilters = useCallback(
    (commission: Commission) => {
      if (filters.campaignId !== 'all' && Number(filters.campaignId) !== commission.id_campania) {
        return false;
      }
      if (filters.vendorId !== 'all') {
        const lead = commission.id_lead ? leadById.get(commission.id_lead) : null;
        const ownerId = lead ? getLeadOwnerId(lead) : null;
        if (ownerId !== Number(filters.vendorId)) return false;
      }
      return true;
    },
    [filters.campaignId, filters.vendorId, leadById],
  );

  const commissionsMatchingFilters = useMemo(
    () => (data?.commissions ?? []).filter(matchesCommissionFilters),
    [data?.commissions, matchesCommissionFilters],
  );

  const filteredCommissions = useMemo(
    () => commissionsMatchingFilters.filter((commission) => matchDate(commission.fecha_pago)),
    [commissionsMatchingFilters, matchDate],
  );

  const leadsByCampaign = useMemo(() => {
    if (!filteredLeads.length) return [];
    const labels = new Map<number, string>();
    (data?.campaigns ?? []).forEach((campaign) => {
      labels.set(campaign.id_campania, campaign.nombre);
    });
    const counts = new Map<string, number>();
    filteredLeads.forEach((lead) => {
      const label =
        labels.get(lead.id_campania ?? 0) ?? lead.campania?.nombre ?? t('common.campaign');
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredLeads, data?.campaigns]);

  const leadsByOriginData = useMemo(() => {
    if (!filteredLeads.length) return [];
    const fallback = t('crmAnalytics.charts.noOrigin');
    const counts = new Map<string, number>();
    filteredLeads.forEach((lead) => {
      const label = lead.origen?.trim() || fallback;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredLeads]);

  const funnelChartData = useMemo(() => {
    return statusesCatalog.map((status) => ({
      label: status.nombre,
      value: filteredLeads.filter((lead) => lead.id_estado_lead === status.id_estado_lead).length,
    }));
  }, [filteredLeads, statusesCatalog]);
  const funnelMaxValue = useMemo(
    () => funnelChartData.reduce((max, entry) => Math.max(max, entry.value), 0),
    [funnelChartData],
  );

  const vendorCards = useMemo(() => {
    const cards = vendors.map((vendor) => {
      const vendorLeads = filteredLeads.filter(
        (lead) => getLeadOwnerId(lead) === vendor.id_usuario_empresa,
      );
      const assigned = vendorLeads.length;
      const won = vendorLeads.filter((lead) => normalizeStatus(lead) === 'ganado').length;
      const lost = vendorLeads.filter((lead) => normalizeStatus(lead) === 'perdido').length;
      const winRate = assigned ? Math.round((won / assigned) * 100) : 0;
      return {
        id: vendor.id_usuario_empresa,
        name: resolveUserName(vendor),
        email: vendor.email,
        assigned,
        won,
        lost,
        winRate,
      };
    });
    if (filters.vendorId === 'all') {
      return cards;
    }
    return cards.filter((card) => String(card.id) === filters.vendorId);
  }, [vendors, filteredLeads, filters.vendorId]);

  const filteredWonLeads = filteredLeads.filter((lead) => normalizeStatus(lead) === 'ganado');
  const totalLeads = filteredLeads.length;
  const totalWon = filteredWonLeads.length;
  const conversionRate = totalLeads ? Math.round((totalWon / totalLeads) * 100) : 0;
  const campaignCount = useMemo(() => {
    const unique = new Set<number>();
    filteredLeads.forEach((lead) => {
      if (typeof lead.id_campania === 'number') unique.add(lead.id_campania);
    });
    return unique.size;
  }, [filteredLeads]);
  const followUpCount = useMemo(
    () => filteredLeads.filter((lead) => FOLLOW_UP_STATUS_SET.has(normalizeStatus(lead))).length,
    [filteredLeads],
  );
  const totalPaidCommissions = useMemo(
    () =>
      filteredCommissions.reduce((acc, commission) => {
        const amount = Number(commission.monto ?? 0);
        return acc + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [filteredCommissions],
  );
  const totalGeneratedCommissions = useMemo(
    () =>
      commissionsMatchingFilters.reduce((acc, commission) => {
        const rawDate = getCommissionGeneratedDate(commission);
        if (!matchDate(rawDate)) return acc;
        const amount = Number(commission.monto ?? 0);
        return acc + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [commissionsMatchingFilters, matchDate],
  );
  const monthlyCommissionData = useMemo(() => {
    const today = new Date();
    const targetYear = yearFilter ?? today.getFullYear();
    return Array.from({ length: 12 }, (_, index) => {
      const start = new Date(targetYear, index, 1, 0, 0, 0, 0);
      const end = new Date(targetYear, index + 1, 0, 23, 59, 59, 999);
      const monthNumber = index + 1;
      const label = t(`common.months.${monthNumber}`);
      const pagadas = sumAmountInRange(
        commissionsMatchingFilters,
        start,
        end,
        (commission) => commission.fecha_pago,
      );
      const generadas = sumAmountInRange(
        commissionsMatchingFilters,
        start,
        end,
        (commission) => getCommissionGeneratedDate(commission),
      );
      return {
        label,
        pagadas: Number(pagadas.toFixed(2)),
        generadas: Number(generadas.toFixed(2)),
      };
    });
  }, [commissionsMatchingFilters, t, yearFilter]);
  const hasMonthlyCommissionData = monthlyCommissionData.some(
    (entry) => entry.pagadas > 0 || entry.generadas > 0,
  );
  const kpiCards = useMemo<AnalyticsKpiCard[]>(() => {
    return [
      {
        key: 'leads',
        label: t('crmAnalytics.kpis.leads'),
        value: formatNumber(totalLeads),
        description: t('crmAnalytics.kpis.leadsDescription', {
          campaigns: formatNumber(campaignCount || 0),
        }),
        Icon: Users,
        accent: 'text-indigo-500 dark:text-indigo-300',
        iconBg: 'bg-indigo-100 dark:bg-indigo-400/15',
      },
      {
        key: 'conversion',
        label: t('crmAnalytics.kpis.conversion'),
        value: totalLeads ? `${conversionRate}%` : '0%',
        description: t('crmAnalytics.kpis.conversionDescription', {
          won: formatNumber(totalWon),
        }),
        Icon: Target,
        accent: 'text-emerald-500 dark:text-emerald-300',
        iconBg: 'bg-emerald-100 dark:bg-emerald-400/15',
      },
      {
        key: 'followUp',
        label: t('crmAnalytics.kpis.followUp'),
        value: formatNumber(followUpCount),
        description: t('crmAnalytics.kpis.followUpDescription'),
        Icon: PhoneCall,
        accent: 'text-sky-500 dark:text-sky-300',
        iconBg: 'bg-sky-100 dark:bg-sky-400/15',
      },
      {
        key: 'revenue',
        label: t('crmAnalytics.kpis.revenue'),
        value: formatCurrency(totalPaidCommissions),
        description: t('crmAnalytics.kpis.revenueDescription', {
          amount: formatCurrency(totalGeneratedCommissions),
        }),
        Icon: TrendingUp,
        accent: 'text-amber-500 dark:text-amber-300',
        iconBg: 'bg-amber-100 dark:bg-amber-400/15',
      },
    ];
  }, [
    campaignCount,
    conversionRate,
    followUpCount,
    t,
    totalGeneratedCommissions,
    totalLeads,
    totalPaidCommissions,
    totalWon,
  ]);
  const funnelGradientId = useMemo(
    () => `funnel-bar-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );
  const hasFunnelData = funnelChartData.some((entry) => entry.value > 0);

  if (!companyId) {
    return <p className="text-sm text-content-muted">{t('crmPanel.emptyCompany')}</p>;
  }

  if (isLoading) {
    return <p className="text-sm text-content-muted">{t('crmAnalytics.loading')}</p>;
  }

  if (isError || !data) {
    return <p className="text-sm text-red-500">{t('crmAnalytics.error')}</p>;
  }

  const filtersPanel = (
    <FilterPanel>
      <FilterField>
        <Select
          label={t('crmAnalytics.filters.year')}
          value={filters.year}
          onChange={(event) => setFilters((prev) => ({ ...prev, year: event.target.value }))}
          options={yearOptions}
          className="w-full"
        />
      </FilterField>
      <FilterField>
        <Select
          label={t('crmAnalytics.filters.month')}
          value={filters.month}
          onChange={(event) => setFilters((prev) => ({ ...prev, month: event.target.value }))}
          options={monthOptions}
          className="w-full"
        />
      </FilterField>
      {isAdmin && (
        <FilterField>
          <Select
            label={t('crmAnalytics.filters.origin')}
            value={filters.origin}
            onChange={(event) => setFilters((prev) => ({ ...prev, origin: event.target.value }))}
            options={originOptions}
            className="w-full"
          />
        </FilterField>
      )}
      <FilterField>
        <Select
          label={t('crmAnalytics.filters.campaign')}
          value={filters.campaignId}
          onChange={(event) => setFilters((prev) => ({ ...prev, campaignId: event.target.value }))}
          options={campaignOptions}
          className="w-full"
        />
      </FilterField>
      {canFilterByVendor && (
        <FilterField>
          <Select
            label={t('crmAnalytics.filters.vendor')}
            value={filters.vendorId}
            onChange={(event) => setFilters((prev) => ({ ...prev, vendorId: event.target.value }))}
            options={vendorOptions}
            className="w-full"
          />
        </FilterField>
      )}
      <FilterField>
        <Select
          label={t('crmAnalytics.filters.status')}
          value={filters.statusId}
          onChange={(event) => setFilters((prev) => ({ ...prev, statusId: event.target.value }))}
          options={statusOptions}
          className="w-full"
        />
      </FilterField>
    </FilterPanel>
  );

  return (
    <>
    <section className="space-y-6">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-content">{t('crmAnalytics.title')}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterToggleButton
            label={t('crmLeads.actions.filters', 'Filtros')}
            expanded={filtersVisible}
            isMobile={isMobile}
            onToggle={() => {
              if (isMobile) {
                setIsMobileFiltersOpen(true);
              } else {
                setFiltersVisible((prev) => !prev);
              }
            }}
          />
        </div>
      </header>

      {!isMobile && filtersVisible ? filtersPanel : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.Icon;
          return (
            <div
              key={card.key}
              className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm dark:bg-surface"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-content">{card.value}</p>
                </div>
                <span className={`rounded-2xl p-2 ${card.iconBg}`}>
                  <Icon className={`h-5 w-5 ${card.accent}`} />
                </span>
              </div>
              <p className="mt-2 text-sm text-content-muted">{card.description}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-primary-500">
                  {t('crmAnalytics.charts.commissionHint')}
                </p>
                <h2 className="text-2xl font-semibold text-content">
                  {t('crmAnalytics.charts.commissionLine')}
                </h2>
              </div>
              <span className="rounded-full border border-border-subtle px-3 py-1 text-xs font-semibold text-content-muted">
                Año {yearFilter ?? CURRENT_YEAR}
              </span>
            </div>
            <div className="h-[360px]">
              {hasMonthlyCommissionData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyCommissionData} margin={{ top: 24, right: 32, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(value) => formatCurrency(Number(value))} />
                    <Tooltip
                      formatter={(value: number, key: string) => [
                        formatCurrency(Number(value)),
                        key === 'generadas'
                          ? t('crmAnalytics.charts.commissionsGenerated')
                          : t('crmAnalytics.charts.commissionsPaid'),
                      ]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="generadas"
                      name={t('crmAnalytics.charts.commissionsGenerated')}
                      stroke="#fbbf24"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="pagadas"
                      name={t('crmAnalytics.charts.commissionsPaid')}
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-content-muted">{t('crmAnalytics.empty')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-content">{t('crmAnalytics.charts.leadsByCampaign')}</h2>
              <span className="text-xs text-content-muted">
                {t('crmAnalytics.kpis.leads')}: {formatNumber(filteredLeads.length)}
              </span>
            </div>
            <div className="h-[360px]">
              {leadsByCampaign.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={leadsByCampaign}
                    layout="vertical"
                    margin={{ left: 12, right: 12, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="2 2" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={140} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#10b981" radius={[0, 8, 8, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-content-muted">{t('crmAnalytics.empty')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={`grid gap-4 ${isAdmin ? 'lg:grid-cols-2' : ''}`}>
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-content">{t('crmAnalytics.charts.leadsByStatus')}</h2>
              <span className="text-xs text-content-muted">
                {t('crmAnalytics.kpis.leads')}: {formatNumber(filteredLeads.length)}
              </span>
            </div>
            <div className="h-80">
              {hasFunnelData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={funnelChartData}
                    layout="vertical"
                    margin={{ top: 16, bottom: 8, left: 0, right: 32 }}
                  >
                    <defs>
                      <linearGradient id={funnelGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#c7d2fe" />
                        <stop offset="100%" stopColor="#6366f1" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid horizontal={false} strokeDasharray="2 2" />
                    <XAxis type="number" domain={[0, funnelMaxValue || 1]} hide />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={180}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--color-content-muted, #475569)', fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        formatNumber(Number(value)),
                        t('crmAnalytics.kpis.leads'),
                      ]}
                    />
                    <Bar
                      dataKey="value"
                      fill={`url(#${funnelGradientId})`}
                      barSize={36}
                      shape={(props) => <FunnelBarShape {...props} />}
                    >
                      <LabelList dataKey="value" content={(props) => <FunnelValueLabel {...props} />} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-content-muted">{t('crmAnalytics.empty')}</p>
              )}
            </div>
          </CardContent>
        </Card>
        {isAdmin && (
          <Card>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-content">{t('crmAnalytics.charts.leadsByOrigin')}</h2>
                <p className="text-xs text-content-muted">
                  {t('crmAnalytics.charts.leadsByOriginMonthHint')}
                </p>
              </div>
              <div className="h-80">
                {leadsByOriginData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leadsByOriginData} margin={{ left: 8, right: 8, top: 16, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} height={60} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]} barSize={28}>
                        {leadsByOriginData.map((entry, index) => (
                          <Cell key={`${entry.label}-${index}`} fill={ORIGIN_COLORS[index % ORIGIN_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-content-muted">{t('crmAnalytics.empty')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        <Card className={isAdmin ? 'lg:col-span-2' : undefined}>
          <CardContent className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-content">{t('crmAnalytics.charts.vendorPerformance')}</h2>
              <p className="text-sm text-content-muted">{t('crmAnalytics.charts.vendorPerformanceHint')}</p>
            </div>
            {vendorCards.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {vendorCards.map((card) => (
                  <div
                    key={card.id}
                    className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-lg font-semibold text-primary-600">
                          {getInitials(card.name)}
                        </div>
                        <div>
                          <p className="text-base font-semibold text-content">{card.name}</p>
                          <p className="text-sm text-content-muted">{card.email ?? '-'}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-primary-600">{card.winRate}%</span>
                    </div>
                    <div className="mt-4 h-2 w-full rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{ width: `${Math.min(card.winRate, 100)}%` }}
                      />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-content-muted">{t('crmAnalytics.vendorCard.assigned')}</dt>
                        <dd className="text-lg font-semibold text-content">{card.assigned}</dd>
                      </div>
                      <div>
                        <dt className="text-content-muted">{t('crmAnalytics.vendorCard.won')}</dt>
                        <dd className="text-lg font-semibold text-emerald-600">{card.won}</dd>
                      </div>
                      <div>
                        <dt className="text-content-muted">{t('crmAnalytics.vendorCard.lost')}</dt>
                        <dd className="text-lg font-semibold text-red-500">{card.lost}</dd>
                      </div>
                      <div>
                        <dt className="text-content-muted">{t('crmAnalytics.vendorCard.winRate')}</dt>
                        <dd className="text-lg font-semibold text-primary-600">{card.winRate}%</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-content-muted">{t('crmAnalytics.empty')}</p>
            )}
          </CardContent>
        </Card>
      </div>
      </section>
      {isMobile && (
        <MobileFiltersModal
          open={isMobileFiltersOpen}
          onOpenChange={setIsMobileFiltersOpen}
        >
          {filtersPanel}
        </MobileFiltersModal>
      )}
    </>
  );
};

export default HomeAnalitica;
