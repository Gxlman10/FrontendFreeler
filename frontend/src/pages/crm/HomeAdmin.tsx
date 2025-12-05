import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Award,
  Building2,
  Hourglass,
  KanbanSquare,
  LayoutDashboard,
  Percent,
  Target,
  UserCheck,
  Users2,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CampaignService } from '@/services/campaign.service';
import { LeadService } from '@/services/lead.service';
import type { Lead } from '@/services/lead.service';
import { UserService } from '@/services/user.service';
import type { UsuarioEmpresa } from '@/services/user.service';
import { APP_ROUTES, mapBackendRole, Role } from '@/utils/constants';
import { useAuth } from '@/store/auth';
import { t } from '@/i18n';

const numberFormatter = new Intl.NumberFormat('es-PE');
const formatNumber = (value: number) => numberFormatter.format(value);

const normalizeStatus = (lead: Lead) => (lead.estado?.nombre ?? '').trim().toLowerCase();
const getLeadOwnerId = (lead: Lead) => {
  const assignment = lead.asignaciones?.find((item) => item?.estado === 1);
  return (
    assignment?.id_asignado_usuario_empresa ?? assignment?.asignado?.id_usuario_empresa ?? null
  );
};

const resolveUserName = (usuario?: UsuarioEmpresa | null) => {
  if (!usuario) return '';
  const fullName = `${usuario.nombres ?? ''} ${usuario.apellidos ?? ''}`.trim();
  return fullName || usuario.email || '-';
};

type HomeAdminProps = {
  variant?: 'admin' | 'supervisor';
};

