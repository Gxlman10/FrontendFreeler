import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CampaignService } from '@/services/campaign.service';
import type { Campaign, CreateCampaignPayload } from '@/services/campaign.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/common/Toasts';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { useAuth } from '@/store/auth';
import { Badge } from '@/components/ui/Badge';
import { getStatusBadgeVariant, normalizeStatusLabel } from '@/utils/badges';
import { Role } from '@/utils/constants';
import { t } from '@/i18n';

type CampaignFormState = {
  nombre: string;
  descripcion: string;
  ubicacion: string;
  comision: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: number;
};

const buildInitialForm = (): CampaignFormState => ({
  nombre: '',
  descripcion: '',
  ubicacion: '',
  comision: '',
  fecha_inicio: '',
  fecha_fin: '',
  estado: 1,
});

const AUTO_CLOSE_STORAGE_KEY = 'freeler:crm:campanas:auto-close';

const loadAutoCloseMap = () => {
  if (typeof window === 'undefined') {
    return {} as Record<number, boolean>;
  }
  try {
    const stored = localStorage.getItem(AUTO_CLOSE_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, boolean>;
    return Object.entries(parsed).reduce<Record<number, boolean>>((acc, [key, value]) => {
      const id = Number(key);
      if (!Number.isNaN(id) && value) acc[id] = true;
      return acc;
    }, {});
  } catch {
    return {};
  }
};

export const Campanas = () => {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const { user } = useAuth();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState<CampaignFormState>(() => buildInitialForm());
  const [editForm, setEditForm] = useState<CampaignFormState>(() => buildInitialForm());
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [autoDeactivateSelected, setAutoDeactivateSelected] = useState(false);
  const [autoCloseMap, setAutoCloseMap] = useState<Record<number, boolean>>(() => loadAutoCloseMap());

  const isAdmin = user?.role === Role.ADMIN;

  const resetForm = useCallback(() => {
    setForm(buildInitialForm());
  }, []);

  const companyId = user?.companyId ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ['crm-campanas', companyId],
    queryFn: () =>
      CampaignService.getAll(companyId ? { id_empresa: companyId } : {}),
    enabled: Boolean(user),
  });

  const campaigns: Campaign[] = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data)
    ? data
    : [];

  const setAutoCloseForCampaign = useCallback(
    (campaignId: number, enabled: boolean) => {
      setAutoCloseMap((prev) => {
        const next = { ...prev };
        if (enabled) {
          next[campaignId] = true;
        } else {
          delete next[campaignId];
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem(AUTO_CLOSE_STORAGE_KEY, JSON.stringify(next));
        }
        return next;
      });
    },
    [],
  );

  // Inyectamos los identificadores de la empresa y del usuario activo antes del POST
  const resolveSessionIds = useCallback(() => {
    if (!user || !user.companyId) {
      push({
        title: t('crmCampaigns.errors.missingCompanyTitle'),
        description: t('crmCampaigns.errors.missingCompanyDescription'),
        variant: 'danger',
      });
      throw new Error('MISSING_SESSION_IDS');
    }

    return {
      id_empresa: user.companyId,
      usuarioEmpresaId: user.id,
    };
  }, [push, user]);

  const createCampaign = useMutation({
    mutationFn: (payload: CreateCampaignPayload) => CampaignService.create(payload),
    onSuccess: (_, variables) => {
      const campaignName = variables.nombre?.trim();
      const description = campaignName
        ? t('crmCampaigns.toasts.createSuccess.descriptionNamed', { name: campaignName })
        : t('crmCampaigns.toasts.createSuccess.description');
      push({
        title: t('crmCampaigns.toasts.createSuccess.title'),
        description,
      });
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['crm-campanas'] });
    },
    onError: () => {
      push({
        title: t('crmCampaigns.errors.createFailedTitle'),
        description: t('crmCampaigns.errors.createFailedDescription'),
        variant: 'danger',
      });
    },
  });

  const updateCampaign = useMutation({
    mutationFn: (payload: Partial<CreateCampaignPayload>) => {
      if (!editingCampaign) {
        throw new Error('NO_CAMPAIGN_SELECTED');
      }
      return CampaignService.update(editingCampaign.id_campania, payload);
    },
    onSuccess: (updated) => {
      const campaignId = editingCampaign?.id_campania;
      const updatedName = updated.nombre?.trim();
      push({
        title: t('crmCampaigns.toasts.updateSuccess.title'),
        description: updatedName || t('crmCampaigns.toasts.updateSuccess.description'),
      });
      setEditDialogOpen(false);
      setEditingCampaign(null);
      if (campaignId) {
        setAutoCloseForCampaign(campaignId, autoDeactivateSelected);
      }
      queryClient.invalidateQueries({ queryKey: ['crm-campanas'] });
    },
    onError: () => {
      push({
        title: t('crmCampaigns.errors.updateFailedTitle'),
        description: t('crmCampaigns.errors.updateFailedDescription'),
        variant: 'danger',
      });
    },
  });

  const {
    mutate: autoDeactivateCampaignMutate,
    isPending: isAutoDeactivating,
  } = useMutation({
    mutationFn: async (campaignId: number) => {
      const sessionIds = resolveSessionIds();
      return CampaignService.update(campaignId, {
        usuarioEmpresaId: sessionIds.usuarioEmpresaId,
        estado: 0,
      });
    },
    onSuccess: (_updated, campaignId) => {
      setAutoCloseForCampaign(campaignId, false);
      queryClient.invalidateQueries({ queryKey: ['crm-campanas'] });
      push({
        title: t('crmCampaigns.toasts.autoDeactivate.title'),
        description: t('crmCampaigns.toasts.autoDeactivate.description'),
      });
    },
    onError: () => {
      push({
        title: t('crmCampaigns.errors.deactivateFailedTitle'),
        description: t('crmCampaigns.errors.deactivateFailedDescription'),
        variant: 'danger',
      });
    },
  });

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      try {
        const sessionIds = resolveSessionIds();
        const commissionValue = Number(form.comision);
        if (Number.isNaN(commissionValue) || commissionValue < 0) {
          push({
            title: t('crmCampaigns.errors.invalidAmountTitle'),
            description: t('crmCampaigns.errors.invalidAmountDescription'),
            variant: 'danger',
          });
          return;
        }
        if (!form.fecha_inicio) {
          push({
            title: t('crmCampaigns.errors.startDateTitle'),
            description: t('crmCampaigns.errors.startDateDescription'),
            variant: 'warning',
          });
          return;
        }
        if (!form.fecha_fin || form.fecha_fin < form.fecha_inicio) {
          push({
            title: t('crmCampaigns.errors.dateRangeTitle'),
            description: t('crmCampaigns.errors.dateRangeDescription'),
            variant: 'danger',
          });
          return;
        }

        createCampaign.mutate({
          ...sessionIds,
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || undefined,
          ubicacion: form.ubicacion.trim() || undefined,
          comision: commissionValue,
          fecha_inicio: form.fecha_inicio,
          fecha_fin: form.fecha_fin,
          estado: form.estado,
        });
      } catch (error) {
        if ((error as Error).message !== 'MISSING_SESSION_IDS') {
          push({
            title: t('crmCampaigns.errors.createFailedTitle'),
            description: t('crmCampaigns.errors.createFailedDescription'),
            variant: 'danger',
          });
        }
      }
    },
    [createCampaign, form, push, resolveSessionIds],
  );

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCampaign) return;
    let sessionIds: ReturnType<typeof resolveSessionIds>;
    try {
      sessionIds = resolveSessionIds();
    } catch {
      return;
    }
    const commissionValue = Number(editForm.comision);
    if (Number.isNaN(commissionValue) || commissionValue < 0) {
      push({
        title: t('crmCampaigns.errors.invalidAmountTitle'),
        description: t('crmCampaigns.errors.invalidAmountDescription'),
        variant: 'danger',
      });
      return;
    }
    if (!editForm.fecha_inicio) {
      push({
        title: t('crmCampaigns.errors.startDateTitle'),
        description: t('crmCampaigns.errors.startDateDescription'),
        variant: 'warning',
      });
      return;
    }
    if (!editForm.fecha_fin || editForm.fecha_fin < editForm.fecha_inicio) {
      push({
        title: t('crmCampaigns.errors.dateRangeTitle'),
        description: t('crmCampaigns.errors.dateRangeDescription'),
        variant: 'danger',
      });
      return;
    }
    updateCampaign.mutate({
      ...sessionIds,
      nombre: editForm.nombre.trim(),
      descripcion: editForm.descripcion.trim() || undefined,
      ubicacion: editForm.ubicacion.trim() || undefined,
      comision: commissionValue,
      fecha_inicio: editForm.fecha_inicio,
      fecha_fin: editForm.fecha_fin,
      estado: editForm.estado,
    });
  };

  const openEditDialog = (campaign: Campaign) => {
    if (!isAdmin) return;
    setEditingCampaign(campaign);
    setEditForm({
      nombre: campaign.nombre ?? '',
      descripcion: campaign.descripcion ?? '',
      ubicacion: campaign.ubicacion ?? '',
      comision:
        typeof campaign.comision === 'string'
          ? campaign.comision
          : String(campaign.comision ?? ''),
      fecha_inicio: campaign.fecha_inicio ?? '',
      fecha_fin: campaign.fecha_fin ?? '',
      estado: campaign.estado ?? 1,
    });
    setAutoDeactivateSelected(Boolean(autoCloseMap[campaign.id_campania]));
    setEditDialogOpen(true);
  };

  useEffect(() => {
    if (!isAdmin || !campaigns.length || !Object.keys(autoCloseMap).length) return;
    const today = new Date();
    Object.entries(autoCloseMap).forEach(([key, enabled]) => {
      if (!enabled) return;
      const campaignId = Number(key);
      if (Number.isNaN(campaignId)) return;
      const campaign = campaigns.find((item) => item.id_campania === campaignId);
      if (!campaign) return;
      const endDate = new Date(campaign.fecha_fin);
      if (endDate <= today && Number(campaign.estado) !== 0 && !isAutoDeactivating) {
        autoDeactivateCampaignMutate(campaignId);
      }
    });
  }, [autoCloseMap, campaigns, isAdmin, autoDeactivateCampaignMutate, isAutoDeactivating]);

  return (
    <section className="space-y-6 text-content">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-content">{t('crmCampaigns.title')}</h1>
          <p className="text-sm text-content-muted">{t('crmCampaigns.subtitle')}</p>
        </div>
        {isAdmin && <Button onClick={() => setDialogOpen(true)}>{t('crmCampaigns.actions.new')}</Button>}
      </header>

      {isLoading ? (
        <p className="text-sm text-content-muted">{t('crmCampaigns.loading')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('crmCampaigns.table.name')}</TableHead>
              {isAdmin && <TableHead>{t('crmCampaigns.table.commission')}</TableHead>}
              <TableHead>{t('crmCampaigns.table.validity')}</TableHead>
              <TableHead>{t('crmCampaigns.table.status')}</TableHead>
              <TableHead className="text-right">{t('crmCampaigns.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => {
              const commissionAmount =
                typeof campaign.comision === 'string'
                  ? Number(campaign.comision)
                  : campaign.comision;
              const safeCommission = Number.isFinite(commissionAmount) ? commissionAmount : 0;

              return (
                <TableRow key={campaign.id_campania}>
                  <TableCell>{campaign.nombre}</TableCell>
                  {isAdmin && <TableCell>{formatCurrency(safeCommission)}</TableCell>}
                  <TableCell>
                    {formatDate(campaign.fecha_inicio)} - {formatDate(campaign.fecha_fin)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(campaign.estado)}>
                        {normalizeStatusLabel(campaign.estado, t('crmCampaigns.table.noStatus'))}
                      </Badge>
                      {autoCloseMap[campaign.id_campania] && (
                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                          {t('crmCampaigns.table.autoBadge')}
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin ? (
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(campaign)}>
                        {t('crmCampaigns.actions.edit')}
                      </Button>
                    ) : (
                      <span className="text-xs text-content-subtle">{t('crmCampaigns.actions.noAccess')}</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {!campaigns.length && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4}>{t('crmCampaigns.table.empty')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
        title={t('crmCampaigns.dialogs.createTitle')}
        description={t('crmCampaigns.dialogs.createDescription')}
      >
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Input
            label={t('crmCampaigns.form.name')}
            required
            value={form.nombre}
            onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
          />
          <TextArea
            label={t('crmCampaigns.form.description')}
            minRows={4}
            value={form.descripcion}
            onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
          />
          <Input
            label={t('crmCampaigns.form.location')}
            value={form.ubicacion}
            onChange={(event) => setForm((prev) => ({ ...prev, ubicacion: event.target.value }))}
          />
          <Input
            label={t('crmCampaigns.form.commission')}
            type="number"
            step="0.01"
            min="0"
            required
            value={form.comision}
            onChange={(event) => setForm((prev) => ({ ...prev, comision: event.target.value }))}
          />
          <Input
            label={t('crmCampaigns.form.startDate')}
            type="date"
            required
            value={form.fecha_inicio}
            onChange={(event) => {
              const nextValue = event.target.value;
              setForm((prev) => ({
                ...prev,
                fecha_inicio: nextValue,
                fecha_fin:
                  prev.fecha_fin && prev.fecha_fin < nextValue ? nextValue : prev.fecha_fin,
              }));
            }}
          />
          <Input
            label={t('crmCampaigns.form.endDate')}
            type="date"
            required
            min={form.fecha_inicio || undefined}
            value={form.fecha_fin}
            onChange={(event) => {
              const nextValue = event.target.value;
              setForm((prev) => ({
                ...prev,
                fecha_fin:
                  prev.fecha_inicio && nextValue < prev.fecha_inicio ? prev.fecha_inicio : nextValue,
              }));
            }}
          />
          <Select
            label={t('crmCampaigns.form.status')}
            value={String(form.estado)}
            onChange={(event) => setForm((prev) => ({ ...prev, estado: Number(event.target.value) }))}
            options={[
              { value: 1, label: t('crmCampaigns.status.active') },
              { value: 0, label: t('crmCampaigns.status.inactive') },
            ]}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createCampaign.isLoading}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingCampaign(null);
            setEditForm(buildInitialForm());
            setAutoDeactivateSelected(false);
          }
        }}
        title={t('crmCampaigns.dialogs.editTitle')}
        description={t('crmCampaigns.dialogs.editDescription')}
      >
        <form className="space-y-3" onSubmit={handleEditSubmit}>
          <Input
            label={t('crmCampaigns.form.name')}
            required
            value={editForm.nombre}
            onChange={(event) => setEditForm((prev) => ({ ...prev, nombre: event.target.value }))}
          />
          <TextArea
            label={t('crmCampaigns.form.description')}
            minRows={4}
            value={editForm.descripcion}
            onChange={(event) => setEditForm((prev) => ({ ...prev, descripcion: event.target.value }))}
          />
          <Input
            label={t('crmCampaigns.form.location')}
            value={editForm.ubicacion}
            onChange={(event) => setEditForm((prev) => ({ ...prev, ubicacion: event.target.value }))}
          />
          <Input
            label={t('crmCampaigns.form.commission')}
            type="number"
            step="0.01"
            min="0"
            required
            value={editForm.comision}
            onChange={(event) => setEditForm((prev) => ({ ...prev, comision: event.target.value }))}
          />
          <Input
            label={t('crmCampaigns.form.startDate')}
            type="date"
            required
            value={editForm.fecha_inicio}
            onChange={(event) => {
              const nextValue = event.target.value;
              setEditForm((prev) => ({
                ...prev,
                fecha_inicio: nextValue,
                fecha_fin:
                  prev.fecha_fin && prev.fecha_fin < nextValue ? nextValue : prev.fecha_fin,
              }));
            }}
          />
          <Input
            label={t('crmCampaigns.form.endDate')}
            type="date"
            required
            min={editForm.fecha_inicio || undefined}
            value={editForm.fecha_fin}
            onChange={(event) => {
              const nextValue = event.target.value;
              setEditForm((prev) => ({
                ...prev,
                fecha_fin:
                  prev.fecha_inicio && nextValue < prev.fecha_inicio ? prev.fecha_inicio : nextValue,
              }));
            }}
          />
          <Select
            label={t('crmCampaigns.form.status')}
            value={String(editForm.estado)}
            onChange={(event) => setEditForm((prev) => ({ ...prev, estado: Number(event.target.value) }))}
            options={[
              { value: 1, label: t('crmCampaigns.status.active') },
              { value: 0, label: t('crmCampaigns.status.inactive') },
            ]}
          />
          <label className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-content">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border"
              checked={autoDeactivateSelected}
              onChange={(event) => setAutoDeactivateSelected(event.target.checked)}
              disabled={!isAdmin}
            />
            <span>
              <strong className="block text-content">{t('crmCampaigns.form.autoDeactivateTitle')}</strong>
              <span className="text-xs text-content-muted">
                {t('crmCampaigns.form.autoDeactivateDescription')}
              </span>
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={updateCampaign.isLoading}>
              {t('common.saveChanges')}
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
};

export default Campanas;
