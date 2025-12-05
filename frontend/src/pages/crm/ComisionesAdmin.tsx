import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CommissionService } from '@/services/commission.service';
import type { Commission } from '@/services/commission.service';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/common/Toasts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Dialog } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { t } from '@/i18n';

export const ComisionesAdmin = () => {
  const [statusFilter, setStatusFilter] = useState<'all' | '1' | '2' | '3'>('all');
  const [campaignFilter, setCampaignFilter] = useState<'all' | string>('all');
  const [vendorFilter, setVendorFilter] = useState<'all' | string>('all');
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const queryClient = useQueryClient();
  const { push } = useToast();
  const statusLabelMap: Record<number, string> = {
    1: t('crmCommissions.status.pending'),
    2: t('crmCommissions.status.requested'),
    3: t('crmCommissions.status.paid'),
  };
  const statusBadgeMap: Record<number, { label: string; variant: 'warning' | 'info' | 'success' | 'neutral' }> = {
    1: { label: statusLabelMap[1], variant: 'warning' },
    2: { label: statusLabelMap[2], variant: 'info' },
    3: { label: statusLabelMap[3], variant: 'success' },
  };
  const statusOptions = [
    { label: t('crmCommissions.filters.status.all'), value: 'all' },
    { label: statusLabelMap[1], value: '1' },
    { label: statusLabelMap[2], value: '2' },
    { label: statusLabelMap[3], value: '3' },
  ];
  const resolveStatusMeta = (status?: number | null) =>
    statusBadgeMap[Number(status) as 1 | 2 | 3] ?? {
      label: t('crmCommissions.status.pending'),
      variant: 'neutral',
    };

  const commissionsQuery = useQuery({
    queryKey: ['admin-commissions', statusFilter],
    queryFn: () =>
      CommissionService.list(statusFilter === 'all' ? {} : { id_estado_comision: statusFilter }),
    select: (payload): Commission[] => {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      return [];
    },
  });

  const rawCommissions = commissionsQuery.data ?? [];
  const getLeadVendorAssignment = (lead: Commission['lead']) => {
    const assignments = lead?.asignaciones ?? [];
    if (!assignments.length) return null;
    const sorted = assignments.slice().sort((a, b) => {
      const dateA = new Date(a.fecha_asignacion ?? 0).getTime();
      const dateB = new Date(b.fecha_asignacion ?? 0).getTime();
      return dateB - dateA;
    });
    return sorted.find((assignment) => assignment?.estado === 1) ?? sorted[0] ?? null;
  };
  const getAssignedVendorId = (commission: Commission) => {
    const active = getLeadVendorAssignment(commission.lead);
    return active?.id_asignado_usuario_empresa ?? active?.asignado?.id_usuario_empresa ?? null;
  };
  const filteredCommissions = rawCommissions.filter((commission) => {
    const matchesCampaign =
      campaignFilter === 'all' ||
      String(commission.campania?.id_campania ?? 'none') === campaignFilter;
    if (vendorFilter !== 'all') {
      const vendorId = getAssignedVendorId(commission);
      const vendorKey = vendorId ? String(vendorId) : 'none';
      if (vendorKey !== vendorFilter) return false;
    }
    return matchesCampaign;
  });

  const totals = useMemo(() => {
    return filteredCommissions.reduce(
      (acc, commission) => {
        const amount = Number(commission.monto ?? 0);
        const status = Number(commission.id_estado_comision ?? 1);
        if (status === 3) {
          acc.pagado += amount;
        } else if (status === 2) {
          acc.solicitada += amount;
        } else {
          acc.pendiente += amount;
        }
        acc.total += amount;
        return acc;
      },
      { pendiente: 0, solicitada: 0, pagado: 0, total: 0 },
    );
  }, [filteredCommissions]);
  const summaryCards = [
    { key: 'pending', label: t('crmCommissions.cards.pending'), value: totals.pendiente },
    { key: 'requested', label: t('crmCommissions.cards.requested'), value: totals.solicitada },
    { key: 'paid', label: t('crmCommissions.cards.paid'), value: totals.pagado },
    { key: 'total', label: t('crmCommissions.cards.total'), value: totals.total },
  ];

  const resolveMutation = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: 'pagado' | 'pendiente' }) =>
      CommissionService.resolvePayment(id, { estado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-commissions'] });
      setSelectedCommission(null);
      push({
        title: t('crmCommissions.toasts.updateSuccess.title'),
        description: t('crmCommissions.toasts.updateSuccess.description'),
      });
    },
    onError: () => {
      push({
        title: t('crmCommissions.toasts.updateError.title'),
        description: t('crmCommissions.toasts.updateError.description'),
        variant: 'danger',
      });
    },
  });

  const campaignOptions = useMemo(() => {
    const entries = new Map<string, string>();
    rawCommissions.forEach((commission) => {
      const id = commission.campania?.id_campania;
      const key = String(id ?? 'none');
      if (!entries.has(key)) {
        entries.set(key, commission.campania?.nombre ?? t('crmCommissions.table.noCampaign'));
      }
    });
    return [{ label: t('common.allCampaigns'), value: 'all' }].concat(
      Array.from(entries.entries()).map(([value, label]) => ({ label, value })),
    );
  }, [rawCommissions, t]);

  const vendorOptions = useMemo(() => {
    const entries = new Map<string, string>();
    rawCommissions.forEach((commission) => {
      const active = getLeadVendorAssignment(commission.lead);
      const id =
        active?.id_asignado_usuario_empresa ?? active?.asignado?.id_usuario_empresa ?? null;
      const key = id ? String(id) : 'none';
      if (!entries.has(key)) {
        const first = active?.asignado?.nombres ?? '';
        const last = active?.asignado?.apellidos ?? '';
        const label = `${first} ${last}`.trim() || active?.asignado?.email || t('crmCommissions.table.noVendor');
        entries.set(key, label);
      }
    });
    const options = Array.from(entries.entries()).map(([value, label]) => ({ label, value }));
    return [{ label: t('common.allVendors'), value: 'all' }, ...options];
  }, [rawCommissions, t]);

  const getLeadName = (commission: Commission) => {
    const first = commission.lead?.nombres ?? '';
    const last = commission.lead?.apellidos ?? '';
    const full = `${first} ${last}`.trim();
    if (full) return full;
    if (commission.id_lead) return `${t('crmCommissions.table.lead')} #${commission.id_lead}`;
    return t('crmCommissions.table.lead');
  };

  const getFreelerName = (commission: Commission) => {
    const first = commission.freeler?.nombres ?? '';
    const last = commission.freeler?.apellidos ?? '';
    const full = `${first} ${last}`.trim();
    return full || commission.freeler?.email || t('crmCommissions.table.noFreeler');
  };

  const getAssignedVendorName = (commission: Commission) => {
    const active = getLeadVendorAssignment(commission.lead);
    if (!active) return t('crmCommissions.table.noVendor');
    const first = active.asignado?.nombres ?? '';
    const last = active.asignado?.apellidos ?? '';
    const full = `${first} ${last}`.trim();
    return full || active.asignado?.email || t('crmCommissions.table.noVendor');
  };

  const formatPaymentKey = (key: string) =>
    key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const resolvePaymentDetails = (commission: Commission | null) => {
    const latest = commission?.retiros?.[0];
    if (!latest) return null;
    const records = latest.datos_pago ?? {};
    return {
      metodo: latest.metodo_pago,
      rows: Object.entries(records).map(([key, value]) => ({
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value),
      })),
    };
  };

  return (
    <section className="space-y-6">
      <header className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-1">
          <p className="text-sm uppercase tracking-wide text-primary-500">{t('crmCommissions.subtitle')}</p>
          <h1 className="text-2xl font-semibold text-content">{t('crmCommissions.title')}</h1>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card, index) => (
            <div
              key={card.key}
              className="flex flex-col rounded-xl border border-border bg-gradient-to-br from-surface to-surface-muted/60 p-4 shadow-inner"
            >
              <span className="text-xs font-semibold uppercase text-content-muted">{card.label}</span>
              <span className="mt-2 text-3xl font-bold text-content">{formatCurrency(card.value)}</span>
              <div className="mt-3 h-1 w-full rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary-500"
                  style={{ width: `${Math.min((card.value / (totals.total || 1)) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Select
            label={t('common.campaign')}
            value={campaignFilter}
            onChange={(event) => setCampaignFilter(event.target.value as typeof campaignFilter)}
            options={campaignOptions}
          />
          <Select
            label={t('common.vendor')}
            value={vendorFilter}
            onChange={(event) => setVendorFilter(event.target.value as typeof vendorFilter)}
            options={vendorOptions}
          />
          <Select
            label={t('crmCommissions.filters.status.label')}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            options={statusOptions}
          />
        </div>
      </header>


      <Table minWidthClass="min-w-[900px]">
        <TableHeader>
          <TableRow className="text-xs uppercase tracking-wide text-content-muted">
            <TableHead>{t('crmCommissions.table.campaign')}</TableHead>
            <TableHead>{t('crmCommissions.table.vendor')}</TableHead>
            <TableHead>{t('crmCommissions.table.freeler')}</TableHead>
            <TableHead>{t('crmCommissions.table.lead')}</TableHead>
            <TableHead>{t('crmCommissions.table.amount')}</TableHead>
            <TableHead>{t('crmCommissions.table.status')}</TableHead>
            <TableHead>{t('crmCommissions.table.paymentDate')}</TableHead>
            <TableHead className="text-right">{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredCommissions.map((commission) => {
            const statusMeta = resolveStatusMeta(commission.id_estado_comision);
            return (
              <TableRow key={commission.id_comision}>
                <TableCell>{commission.campania?.nombre ?? t('crmCommissions.table.noCampaign')}</TableCell>
                <TableCell>{getAssignedVendorName(commission)}</TableCell>
                <TableCell>{getFreelerName(commission)}</TableCell>
                <TableCell>{getLeadName(commission)}</TableCell>
                <TableCell className="font-semibold text-content">
                  {formatCurrency(Number(commission.monto ?? 0))}
                </TableCell>
                <TableCell>
                  <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                </TableCell>
                <TableCell>{formatDate(commission.fecha_pago)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCommission(commission)}>
                    {t('crmCommissions.table.viewRequest')}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {!filteredCommissions.length && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-content-muted">
                {t('crmCommissions.table.empty')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Dialog
        open={Boolean(selectedCommission)}
        onOpenChange={(open) => {
          if (!open) setSelectedCommission(null);
        }}
        title={t('crmCommissions.table.viewRequest')}
        description={selectedCommission?.freeler?.email ?? ''}
      >
        {selectedCommission && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-content-muted">{t('crmCommissions.table.vendor')}</p>
                <Badge variant="secondary">{getAssignedVendorName(selectedCommission)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-content-muted">{t('crmCommissions.table.campaign')}</p>
                <span className="font-medium">
                  {selectedCommission.campania?.nombre ?? t('crmCommissions.table.noCampaign')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-content-muted">{t('crmCommissions.table.freeler')}</p>
                <span className="font-medium">{getFreelerName(selectedCommission)}</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-content-muted">{t('crmCommissions.table.lead')}</p>
                <span className="font-medium">{getLeadName(selectedCommission)}</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-content-muted">{t('crmCommissions.table.amount')}</p>
                <span className="text-lg font-semibold">
                  {formatCurrency(Number(selectedCommission.monto ?? 0))}
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-dashed border-border p-4 text-sm">
              <p className="font-semibold text-content">{t('crmCommissions.paymentDetails.title')}</p>
              {(() => {
                const paymentDetails = resolvePaymentDetails(selectedCommission);
                if (!paymentDetails || !paymentDetails.rows.length) {
                  return (
                    <p className="mt-1 text-content-muted">
                      {t('crmCommissions.paymentDetails.placeholder')}
                    </p>
                  );
                }
                return (
                  <div className="mt-2 space-y-2">
                    <div className="text-xs uppercase tracking-wide text-content-muted">
                      Metodo: <span className="font-semibold text-content">{paymentDetails.metodo}</span>
                    </div>
                    {paymentDetails.rows.map((entry) => (
                      <div
                        key={entry.key}
                        className="flex items-center justify-between rounded-lg bg-surface px-3 py-1.5"
                      >
                        <span className="text-xs uppercase tracking-wide text-content-muted">
                          {formatPaymentKey(entry.key)}
                        </span>
                        <span className="text-sm font-medium text-content">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setSelectedCommission(null)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                className="flex-1"
                isLoading={resolveMutation.isPending}
                onClick={() =>
                  resolveMutation.mutate({
                    id: selectedCommission.id_comision,
                    estado: 'pagado',
                  })
                }
              >
                {t('crmCommissions.table.markPaid')}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
};

export default ComisionesAdmin;