export const HomeAdmin = ({ variant = 'admin' }: HomeAdminProps) => {
  const { user } = useAuth();
  const companyId =
    user?.companyId ??
    (user && typeof (user as Record<string, unknown>).empresaId === 'number'
      ? ((user as Record<string, number>).empresaId as number)
      : (user as Record<string, any>)?.empresa?.id_empresa);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['crm-admin-dashboard', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      if (!companyId) throw new Error('MISSING_COMPANY');
      const [campaignsResponse, usersResponse, leadsResponse] = await Promise.all([
        CampaignService.getAll({ id_empresa: companyId, limit: 200 }),
        UserService.getUsuariosEmpresa({ id_empresa: companyId, limit: 500 }),
        LeadService.collectForEmpresa(companyId, {}, 250),
      ]);
      const campaigns = Array.isArray(campaignsResponse?.data)
        ? campaignsResponse.data
        : Array.isArray(campaignsResponse?.items)
          ? campaignsResponse.items
          : Array.isArray(campaignsResponse)
            ? campaignsResponse
            : [];
      const usuarios = Array.isArray(usersResponse?.data)
        ? usersResponse.data
        : Array.isArray(usersResponse?.items)
          ? usersResponse.items
          : Array.isArray(usersResponse)
            ? usersResponse
            : [];
      return {
        campaigns,
        usuarios,
        leads: leadsResponse.data,
      };
    },
  });

  const metrics = useMemo(() => {
    if (!data) {
      return {
        campaigns: 0,
        activeUsers: 0,
        vendors: {
          total: 0,
          list: [] as UsuarioEmpresa[],
        },
        leads: {
          total: 0,
          won: 0,
          lost: 0,
          pending: 0,
          assigned: 0,
        },
        topSeller: null as { name: string; won: number } | null,
      };
    }
    const activeUsers = data.usuarios.filter((usuario) => Number(usuario.estado) === 1);
    const vendors = activeUsers.filter(
      (usuario) => mapBackendRole(usuario.rol?.nombre) === Role.VENDEDOR,
    );
    const leads = data.leads ?? [];
    const wonLeads = leads.filter((lead) => normalizeStatus(lead) === 'ganado');
    const lostLeads = leads.filter((lead) => normalizeStatus(lead) === 'perdido');
    const pendingLeads = leads.filter((lead) => normalizeStatus(lead) === 'pendiente');
    const assignedLeads = leads.filter((lead) => normalizeStatus(lead) === 'asignado');

    const vendorMap = new Map<number, UsuarioEmpresa>();
    vendors.forEach((vendor) => vendorMap.set(vendor.id_usuario_empresa, vendor));

    const vendorWins = wonLeads.reduce<Record<number, number>>((acc, lead) => {
      const ownerId = getLeadOwnerId(lead);
      if (!ownerId || !vendorMap.has(ownerId)) return acc;
      acc[ownerId] = (acc[ownerId] ?? 0) + 1;
      return acc;
    }, {});

    const topVendorId = Object.entries(vendorWins)
      .sort((a, b) => b[1] - a[1])
      .map(([vendorId]) => Number(vendorId))[0];

    const topSeller = topVendorId
      ? {
          name: resolveUserName(vendorMap.get(topVendorId)),
          won: vendorWins[topVendorId] ?? 0,
        }
      : null;

    return {
      campaigns: data.campaigns.length,
      activeUsers: activeUsers.length,
      vendors: {
        total: vendors.length,
        list: vendors,
      },
      leads: {
        total: leads.length,
        won: wonLeads.length,
        lost: lostLeads.length,
        pending: pendingLeads.length,
        assigned: assignedLeads.length,
      },
      topSeller,
    };
  }, [data]);

  const statCards = useMemo(() => {
    const conversion = metrics.leads.total
      ? Math.round((metrics.leads.won / metrics.leads.total) * 100)
      : 0;
    const baseCards = [
      {
        key: 'campaigns',
        label: t('crmPanel.kpis.campaigns'),
        value: formatNumber(metrics.campaigns),
        icon: Building2,
        accent: 'from-indigo-500/10 to-transparent',
      },
      {
        key: 'activeUsers',
        label: t('crmPanel.kpis.activeUsers'),
        value: formatNumber(metrics.activeUsers),
        icon: Users2,
        accent: 'from-blue-500/10 to-transparent',
      },
      {
        key: 'vendors',
        label: t('crmPanel.kpis.vendors'),
        value: formatNumber(metrics.vendors.total),
        icon: Activity,
        accent: 'from-emerald-500/10 to-transparent',
      },
      {
        key: 'topSeller',
        label: t('crmPanel.kpis.topSeller'),
        value: metrics.topSeller?.name ?? t('common.noData'),
        icon: Award,
        accent: 'from-amber-500/10 to-transparent',
        helper: metrics.topSeller
          ? `${metrics.topSeller.won} ${t('crmPanel.kpis.topSellerLabel')}`
          : undefined,
      },
      {
        key: 'conversion',
        label: t('crmLeads.summary.winRate'),
        value: metrics.leads.total ? `${conversion}%` : t('common.noData'),
        icon: Percent,
        accent: 'from-pink-500/10 to-transparent',
      },
    ];
    const summaryIcons: Record<string, LucideIcon> = {
      total: LayoutDashboard,
      pending: Hourglass,
      assigned: UserCheck,
      win: Target,
    };
    const summaryAccents: Record<string, string> = {
      total: 'from-slate-500/10 to-transparent',
      pending: 'from-orange-500/10 to-transparent',
      assigned: 'from-cyan-500/10 to-transparent',
      win: 'from-purple-500/10 to-transparent',
    };
    const summaryCards = [
      {
        key: 'total',
        label: t('crmLeads.summary.total'),
        value: formatNumber(metrics.leads.total),
      },
      {
        key: 'pending',
        label: t('crmLeads.summary.pending'),
        value: formatNumber(metrics.leads.pending ?? 0),
      },
      {
        key: 'assigned',
        label: t('crmLeads.summary.assigned'),
        value: formatNumber(metrics.leads.assigned ?? 0),
      },
      {
        key: 'win',
        label: t('crmLeads.summary.winRate'),
        value: `${conversion}%`,
      },
    ].map((card) => ({
      ...card,
      icon: summaryIcons[card.key] ?? LayoutDashboard,
      accent: summaryAccents[card.key] ?? 'from-primary-500/10 to-transparent',
    }));
    return [...baseCards, ...summaryCards];
  }, [metrics, t]);

  if (!companyId) {
    return <p className="text-sm text-content-muted">{t('crmPanel.emptyCompany')}</p>;
  }

  if (isLoading) {
    return <p className="text-sm text-content-muted">{t('crmPanel.loading')}</p>;
  }

  if (isError || !data) {
    return <p className="text-sm text-red-500">{t('crmPanel.error')}</p>;
  }
  const isSupervisorView = variant === 'supervisor';
  const headerTitle = isSupervisorView
    ? t('crmSupervisorPanel.title', 'Panel del supervisor')
    : t('crmPanel.title');
  const headerSubtitle = isSupervisorView
    ? t('crmSupervisorPanel.subtitle', 'Monitorea el desempeño comercial de tu equipo.')
    : t('crmPanel.subtitle');

  const quickActions: Array<{
    key: string;
    label: string;
    description: string;
    href: string;
    icon: LucideIcon;
  }> = [
    {
      key: 'leads',
      label: t('crmLeads.quickActions.leads.label'),
      description: t('crmLeads.quickActions.leads.description'),
      href: APP_ROUTES.crm.leads,
      icon: LayoutDashboard,
    },
    {
      key: 'kanban',
      label: t('crmLeads.quickActions.kanban.label'),
      description: t('crmLeads.quickActions.kanban.description'),
      href: APP_ROUTES.crm.leadsKanban,
      icon: KanbanSquare,
    },
    {
      key: 'commissions',
      label: t('crmLeads.quickActions.commissions.label'),
      description: t('crmLeads.quickActions.commissions.description'),
      href: APP_ROUTES.crm.comisiones,
      icon: Wallet,
    },
  ];

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm uppercase tracking-wide text-primary-500">{t('nav.dashboard')}</p>
        <h1 className="mt-1 text-3xl font-semibold text-content">{headerTitle}</h1>
        <p className="text-sm text-content-muted">{headerSubtitle}</p>
      </header>

      <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-content-muted">
              {t('crmLeads.quickActions.title')}
            </p>
            <h2 className="text-xl font-semibold text-content">{t('crmPanel.kpis.quickLinks')}</h2>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map(({ key, label, description, href, icon: Icon }) => (
            <Link
              key={key}
              to={href}
              className="group flex items-center gap-3 rounded-xl border border-border-subtle px-3 py-3 shadow-sm transition hover:border-primary-400 hover:bg-primary-500/5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/10 text-primary-600">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-content">{label}</p>
                <p className="text-xs text-content-muted">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <article
            key={card.key}
            className={`rounded-2xl border border-border-subtle bg-gradient-to-b ${card.accent} p-4 shadow-card transition hover:shadow-card-strong`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-content-muted">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-content">{card.value}</p>
                {card.helper ? (
                  <p className="text-xs text-content-muted">{card.helper}</p>
                ) : null}
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-primary-600 dark:bg-white/10">
                <card.icon className="h-5 w-5" aria-hidden />
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default HomeAdmin;
