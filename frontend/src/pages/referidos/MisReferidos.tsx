import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LeadService, unwrapLeadCollection } from '@/services/lead.service';
import type { Lead } from '@/services/lead.service';
import { useAuth } from '@/store/auth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { EmptyState } from '@/components/common/EmptyState';
import { LeadDetailDrawer } from '@/components/common/LeadDetailDrawer';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LeadFormModal } from '@/components/common/LeadFormModal';
import { getStatusBadgeVariant, normalizeStatusLabel } from '@/utils/badges';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ArrowUpDown, Pencil } from 'lucide-react';

type SortKey = 'nombre' | 'campania' | 'comision' | 'enviado' | 'estado' | 'descripcion';
type SortDirection = 'asc' | 'desc';

const formatLeadCurrency = (value?: string | number | null) => {
  const numeric =
    typeof value === 'number'
      ? value
      : value
        ? Number(value)
        : 0;
  if (!Number.isFinite(numeric)) return 'S/ 0.00';
  return formatCurrency(numeric);
};

const mapResponse = (data: unknown): Lead[] => unwrapLeadCollection<Lead>(data);

export const MisReferidos = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);

  const draftsQuery = useQuery({
    queryKey: ['leads-mine-drafts', user?.id],
    queryFn: () => LeadService.listMine(user?.id ?? 0, { estado_completo: false, limit: 200 }),
    enabled: Boolean(user?.id),
  });

  const submittedQuery = useQuery({
    queryKey: ['leads-mine-sent', user?.id],
    queryFn: () => LeadService.listMine(user?.id ?? 0, { estado_completo: true, limit: 200 }),
    enabled: Boolean(user?.id),
  });

  const drafts = useMemo(() => mapResponse(draftsQuery.data), [draftsQuery.data]);
  const sentLeads = useMemo(() => mapResponse(submittedQuery.data), [submittedQuery.data]);
  const campaignsInSent = useMemo(() => {
    const accumulator = new Map<string, { value: string; label: string }>();
    sentLeads.forEach((lead) => {
      const id = lead.campania?.id_campania;
      if (id) {
        const key = String(id);
        if (!accumulator.has(key)) {
          accumulator.set(key, { value: key, label: lead.campania?.nombre ?? `Campaña ${key}` });
        }
      } else {
        accumulator.set('none', { value: 'none', label: 'Sin campaña' });
      }
    });
    return Array.from(accumulator.values());
  }, [sentLeads]);

  const statusesInSent = useMemo(() => {
    const accumulator = new Map<string, { value: string; label: string }>();
    sentLeads.forEach((lead) => {
      const raw = lead.estado?.nombre ?? null;
      const label = normalizeStatusLabel(raw, 'No asignado');
      const value = raw ?? 'no-asignado';
      if (!accumulator.has(value)) {
        accumulator.set(value, { value, label });
      }
    });
    return Array.from(accumulator.values());
  }, [sentLeads]);

  const filteredSentLeads = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return sentLeads
      .filter((lead) => {
        if (selectedCampaign === 'all') return true;
        if (selectedCampaign === 'none') return !lead.campania;
        return String(lead.campania?.id_campania ?? '') === selectedCampaign;
      })
      .filter((lead) => {
        if (selectedStatus === 'all') return true;
        const rawStatus = lead.estado?.nombre ?? 'no-asignado';
        return rawStatus === selectedStatus;
      })
      .filter((lead) => {
        if (!normalizedSearch) return true;
        const haystack = [
          lead.nombres,
          lead.apellidos,
          lead.campania?.nombre,
          lead.descripcion,
          lead.email,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      });
  }, [searchTerm, selectedCampaign, selectedStatus, sentLeads]);

  const sortedSentLeads = useMemo(() => {
    if (!sortConfig) return filteredSentLeads;
    const toValue = (lead: Lead) => {
      switch (sortConfig.key) {
        case 'nombre':
          return `${lead.nombres ?? ''} ${lead.apellidos ?? ''}`.trim().toLowerCase();
        case 'campania':
          return (lead.campania?.nombre ?? '').toLowerCase();
        case 'comision': {
          const raw = lead.campania?.comision;
          return typeof raw === 'number' ? raw : Number(raw ?? 0);
        }
        case 'enviado':
          return new Date(lead.fecha_creacion ?? '').getTime() || 0;
        case 'estado':
          return normalizeStatusLabel(lead.estado?.nombre, 'No asignado').toLowerCase();
        case 'descripcion':
          return (lead.descripcion ?? '').toLowerCase();
        default:
          return '';
      }
    };

    const directionFactor = sortConfig.direction === 'asc' ? 1 : -1;
    return [...filteredSentLeads].sort((a, b) => {
      const valueA = toValue(a);
      const valueB = toValue(b);
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * directionFactor;
      }
      if (valueA < valueB) return -1 * directionFactor;
      if (valueA > valueB) return 1 * directionFactor;
      return 0;
    });
  }, [filteredSentLeads, sortConfig]);

  const refreshLists = useMutation({
    mutationFn: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['leads-mine-drafts', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['leads-mine-sent', user?.id] }),
      ]);
    },
  });

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      return {
        key,
        direction: prev.direction === 'asc' ? 'desc' : 'asc',
      };
    });
  };

  const renderSortableHeader = (label: string, key: SortKey) => (
    <button
      type="button"
      onClick={() => handleSort(key)}
      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-content-subtle transition hover:text-primary-600"
    >
      {label}
      <ArrowUpDown className="h-3.5 w-3.5" />
    </button>
  );

  if (!user) {
    return (
      <EmptyState
        title="Necesitas iniciar sesion"
        description="Inicia sesion con tu cuenta de referidos para revisar tus leads."
      />
    );
  }

  const isLoading = draftsQuery.isLoading || submittedQuery.isLoading;

  if (isLoading) {
    return <p className="text-sm text-content-muted">Cargando tus referidos...</p>;
  }

  const hasContent = Boolean(drafts.length || sentLeads.length);

  if (!hasContent) {
    return (
      <EmptyState
        title="Aun no tienes referidos"
        description="Cuando registres un lead aparecera aqui junto con su estado."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-content">Mis referidos</h1>
        <p className="text-sm text-content-muted">
          Revisa tus borradores, completa la informacion pendiente y haz seguimiento de tus envios.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-content">Borradores</h2>
            <p className="text-xs text-content-muted">
              Mantente al dia con la informacion pendiente antes de enviarla al equipo de campanas.
            </p>
          </div>
          <Badge variant="outline">{drafts.length} guardados</Badge>
        </div>
        {drafts.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Campana</TableHead>
                <TableHead>Comision</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.map((lead) => (
                <TableRow key={lead.id_lead}>
                  <TableCell>{`${lead.nombres ?? ''} ${lead.apellidos ?? ''}`.trim() || 'Sin nombre'}</TableCell>
                  <TableCell>{lead.campania?.nombre ?? 'Sin campana'}</TableCell>
                  <TableCell>{formatLeadCurrency(lead.campania?.comision)}</TableCell>
                  <TableCell>{formatDate(lead.fecha_creacion ?? '')}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      className="h-9 w-9 rounded-full border-border-subtle p-0 text-content hover:border-primary-400"
                      onClick={() => setEditingLead(lead)}
                      aria-label="Editar borrador"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-content-muted">No tienes referidos en borrador.</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3 space-y-1">
          <h2 className="text-lg font-semibold text-content">Leads enviados</h2>
          <p className="text-xs text-content-muted">
            Visualiza el estado de tus referidos enviados y la informacion clave asociada.
          </p>
        </div>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              label="Buscar"
              placeholder="Busca por nombre, campana o descripcion"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full sm:max-w-xs"
            />
            <Select
              label="Campana"
              value={selectedCampaign}
              onChange={(event) => setSelectedCampaign(event.target.value)}
              options={[
                { value: 'all', label: 'Todas' },
                ...campaignsInSent,
              ]}
            />
            <Select
              label="Estado"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              options={[
                { value: 'all', label: 'Todos' },
                ...statusesInSent,
              ]}
            />
          </div>
        </div>
        {sentLeads.length ? (
          sortedSentLeads.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{renderSortableHeader('Nombre', 'nombre')}</TableHead>
                  <TableHead>{renderSortableHeader('Campana', 'campania')}</TableHead>
                  <TableHead>{renderSortableHeader('Comision', 'comision')}</TableHead>
                  <TableHead>{renderSortableHeader('Enviado', 'enviado')}</TableHead>
                  <TableHead>{renderSortableHeader('Estado', 'estado')}</TableHead>
                  <TableHead>{renderSortableHeader('Descripcion', 'descripcion')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSentLeads.map((lead) => (
                  <TableRow key={lead.id_lead} onClick={() => setSelectedLead(lead)} className="cursor-pointer">
                    <TableCell>{`${lead.nombres ?? ''} ${lead.apellidos ?? ''}`.trim()}</TableCell>
                    <TableCell>{lead.campania?.nombre ?? 'Sin campana'}</TableCell>
                    <TableCell>{formatLeadCurrency(lead.campania?.comision)}</TableCell>
                    <TableCell>{formatDate(lead.fecha_creacion ?? '')}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(lead.estado?.nombre)}>
                        {normalizeStatusLabel(lead.estado?.nombre, 'No asignado')}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-content-subtle">
                      {lead.descripcion ?? 'Sin descripcion'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-content-muted">No hay leads enviados que coincidan con los filtros.</p>
          )
        ) : (
          <p className="text-sm text-content-muted">Aun no has enviado referidos.</p>
        )}
      </section>

      <LeadDetailDrawer
        open={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
        title={selectedLead ? `${selectedLead.nombres ?? ''} ${selectedLead.apellidos ?? ''}`.trim() : ''}
      >
        {selectedLead && (
          <div className="space-y-2 text-sm text-content">
            <p>
              <strong>Campana:</strong> {selectedLead.campania?.nombre ?? 'Sin campana'}
            </p>
            <p className="flex items-center gap-2">
              <strong>Estado:</strong>{' '}
              <Badge variant={getStatusBadgeVariant(selectedLead.estado?.nombre)}>
                {normalizeStatusLabel(selectedLead.estado?.nombre, 'No asignado')}
              </Badge>
            </p>
            <p>
              <strong>Registrado:</strong> {formatDate(selectedLead.fecha_creacion ?? '')}
            </p>
            <p>
              <strong>Descripcion:</strong> {selectedLead.descripcion ?? 'Sin descripcion'}
            </p>
          </div>
        )}
      </LeadDetailDrawer>

      <LeadFormModal
        open={Boolean(editingLead)}
        onClose={() => setEditingLead(null)}
        lead={editingLead ?? undefined}
        campaignId={editingLead?.id_campania}
        onCompleted={() => {
          setEditingLead(null);
          refreshLists.mutate();
        }}
      />
    </div>
  );
};

export default MisReferidos;
