import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Lead, LeadAssignmentHistoryEntry, LeadDraft } from '@/services/lead.service';
import { LeadService } from '@/services/lead.service';
import { UserService } from '@/services/user.service';
import { useAuth } from '@/store/auth';
import { LeadDetailDrawer } from '@/components/common/LeadDetailDrawer';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Accordion } from '@/components/common/Accordion';
import { useToast } from '@/components/common/Toasts';
import { Badge } from '@/components/ui/Badge';
import { Loader2 } from 'lucide-react';
import { formatDate } from '@/utils/helpers';
import { getStatusBadgeVariant, normalizeStatusLabel } from '@/utils/badges';
import { Role } from '@/utils/constants';

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

const getActiveAssignmentEntity = (lead?: Lead | null) => {
  if (!lead?.asignaciones?.length) return null;
  return lead.asignaciones.find((assignment) => assignment.estado === 1) ?? lead.asignaciones[0];
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

const getLeadOwnerId = (lead: Lead) => {
  const assignment = lead.asignaciones?.find((item) => item?.estado === 1);
  return assignment?.id_asignado_usuario_empresa ?? assignment?.asignado?.id_usuario_empresa ?? null;
};

const getAssigneeLabel = (lead: Lead | null) => {
  if (!lead?.asignaciones?.length) return 'Sin asignar';
  const assignment = lead.asignaciones.find((assign) => assign.estado === 1) ?? lead.asignaciones[0];
  if (!assignment) return 'Sin asignar';
  const display = `${assignment.asignado?.nombres ?? ''} ${assignment.asignado?.apellidos ?? ''}`.trim();
  return display || assignment.asignado?.email || 'Usuario';
};

const normalizeStatusValue = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const buildTimelineFromAssignments = (lead?: Lead | null): TimelineItem[] => {
  if (!lead) return [];
  const records: TimelineItem[] = [];
  if (lead.fecha_creacion) {
    records.push({
      id: `creation-${lead.id_lead}`,
      dateLabel: formatTimelineDate(lead.fecha_creacion),
      message: 'Lead registrado en el sistema.',
    });
  }
  (lead.asignaciones ?? []).forEach((assignment) => {
    records.push({
      id: `assign-${assignment.id_asignacion}`,
      dateLabel: formatTimelineDate(assignment.fecha_asignacion ?? assignment.actualizadoEn ?? assignment.creadoEn),
      message: `${buildUserFriendlyName(assignment.actor)} asignó a ${buildUserFriendlyName(assignment.asignado)}`,
    });
  });
  return records.sort((a, b) => {
    const dateA = new Date(a.dateLabel).getTime();
    const dateB = new Date(b.dateLabel).getTime();
    return dateA - dateB;
  });
};

type LeadEditorDrawerProps = {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  variant?: 'admin' | 'supervisor' | 'vendor';
  onUpdated?: () => void;
};

export const LeadEditorDrawer = ({ lead, open, onClose, variant, onUpdated }: LeadEditorDrawerProps) => {
  const { push } = useToast();
  const { user } = useAuth();
  const resolvedVariant =
    variant ??
    (user?.role === Role.VENDEDOR ? 'vendor' : user?.role === Role.SUPERVISOR ? 'supervisor' : 'admin');
  const isVendorMode = resolvedVariant === 'vendor';
  const isSupervisorMode = resolvedVariant === 'supervisor';
  const [activeLead, setActiveLead] = useState<Lead | null>(lead);
  const [activeLeadTab, setActiveLeadTab] = useState<'details' | 'history'>('details');
  const [contactForm, setContactForm] = useState<LeadContactFormState>(() => buildContactSnapshot(lead));
  const [operationState, setOperationState] = useState<LeadOperationState>({
    vendorId: '',
    statusId: '',
    active: true,
  });

  useEffect(() => {
    setActiveLead(lead);
    setContactForm(buildContactSnapshot(lead));
    const assignment = getActiveAssignmentEntity(lead ?? undefined);
    setOperationState({
      vendorId: assignment?.id_asignado_usuario_empresa ? String(assignment.id_asignado_usuario_empresa) : '',
      statusId: lead?.estado?.id_estado_lead ? String(lead.estado.id_estado_lead) : '',
      active: Boolean(assignment?.estado === 1),
    });
  }, [lead]);

  const canEditLead = isVendorMode || user?.role === 'admin' || user?.role === 'supervisor';
  const currentUserId = user?.id ? Number(user.id) : null;

  const statusesQuery = useQuery({
    queryKey: ['crm-lead-statuses'],
    queryFn: () => LeadService.getStatuses(),
  });

  const vendorQuery = useQuery({
    queryKey: ['crm-vendors'],
    queryFn: () => UserService.getUsuariosEmpresa(),
    enabled: !isVendorMode,
  });

  const statusOptions = useMemo(() => {
    const payload = Array.isArray(statusesQuery.data?.data)
      ? statusesQuery.data.data
      : Array.isArray(statusesQuery.data)
      ? statusesQuery.data
      : [];
    return payload.map((item: any) => ({
      id: Number(item.id_estado_lead ?? item.id ?? item.value ?? 0),
      label: String(item.nombre ?? item.label ?? '').trim(),
    }));
  }, [statusesQuery.data]);

  const vendorOptions = useMemo(() => {
    if (isVendorMode) return [];
    const payload = Array.isArray(vendorQuery.data?.data)
      ? vendorQuery.data.data
      : Array.isArray(vendorQuery.data)
      ? vendorQuery.data
      : [];
    return payload
      .filter((option: any) => option?.id_usuario_empresa)
      .map((option: any) => ({
        id: Number(option.id_usuario_empresa),
        label: `${option.nombres ?? ''} ${option.apellidos ?? ''}`.trim() || option.email || 'Usuario',
      }));
  }, [isVendorMode, vendorQuery.data]);

  const historyQuery = useQuery({
    queryKey: ['lead-history', activeLead?.id_lead],
    queryFn: () => LeadService.getAssignmentHistory(activeLead!.id_lead),
    enabled: Boolean(open && activeLead?.id_lead && !isVendorMode),
    staleTime: 1000 * 60,
  });

  const refreshLead = async (leadId: number) => {
    try {
      const fresh = await LeadService.findById(leadId);
      setActiveLead(fresh);
      setContactForm(buildContactSnapshot(fresh));
      const assignment = getActiveAssignmentEntity(fresh);
      setOperationState({
        vendorId: assignment?.id_asignado_usuario_empresa ? String(assignment.id_asignado_usuario_empresa) : '',
        statusId: fresh?.estado?.id_estado_lead ? String(fresh.estado.id_estado_lead) : '',
        active: Boolean(assignment?.estado === 1),
      });
      onUpdated?.();
    } catch {
      // ignore
    }
  };

  const contactMutation = useMutation({
    mutationFn: ({ leadId, data }: { leadId: number; data: Partial<LeadDraft> }) => LeadService.update(leadId, data),
    onSuccess: async (_data, variables) => {
      push({ title: 'Datos actualizados', description: 'La información del lead se guardó correctamente.' });
      await refreshLead(variables.leadId);
    },
    onError: () => {
      push({
        title: 'No se guardó la información',
        description: 'Intenta nuevamente más tarde.',
        variant: 'danger',
      });
    },
  });

  const assignVendorMutation = useMutation({
    mutationFn: (payload: { leadId: number; usuarioEmpresaId: number; vendedorId: number }) =>
      LeadService.assignLead({
        leadId: payload.leadId,
        usuarioEmpresaId: payload.usuarioEmpresaId,
        asignarAUsuarioEmpresaId: payload.vendedorId,
      }),
    onSuccess: async (_data, variables) => {
      const wasPending = normalizeStatusValue(activeLead?.estado?.nombre) === 'pendiente';
      if (wasPending && currentUserId) {
        const assignedOption = statusOptions.find(
          (option) => normalizeStatusValue(option.label) === 'asignado',
        );
        if (assignedOption) {
          try {
            await LeadService.updateStatus({
              leadId: variables.leadId,
              id_estado_lead: assignedOption.id,
              usuarioEmpresaId: currentUserId,
            });
          } catch {
            push({
              title: 'Estado no actualizado',
              description: 'No se pudo marcar como asignado automáticamente.',
              variant: 'warning',
            });
          }
        }
      }
      push({ title: 'Asignación actualizada', description: 'El lead fue asignado correctamente.' });
      await refreshLead(variables.leadId);
    },
    onError: () => {
      push({
        title: 'No se pudo asignar',
        description: 'Intenta nuevamente.',
        variant: 'danger',
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ leadId, usuarioEmpresaId, statusId }: { leadId: number; usuarioEmpresaId: number; statusId: number }) =>
      LeadService.updateStatus({
        leadId,
        id_estado_lead: statusId,
        usuarioEmpresaId,
      }),
    onSuccess: async (_resp, vars) => {
      push({ title: 'Estado actualizado', description: 'El lead cambió de estado.' });
      await refreshLead(vars.leadId);
    },
    onError: () => {
      push({
        title: 'No se pudo cambiar el estado',
        description: 'Vuelve a intentarlo.',
        variant: 'danger',
      });
    },
  });

  const assignmentStateMutation = useMutation({
    mutationFn: ({ asignacionId, usuarioEmpresaId, estado }: { asignacionId: number; usuarioEmpresaId: number; estado: 'activo' | 'inactivo' }) =>
      LeadService.updateAsignacion(asignacionId, {
        usuarioEmpresaId,
        estado,
      }),
    onSuccess: async (_resp, vars) => {
      push({ title: 'Asignación actualizada', description: 'El vendedor fue actualizado.' });
      await refreshLead(vars.leadId);
    },
    onError: () => {
      push({
        title: 'No se pudo actualizar la asignación',
        description: 'Inténtalo nuevamente.',
        variant: 'danger',
      });
    },
  });

  const fallbackTimeline = useMemo(() => buildTimelineFromAssignments(activeLead), [activeLead]);

  const timelineItems = useMemo(() => {
    if (historyQuery.isError && fallbackTimeline.length) {
      return fallbackTimeline;
    }
    const payload = historyQuery.data ?? [];
    const items: TimelineItem[] = payload.map((entry: LeadAssignmentHistoryEntry) => {
      const dateLabel = formatTimelineDate(entry.fecha_asignacion ?? entry.fecha);
      const message = `${buildUserFriendlyName(entry.actor)} ${entry.evento ?? ''}`.trim();
      return {
        id: `${entry.id_asignacion ?? entry.id_lead}-${entry.fecha_asignacion ?? entry.fecha}`,
        dateLabel,
        message,
      };
    });
    if (!items.length && fallbackTimeline.length) {
      return fallbackTimeline;
    }
    return items;
  }, [fallbackTimeline, historyQuery.data, historyQuery.isError]);

  const handleContactInputChange = (field: keyof LeadContactFormState, value: string) => {
    setContactForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleContactReset = () => {
    setContactForm(buildContactSnapshot(activeLead));
  };

  const handleContactSave = () => {
    if (!activeLead) return;
    const leadId = activeLead.id_lead;
    const payload: Partial<LeadDraft> = {
      nombres: contactForm.nombres.trim() || undefined,
      apellidos: contactForm.apellidos.trim() || undefined,
      telefono: contactForm.telefono.trim() || undefined,
      email: contactForm.email.trim() || undefined,
      dni: contactForm.dni.trim() || undefined,
      ocupacion: contactForm.ocupacion.trim() || undefined,
      ciudad: contactForm.ciudad.trim() || undefined,
      descripcion: contactForm.descripcion.trim() || undefined,
    };
    contactMutation.mutate({ leadId, data: payload });
  };

  const handleVendorSave = () => {
    if (!activeLead || !currentUserId || !operationState.vendorId) return;
    assignVendorMutation.mutate({
      leadId: activeLead.id_lead,
      usuarioEmpresaId: currentUserId,
      vendedorId: Number(operationState.vendorId),
    });
  };

  const handleStatusSave = () => {
    if (!activeLead || !currentUserId || !operationState.statusId) return;
    statusMutation.mutate({
      leadId: activeLead.id_lead,
      usuarioEmpresaId: currentUserId,
      statusId: Number(operationState.statusId),
    });
  };

  const handleAssignmentToggle = (nextValue: boolean) => {
    const assignment = getActiveAssignmentEntity(activeLead ?? undefined);
    if (!assignment || !currentUserId) return;
    assignmentStateMutation.mutate({
      asignacionId: assignment.id_asignacion,
      usuarioEmpresaId: currentUserId,
      estado: nextValue ? 'activo' : 'inactivo',
      leadId: activeLead?.id_lead ?? 0,
    });
  };

  const handleClose = () => {
    onClose();
    setActiveLeadTab('details');
  };

  const contactBaseline = useMemo(() => buildContactSnapshot(activeLead), [activeLead]);
  const contactChanged =
    contactForm.nombres.trim() !== contactBaseline.nombres ||
    contactForm.apellidos.trim() !== contactBaseline.apellidos ||
    contactForm.telefono.trim() !== contactBaseline.telefono ||
    contactForm.email.trim() !== contactBaseline.email ||
    contactForm.dni.trim() !== contactBaseline.dni ||
    contactForm.ocupacion.trim() !== contactBaseline.ocupacion ||
    contactForm.ciudad.trim() !== contactBaseline.ciudad ||
    contactForm.descripcion.trim() !== contactBaseline.descripcion;

  const currentAssignment = getActiveAssignmentEntity(activeLead ?? undefined);
  const assignmentDisplayName = getAssigneeLabel(activeLead);
  const assignedAtLabel = currentAssignment?.fecha_asignacion
    ? new Date(currentAssignment.fecha_asignacion).toLocaleString()
    : '-';
  const unassignedLabel = computeUnassignedDuration(activeLead?.fecha_creacion, currentAssignment?.fecha_asignacion);
  const originLabel = activeLead?.origen ?? 'No indicado';
  const campaignLabel = activeLead?.campania?.nombre ?? 'Sin campaña';
  const creationLabel = activeLead?.fecha_creacion ? formatDate(activeLead.fecha_creacion) : '-';

  const statusChanged = Boolean(operationState.statusId && Number(operationState.statusId) !== activeLead?.estado?.id_estado_lead);
  const vendorChanged =
    Boolean(operationState.vendorId) &&
    Number(operationState.vendorId) !== (currentAssignment?.id_asignado_usuario_empresa ?? -1);

  const assignmentHistoryCards = timelineItems;

  return (
    <LeadDetailDrawer open={open} onClose={handleClose} title={activeLead ? 'Detalle del lead' : ''}>
      {!activeLead ? (
        <p className="text-sm text-content-muted">Selecciona un lead para ver sus detalles.</p>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-4 py-3">
            <div>
              <p className="text-lg font-semibold text-content">
                {`${activeLead.nombres ?? ''} ${activeLead.apellidos ?? ''}`.trim() || activeLead.email || 'Lead sin nombre'}
              </p>
              <p className="text-sm text-content-muted">{activeLead.email ?? activeLead.telefono ?? 'Sin contacto'}</p>
            </div>
            <Badge variant={getStatusBadgeVariant(activeLead.estado?.nombre ?? activeLead.estado)}>
              {normalizeStatusLabel(activeLead.estado?.nombre ?? 'Pendiente')}
            </Badge>
          </div>

          <div className="flex gap-2">
            <Button variant={activeLeadTab === 'details' ? 'primary' : 'ghost'} onClick={() => setActiveLeadTab('details')}>
              Detalles
            </Button>
            <Button variant={activeLeadTab === 'history' ? 'primary' : 'ghost'} onClick={() => setActiveLeadTab('history')}>
              Historial
            </Button>
          </div>

          {activeLeadTab === 'details' ? (
            <div className="space-y-6">
              <Accordion title="Datos del contacto" defaultOpen>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input label="DNI" value={contactForm.dni} onChange={(event) => handleContactInputChange('dni', event.target.value)} />
                  <Input label="Nombres" value={contactForm.nombres} onChange={(event) => handleContactInputChange('nombres', event.target.value)} />
                  <Input label="Apellidos" value={contactForm.apellidos} onChange={(event) => handleContactInputChange('apellidos', event.target.value)} />
                  <Input label="Teléfono" value={contactForm.telefono} onChange={(event) => handleContactInputChange('telefono', event.target.value)} />
                  <Input label="Email" type="email" value={contactForm.email} onChange={(event) => handleContactInputChange('email', event.target.value)} />
                  <Input label="Ocupación" value={contactForm.ocupacion} onChange={(event) => handleContactInputChange('ocupacion', event.target.value)} />
                  <Input label="Ciudad" value={contactForm.ciudad} onChange={(event) => handleContactInputChange('ciudad', event.target.value)} />
                </div>
                <TextArea label="Descripción" minRows={3} value={contactForm.descripcion} onChange={(event) => handleContactInputChange('descripcion', event.target.value)} />
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={handleContactReset} disabled={!activeLead}>
                    Restablecer
                  </Button>
                  <Button type="button" onClick={handleContactSave} disabled={!contactChanged || contactMutation.isPending} isLoading={contactMutation.isPending}>
                    Guardar datos
                  </Button>
                </div>
              </Accordion>

              <Accordion title="Datos de operación" defaultOpen>
                <div className="grid gap-3 md:grid-cols-2">
                  {!isVendorMode && !isSupervisorMode && (
                    <div>
                      <p className="text-xs text-content-muted">Origen</p>
                      <p className="text-sm font-semibold text-content">{originLabel}</p>
                    </div>
                  )}
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
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-sm text-content">
                        <span className="font-medium">Cambiar vendedor</span>
                        <Select value={operationState.vendorId} onChange={(event) => setOperationState((prev) => ({ ...prev, vendorId: event.target.value }))}>
                          <option value="">Sin asignar</option>
                          {vendorOptions.map((vendor) => (
                            <option key={vendor.id} value={vendor.id}>
                              {vendor.label}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <div className="flex items-end">
                        <Button type="button" onClick={handleVendorSave} disabled={!vendorChanged || assignVendorMutation.isPending} isLoading={assignVendorMutation.isPending}>
                          Actualizar asignación
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm text-content">
                      <span className="font-medium">Estado del lead</span>
                      <Select value={operationState.statusId} onChange={(event) => setOperationState((prev) => ({ ...prev, statusId: event.target.value }))}>
                        <option value="">Selecciona un estado</option>
                        {statusOptions.map((status) => (
                          <option key={status.id} value={status.id}>
                            {status.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <div className="flex items-end">
                      <Button type="button" onClick={handleStatusSave} disabled={!statusChanged || statusMutation.isPending} isLoading={statusMutation.isPending}>
                        Actualizar estado
                      </Button>
                    </div>
                  </div>

                  {!isVendorMode && currentAssignment && (
                    <div className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-content">Asignación activa</p>
                        <p className="text-xs text-content-muted">Controla si el vendedor puede gestionar este lead.</p>
                      </div>
                      <Switch checked={operationState.active} onChange={(event) => handleAssignmentToggle(event.target.checked)} disabled={assignmentStateMutation.isPending} />
                    </div>
                  )}
                </div>
              </Accordion>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-content-muted">
                Este historial es una versión simplificada. Una vista detallada se habilitará más adelante.
              </p>
              {historyQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-content-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Consultando historial...
                </div>
              ) : assignmentHistoryCards.length ? (
                <ul className="relative border-l border-border-subtle pl-4">
                  {assignmentHistoryCards.map((item) => (
                    <li key={item.id} className="mb-4 last:mb-0">
                      <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full bg-primary-500" />
                      <p className="text-xs text-content-muted">{item.dateLabel}</p>
                      <p className="text-sm text-content">{item.message}</p>
                    </li>
                  ))}
                </ul>
              ) : historyQuery.isError ? (
                <p className="text-sm text-content-muted">No pudimos obtener el historial desde el servidor.</p>
              ) : (
                <p className="text-sm text-content-muted">Aún no hay movimientos registrados para este lead.</p>
              )}
            </div>
          )}
        </div>
      )}
    </LeadDetailDrawer>
  );
};

export default LeadEditorDrawer;
