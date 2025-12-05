import { FormEvent, useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { LeadService } from '@/services/lead.service';
import { CommissionService, type Commission } from '@/services/commission.service';
import { EmptyState } from '@/components/common/EmptyState';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/common/Toasts';
import { formatCurrency } from '@/utils/helpers';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/common/Alert';
import { Users, FileEdit, Send, Percent, Wallet, Clock3, CheckCircle2 } from 'lucide-react';

const EMPTY_SUMMARY = {
  totals: {
    pendiente: 0,
    solicitada: 0,
    pagada: 0,
  },
  byCampaign: [],
  commissions: [],
};

const COMMISSION_STATUS_META: Record<
  number,
  { label: string; badge: 'warning' | 'info' | 'success' | 'neutral'; code: 'pending' | 'requested' | 'paid' | 'other' }
> = {
  1: { label: 'Pendiente', badge: 'warning', code: 'pending' },
  2: { label: 'Solicitada', badge: 'info', code: 'requested' },
  3: { label: 'Pagada', badge: 'success', code: 'paid' },
};

const getCommissionStatusMeta = (commission?: Commission | null) => {
  if (!commission) return { label: 'Sin estado', badge: 'neutral', code: 'other' as const };
  return COMMISSION_STATUS_META[commission.id_estado_comision ?? 0] ?? {
    label: 'Sin estado',
    badge: 'neutral',
    code: 'other' as const,
  };
};

const getCommissionLeadName = (commission?: Commission | null) => {
  if (!commission) return 'Lead';
  const first = commission.lead?.nombres ?? '';
  const last = commission.lead?.apellidos ?? '';
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (commission.id_lead) return `Lead #${commission.id_lead}`;
  return 'Lead';
};

type PaymentContext = {
  mode: 'bulk' | 'single';
  commission: Commission | null;
};

type PaymentPayload = {
  metodo_pago: 'yape' | 'transferencia';
  telefono_yape?: string;
  nombres_yape?: string;
  cci?: string;
  titular?: string;
  banco?: string;
  notas?: string;
  commissionIds?: number[];
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return 'Sin registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin registro';
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const numberFormatter = new Intl.NumberFormat('es-PE');
const formatNumber = (value: number) => numberFormatter.format(value);

export const DashboardReferidos = () => {
  const { user } = useAuth();
  const { push } = useToast();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [method, setMethod] = useState<'yape' | 'transferencia'>('yape');
  const [form, setForm] = useState({
    telefono_yape: '',
    nombres_yape: '',
    cci: '',
    titular: '',
    banco: '',
    notas: '',
  });
  const [paymentContext, setPaymentContext] = useState<PaymentContext>({ mode: 'bulk', commission: null });

  const resetPaymentForm = () => {
    setMethod('yape');
    setForm({
      telefono_yape: '',
      nombres_yape: '',
      cci: '',
      titular: '',
      banco: '',
      notas: '',
    });
  };

  const buildPaymentPayload = useCallback(
    (): PaymentPayload => ({
      metodo_pago: method,
      telefono_yape: method === 'yape' ? form.telefono_yape.trim() || undefined : undefined,
      nombres_yape: method === 'yape' ? form.nombres_yape.trim() || undefined : undefined,
      cci: method === 'transferencia' ? form.cci.trim() || undefined : undefined,
      titular: method === 'transferencia' ? form.titular.trim() || undefined : undefined,
      banco: method === 'transferencia' ? form.banco.trim() || undefined : undefined,
      notas: form.notas.trim() || undefined,
    }),
    [form.banco, form.cci, form.nombres_yape, form.notas, form.telefono_yape, form.titular, method],
  );

  const leadsQuery = useQuery({
    queryKey: ['leads-mine-dashboard', user?.id],
    queryFn: () => LeadService.listMine(user?.id ?? 0),
    enabled: Boolean(user?.id),
  });

  const summaryQuery = useQuery({
    queryKey: ['freeler-commission-summary', user?.id],
    queryFn: () => CommissionService.getMySummary(user?.id),
    enabled: Boolean(user?.id && user.type === 'freeler'),
  });

  const requestBulkMutation = useMutation({
    mutationFn: (payload: PaymentPayload) => CommissionService.requestMyPayout(payload),
    onSuccess: () => {
      push({ title: 'Solicitud registrada', description: 'Pronto revisaremos tu solicitud.' });
      summaryQuery.refetch();
      setDialogOpen(false);
      resetPaymentForm();
      setPaymentContext({ mode: 'bulk', commission: null });
    },
    onError: () => {
      push({
        title: 'No se pudo solicitar el cobro',
        description: 'Revisa los datos e intenta nuevamente.',
        variant: 'danger',
      });
    },
  });

  const requestSingleMutation = useMutation({
    mutationFn: ({ commissionId, payload }: { commissionId: number; payload: PaymentPayload }) =>
      CommissionService.requestPayout(commissionId, payload),
    onSuccess: () => {
      push({ title: 'Solicitud registrada', description: 'Estamos revisando tu comisión.' });
      summaryQuery.refetch();
      setDialogOpen(false);
      resetPaymentForm();
      setPaymentContext({ mode: 'bulk', commission: null });
    },
    onError: () => {
      push({
        title: 'No se pudo solicitar el cobro',
        description: 'Revisa los datos de pago e intenta nuevamente.',
        variant: 'danger',
      });
    },
  });

  const leads = useMemo(() => {
    const data = leadsQuery.data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data)) return data;
    return [];
  }, [leadsQuery.data]);

  if (!user) {
    return (
      <EmptyState
        title="Inicia sesión"
        description="Necesitas iniciar sesión para ver tus métricas."
      />
    );
  }

  const draftsCount = leads.filter((lead) => lead.estado_completo === false).length;
  const sentLeads = leads.filter((lead) => lead.estado_completo !== false);
  const sentCount = sentLeads.length;
  const wonCount = sentLeads.filter(
    (lead) => lead.estado?.nombre?.toLowerCase() === 'ganado',
  ).length;
  const conversion = sentCount ? Math.round((wonCount / sentCount) * 100) : 0;
  const lastSentTimestamp = sentLeads.reduce((latest, lead) => {
    const createdAt = lead.fecha_creacion ? new Date(lead.fecha_creacion).getTime() : 0;
    return createdAt > latest ? createdAt : latest;
  }, 0);
  const lastSentFormatted = lastSentTimestamp
    ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(
        lastSentTimestamp,
      )
    : 'Sin registros';

  const summary = summaryQuery.data ?? EMPTY_SUMMARY;
  const commissions = summary.commissions ?? [];
  const pendingCommissionIds = useMemo(
    () =>
      commissions
        .filter((commission) => getCommissionStatusMeta(commission).code === 'pending')
        .map((commission) => commission.id_comision),
    [commissions],
  );
  const pendingAmount = Number(summary.totals.pendiente ?? 0);
  const isSubmitting = requestBulkMutation.isPending || requestSingleMutation.isPending;
  const canRequestBulk = pendingCommissionIds.length > 0 && !isSubmitting;
  const hasLeads = leads.length > 0;
  const dialogTitle =
    paymentContext.mode === 'single' ? 'Solicitar pago individual' : 'Solicitar cobro';
  const dialogDescription =
    paymentContext.mode === 'single'
      ? 'Confirma los datos para solicitar el pago de esta comision.'
      : 'Completa tus datos de pago para solicitar todas las comisiones pendientes.';
  const handleOpenBulkDialog = () => {
    if (!pendingCommissionIds.length) return;
    setPaymentContext({ mode: 'bulk', commission: null });
    setDialogOpen(true);
  };
  const handleOpenSingleDialog = (commission: Commission) => {
    setPaymentContext({ mode: 'single', commission });
    setDialogOpen(true);
  };
  const closeDialog = () => {
    if (isSubmitting) return;
    setDialogOpen(false);
    setPaymentContext({ mode: 'bulk', commission: null });
  };
  const handleDialogSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    const payload = buildPaymentPayload();
    if (paymentContext.mode === 'single' && paymentContext.commission) {
      requestSingleMutation.mutate({
        commissionId: paymentContext.commission.id_comision,
        payload,
      });
      return;
    }
    if (!pendingCommissionIds.length) return;
    requestBulkMutation.mutate({
      ...payload,
      commissionIds: pendingCommissionIds,
    });
  };
  const dialogSubmitDisabled =
    isSubmitting ||
    (paymentContext.mode === 'single' ? !paymentContext.commission : pendingCommissionIds.length === 0);
  const dialogSubmitLabel = isSubmitting
    ? 'Enviando...'
    : paymentContext.mode === 'single'
      ? 'Solicitar pago'
      : 'Solicitar pendientes';

  const statCards = [
    {
      key: 'totalLeads',
      label: 'Referidos totales',
      value: formatNumber(leads.length),
      icon: Users,
      accent: 'from-primary-500/10 to-transparent',
    },
    {
      key: 'drafts',
      label: 'Borradores pendientes',
      value: formatNumber(draftsCount),
      icon: FileEdit,
      accent: 'from-amber-500/10 to-transparent',
    },
    {
      key: 'sent',
      label: 'Referidos enviados',
      value: formatNumber(sentCount),
      icon: Send,
      accent: 'from-sky-500/10 to-transparent',
      helper: sentCount ? `${wonCount} ganados` : undefined,
    },
    {
      key: 'conversion',
      label: 'Conversión',
      value: `${conversion}%`,
      icon: Percent,
      accent: 'from-indigo-500/10 to-transparent',
      helper: sentCount ? 'sobre enviados' : undefined,
    },
  ];

  const commissionCards = [
    {
      key: 'pending',
      label: 'Pendiente',
      value: formatCurrency(pendingAmount),
      icon: Clock3,
      accent: 'from-orange-500/10 to-transparent',
    },
    {
      key: 'requested',
      label: 'Solicitado',
      value: formatCurrency(Number(summary.totals.solicitada || 0)),
      icon: Wallet,
      accent: 'from-blue-500/10 to-transparent',
    },
    {
      key: 'paid',
      label: 'Pagado',
      value: formatCurrency(Number(summary.totals.pagada || 0)),
      icon: CheckCircle2,
      accent: 'from-emerald-500/10 to-transparent',
    },
  ];

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-content">Mi panel</h1>
        <p className="text-sm text-content-muted">
          Seguimiento rápido de tus referidos y comisiones generadas.
        </p>
      </header>

      {hasLeads ? (
        <>
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
                    {card.helper ? (
                      <p className="text-xs text-content-muted">{card.helper}</p>
                    ) : null}
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-primary-600 dark:bg-white/10">
                    <card.icon className="h-5 w-5" aria-hidden />
                  </span>
                </div>
              </article>
            ))}
          </div>

          <div className="grid gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm lg:grid-cols-2">
            <div>
              <h2 className="text-lg font-semibold text-content">Actividad de referidos</h2>
              <p className="mt-1 text-sm text-content-muted">
                Un vistazo rápido a tu desempeño reciente. Mantén tus registros actualizados para
                acelerar tus oportunidades.
              </p>
              <dl className="mt-6 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-lg border border-border-subtle bg-field p-3">
                  <dt className="text-content-muted">Ganados</dt>
                  <dd className="text-xl font-semibold text-content">{wonCount}</dd>
                </div>
                <div className="rounded-lg border border-border-subtle bg-field p-3">
                  <dt className="text-content-muted">En gestión</dt>
                  <dd className="text-xl font-semibold text-content">
                    {Math.max(sentCount - wonCount, 0)}
                  </dd>
                </div>
                <div className="rounded-lg border border-border-subtle bg-field p-3">
                  <dt className="text-content-muted">Borradores listos</dt>
                  <dd className="text-xl font-semibold text-content">{draftsCount}</dd>
                </div>
                <div className="rounded-lg border border-border-subtle bg-field p-3">
                  <dt className="text-content-muted">Enviados totales</dt>
                  <dd className="text-xl font-semibold text-content">{sentCount}</dd>
                </div>
              </dl>
            </div>
            <div className="flex flex-col justify-between rounded-lg border border-primary-500/40 bg-gradient-to-b from-primary-500/10 to-transparent p-4 text-sm text-content">
              <div>
                <p className="text-content-muted">Último envío</p>
                <p className="mt-2 text-2xl font-semibold text-content">{lastSentFormatted}</p>
              </div>
              <p className="mt-4 text-content-muted">
                Ganados confirmados: <span className="font-semibold text-content">{wonCount}</span>.
                {` `}
                {wonCount ? 'Sigue gestionando para mantener la racha.' : 'Aprovecha para contactar tus referidos.'}
              </p>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title="Aún no hay datos"
          description="Cuando registres referidos verás tus métricas aquí."
        />
      )}

      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-content">Mis comisiones</h2>
            <p className="text-sm text-content-muted">
                Resumen de los montos acumulados por tus campanas.
            </p>
          </div>
          <Button type="button" disabled={!canRequestBulk} onClick={handleOpenBulkDialog}>
            Solicitar cobro
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {commissionCards.map((card) => (
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
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-content-muted">
                <th className="pb-2">Campaña</th>
                <th className="pb-2">Pendiente</th>
                <th className="pb-2">Pagado</th>
                <th className="pb-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {summary.byCampaign.map((row) => (
                <tr key={row.id_campania ?? row.nombre}>
                  <td className="py-2 font-medium text-content">{row.nombre}</td>
                  <td className="py-2 text-content-muted">{formatCurrency(Number(row.pendiente))}</td>
                  <td className="py-2 text-content-muted">{formatCurrency(Number(row.pagada))}</td>
                  <td className="py-2 font-semibold text-content">{formatCurrency(Number(row.total))}</td>
                </tr>
              ))}
              {!summary.byCampaign.length && (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-content-muted">
                    Aún no generas comisiones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-content">Historial de comisiones</h2>
            <p className="text-sm text-content-muted">
              Consulta cada comision registrada y solicita el pago individual cuando corresponda.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!canRequestBulk}
            onClick={handleOpenBulkDialog}
          >
            Solicitar pendientes
          </Button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-content-muted">
                <th className="pb-2">Campaña</th>
                <th className="pb-2">Lead</th>
                <th className="pb-2">Monto</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2">Fecha de pago</th>
                <th className="pb-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {commissions.length ? (
                commissions.map((commission) => {
                  const statusMeta = getCommissionStatusMeta(commission);
                  const leadName = getCommissionLeadName(commission);
                  return (
                    <tr key={commission.id_comision}>
                      <td className="py-2 font-medium text-content">
                        {commission.campania?.nombre ?? 'Sin campaña'}
                      </td>
                      <td className="py-2 text-content">{leadName}</td>
                      <td className="py-2 text-content">
                        {formatCurrency(Number(commission.monto ?? 0))}
                      </td>
                      <td className="py-2">
                        <Badge variant={statusMeta.badge}>{statusMeta.label}</Badge>
                      </td>
                      <td className="py-2 text-content-muted">
                        {statusMeta.code === 'paid' ? formatDateLabel(commission.fecha_pago) : 'Pendiente'}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={statusMeta.code !== 'pending' || isSubmitting}
                          onClick={() => handleOpenSingleDialog(commission)}
                        >
                          Solicitar pago
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-3 text-center text-content-muted">
                    Aún no se registran comisiones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (isSubmitting) return;
          setDialogOpen(open);
          if (!open) {
            resetPaymentForm();
            setPaymentContext({ mode: 'bulk', commission: null });
          }
        }}
        title={dialogTitle}
        description={dialogDescription}
      >
        <form className="space-y-4" onSubmit={handleDialogSubmit}>
          <Alert
            variant="info"
            description={
              paymentContext.mode === 'single' && paymentContext.commission
                ? `Solicitaras ${formatCurrency(Number(paymentContext.commission.monto ?? 0))} de ${
                    paymentContext.commission.campania?.nombre ?? 'Sin campana'
                  }.`
                : `Se solicitaran ${pendingCommissionIds.length} comisiones pendientes.`
            }
          />
          <div className="flex gap-2 text-sm font-semibold text-content">
            <button
              type="button"
              className={`flex-1 rounded-lg border px-3 py-2 transition ${
                method === 'yape'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-border bg-field'
              }`}
              onClick={() => setMethod('yape')}
            >
              Yape
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg border px-3 py-2 transition ${
                method === 'transferencia'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-border bg-field'
              }`}
              onClick={() => setMethod('transferencia')}
            >
              Transferencia
            </button>
          </div>

          {method === 'yape' ? (
            <div className="space-y-3">
              <Input
                label="Telefono Yape"
                value={form.telefono_yape}
                onChange={(event) => setForm((prev) => ({ ...prev, telefono_yape: event.target.value }))}
                required
              />
              <Input
                label="Nombres completos"
                value={form.nombres_yape}
                onChange={(event) => setForm((prev) => ({ ...prev, nombres_yape: event.target.value }))}
                required
              />
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                label="CCI / Cuenta bancaria"
                value={form.cci}
                onChange={(event) => setForm((prev) => ({ ...prev, cci: event.target.value }))}
                required
              />
              <Input
                label="Titular de la cuenta"
                value={form.titular}
                onChange={(event) => setForm((prev) => ({ ...prev, titular: event.target.value }))}
                required
              />
              <Input
                label="Banco o entidad"
                value={form.banco}
                onChange={(event) => setForm((prev) => ({ ...prev, banco: event.target.value }))}
                required
              />
            </div>
          )}

          <Input
            label="Notas adicionales u otro medio"
            value={form.notas}
            onChange={(event) => setForm((prev) => ({ ...prev, notas: event.target.value }))}
            placeholder="Ej: Plin 999999999 o comentario para el equipo"
          />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeDialog} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={dialogSubmitDisabled}>
              {dialogSubmitLabel}
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
};

export default DashboardReferidos;
