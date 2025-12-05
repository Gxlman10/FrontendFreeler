import { useQuery } from '@tanstack/react-query';
import { LeadService } from '@/services/lead.service';
import type { Lead } from '@/services/lead.service';
import { useAuth } from '@/store/auth';
import { EmptyState } from '@/components/common/EmptyState';
import { Users, Target, Trophy, Activity, UserX, Sparkles } from 'lucide-react';
import { t } from '@/i18n';

export const HomeVendedor = () => {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['crm-vendedor-leads-summary', user?.id ?? null, user?.companyId ?? null, user?.type ?? null],
    enabled: Boolean(user?.id),
    queryFn: () => {
      const vendorId = user?.id ? Number(user.id) : null;
      return LeadService.listVendorUniverse({
        filters: { limit: 250, asignado_a_usuario_empresa_id: vendorId ?? undefined },
        includeEmpresa: user?.type === 'empresa',
        freelerUserId: user?.type === 'freeler' ? vendorId : null,
        empresaUserId: user?.type === 'empresa' ? vendorId : null,
      });
    },
  });

  if (!user) {
    return (
      <EmptyState
        title={t('crmVendorHome.emptyState.title')}
        description={t('crmVendorHome.emptyState.description')}
      />
    );
  }

  const leads = data ?? [];
  const lowerStatus = (lead: Lead) => (lead.estado?.nombre ?? '').toLowerCase();
  const ganados = leads.filter((lead) => lowerStatus(lead) === 'ganado').length;
  const perdidos = leads.filter((lead) => lowerStatus(lead) === 'perdido').length;
  const activos = leads.filter((lead) => {
    const status = lowerStatus(lead);
    return status !== 'ganado' && status !== 'perdido';
  }).length;
  const sinAsignar = leads.filter((lead) => !lead.asignaciones?.some((assignment) => assignment.estado === 1)).length;
  const nuevos = leads.filter((lead) => {
    if (!lead.fecha_creacion) return false;
    const created = new Date(lead.fecha_creacion).getTime();
    const diffDays = (Date.now() - created) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  }).length;
  const conversionRate = leads.length ? Math.round((ganados / leads.length) * 100) : 0;

  const statCards = [
    {
      key: 'assigned',
      label: t('crmVendorHome.kpis.assigned'),
      value: leads.length,
      icon: Users,
      accent: 'from-primary-500/10 to-transparent',
    },
    {
      key: 'inProgress',
      label: t('crmVendorHome.kpis.inProgress'),
      value: activos,
      icon: Activity,
      accent: 'from-amber-500/10 to-transparent',
    },
    {
      key: 'won',
      label: t('crmVendorHome.kpis.won'),
      value: ganados,
      icon: Trophy,
      accent: 'from-emerald-500/10 to-transparent',
    },
    {
      key: 'lost',
      label: t('crmVendorHome.kpis.lost'),
      value: perdidos,
      icon: Target,
      accent: 'from-rose-500/10 to-transparent',
    },
    {
      key: 'conversion',
      label: t('crmVendorHome.kpis.conversion'),
      value: `${conversionRate}%`,
      icon: Sparkles,
      accent: 'from-indigo-500/10 to-transparent',
    },
    {
      key: 'unassigned',
      label: t('crmVendorHome.kpis.unassigned'),
      value: sinAsignar,
      icon: UserX,
      accent: 'from-slate-500/10 to-transparent',
    },
    {
      key: 'newLeads',
      label: t('crmVendorHome.kpis.newLeads'),
      value: nuevos,
      icon: Users,
      accent: 'from-sky-500/10 to-transparent',
    },
  ];

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-content">{t('crmVendorHome.title')}</h1>
        <p className="text-sm text-content-muted">{t('crmVendorHome.subtitle')}</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <article
            key={card.key}
            className={`rounded-2xl border border-border-subtle bg-gradient-to-b ${card.accent} p-4 shadow-card`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-content-muted">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-content">{card.value}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-primary-600 dark:bg-white/10">
                <card.icon className="h-5 w-5" aria-hidden />
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default HomeVendedor;
