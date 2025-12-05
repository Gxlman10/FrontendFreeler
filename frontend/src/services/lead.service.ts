import { api } from './api';

export type LeadDraft = {
  nombres?: string;
  apellidos?: string;
  dni?: string;
  email?: string;
  telefono?: string;
  ocupacion?: string;
  ciudad?: string;
  descripcion?: string;
  origen?: string;
  id_campania?: number;
  id_usuario_freeler?: number;
  estado_completo?: boolean;
  id_estado_lead?: number | null;
};

export type LeadAssignment = {
  id_asignacion: number;
  id_lead: number;
  id_usuario_empresa: number;
  id_asignado_usuario_empresa: number;
  fecha_asignacion?: string;
  estado: number;
  asignado?: {
    id_usuario_empresa: number;
    nombres?: string | null;
    apellidos?: string | null;
    email?: string | null;
  } | null;
};

export type Lead = LeadDraft & {
  id_lead: number;
  id_usuario_freeler?: number | null;
  fecha_creacion?: string;
  campania?: {
    id_campania: number;
    nombre: string;
    comision?: string | number | null;
    empresa?: {
      razon_social?: string | null;
    } | null;
  } | null;
  estado?: {
    id_estado_lead: number;
    nombre: string;
  } | null;
  asignaciones?: LeadAssignment[];
};

export type LeadCampaignSummary = {
  id_campania: number;
  nombre: string;
  totalReferidos: number;
};

export type LeadPaginatedResponse = {
  data: Lead[];
  total: number;
  page: number;
  limit: number;
  campaigns?: LeadCampaignSummary[];
};

export type LeadImportPreview = {
  importId: string;
  headers: string[];
  sampleRows: Record<string, string>[];
  suggestedMapping: Record<string, string>;
};

export type LeadImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type LeadImportJob = {
  importId: string;
  status: LeadImportJobStatus;
  total: number;
  processed: number;
  created: number;
  failed: number;
  errors: Array<{ row: number; issues: string[] }>;
  startedAt?: number;
  finishedAt?: number;
};

export type LeadAssignmentHistoryEntry = {
  id_asignacion: number;
  id_lead: number;
  fecha_asignacion: string;
  estado_asignacion: number;
  estado?: {
    id_estado_lead: number;
    nombre: string | null;
  } | null;
  actor?: {
    id_usuario_empresa: number;
    nombres?: string | null;
    apellidos?: string | null;
    email?: string | null;
  } | null;
  asignado?: {
    id_usuario_empresa: number;
    nombres?: string | null;
    apellidos?: string | null;
    email?: string | null;
  } | null;
};

export type LeadAssignmentHistory = {
  leadId: number;
  entries: LeadAssignmentHistoryEntry[];
};

const mapLeadPayload = (payload: Partial<LeadDraft>) => {
  const { id_usuario_freeler, ...rest } = payload;
  return {
    ...rest,
    ...(typeof id_usuario_freeler === 'number'
      ? { usuarioFreelerId: id_usuario_freeler }
      : {}),
  };
};

export const unwrapLeadCollection = <T = unknown>(payload: unknown): T[] => {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return payload as T[];
  }

  const candidate = payload as {
    data?: unknown;
    items?: unknown;
    total?: unknown;
  };

  if (Array.isArray(candidate.data)) {
    return candidate.data as T[];
  }

  if (Array.isArray(candidate.items)) {
    return candidate.items as T[];
  }

  const nested = (candidate.data as { data?: unknown } | undefined)?.data;
  if (Array.isArray(nested)) {
    return nested as T[];
  }

  return [];
};

const buildQueryParams = (params: Record<string, unknown> = {}) =>
  Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        if (typeof value === 'boolean') {
          return [key, value ? 'true' : 'false'];
        }
        return [key, value];
      }),
  );

const mergeLeadCollections = (...collections: Lead[][]): Lead[] => {
  const byId = new Map<number, Lead>();
  collections.forEach((collection) => {
    collection.forEach((lead) => {
      if (!lead || typeof lead.id_lead !== 'number') return;
      const current = byId.get(lead.id_lead);
      if (!current) {
        byId.set(lead.id_lead, lead);
        return;
      }
      const merged: Lead = {
        ...current,
        ...lead,
      };
      merged.fecha_creacion = lead.fecha_creacion ?? current.fecha_creacion;
      merged.estado = lead.estado ?? current.estado ?? null;
      merged.campania = lead.campania ?? current.campania ?? null;
      merged.asignaciones =
        lead.asignaciones && lead.asignaciones.length
          ? lead.asignaciones
          : current.asignaciones;
      byId.set(lead.id_lead, merged);
    });
  });
  return Array.from(byId.values()).sort((a, b) => {
    const dateA = new Date(a.fecha_creacion ?? 0).getTime();
    const dateB = new Date(b.fecha_creacion ?? 0).getTime();
    return dateB - dateA;
  });
};

export const LeadService = {
  async create(payload: LeadDraft) {
    const { data } = await api.post('/leads', mapLeadPayload(payload));
    return data as Lead;
  },
  async createDraft(payload: LeadDraft) {
    const { data } = await api.post('/leads/draft', mapLeadPayload(payload));
    return data as Lead;
  },
  async update(id: number, payload: Partial<LeadDraft>) {
    const { data } = await api.patch(`/leads/${id}`, mapLeadPayload(payload));
    return data as Lead;
  },
  async refreshCreatedAt(id: number) {
    const { data } = await api.patch(`/leads/${id}/refresh-created-at`);
    return data as Lead;
  },
  async findById(id: number) {
    const { data } = await api.get(`/leads/${id}`);
    return data as Lead;
  },
  async listMine(userId: number, params: Record<string, unknown> = {}) {
    const { data } = await api.get(`/leads/mine/by-user/${userId}`, {
      params: buildQueryParams(params),
    });
    return data;
  },
  async listAssignedToMe(params: Record<string, unknown> = {}) {
    const { data } = await api.get('/leads/assigned-to-me', {
      params: buildQueryParams(params),
    });
    return data;
  },
  async listAll(params: Record<string, unknown> = {}) {
    const { data } = await api.get('/leads', { params: buildQueryParams(params) });
    return data;
  },
  async listByEmpresa(params: Record<string, unknown> = {}) {
    const { data } = await api.get('/leads/by-empresa', {
      params: buildQueryParams(params),
    });
    return data as LeadPaginatedResponse;
  },
  async getStatuses() {
    const { data } = await api.get('/leads/catalogos/estado-lead');
    return data;
  },
  async updateStatus(payload: {
    leadId: number;
    id_estado_lead: number;
    usuarioEmpresaId: number;
  }) {
    const { data } = await api.post('/leads/status', payload);
    return data;
  },
  async markAsSold(payload: { leadId: number; usuarioEmpresaId: number }) {
    const { data } = await api.post('/leads/mark-sold', payload);
    return data;
  },
  async updateAsignacion(id: number, payload: { usuarioEmpresaId: number; estado: 'activo' | 'inactivo' }) {
    const { data } = await api.patch(`/leads/assignments/${id}`, payload);
    return data;
  },
  async bulkUpdateAsignaciones(payload: Record<string, unknown>) {
    const { data } = await api.patch('/leads/assignments/bulk', payload);
    return data;
  },
  async bulkUpdate(payload: {
    leadIds: number[];
    action: 'assign' | 'change-status';
    usuarioEmpresaId: number;
    vendedorId?: number | null;
    estadoId?: number | null;
  }) {
    if (!payload.leadIds.length) return { ok: true };

    if (payload.action === 'assign') {
      if (!payload.vendedorId) throw new Error('MISSING_VENDOR');
      await Promise.all(
        payload.leadIds.map((leadId) =>
          api.post('/leads/assign', {
            leadId,
            usuarioEmpresaId: payload.usuarioEmpresaId,
            asignarAUsuarioEmpresaId: payload.vendedorId,
          }),
        ),
      );
      return { ok: true };
    }

    if (payload.action === 'change-status') {
      if (!payload.estadoId) throw new Error('MISSING_STATUS');
      await Promise.all(
        payload.leadIds.map((leadId) =>
          api.post('/leads/status', {
            leadId,
            id_estado_lead: payload.estadoId,
            usuarioEmpresaId: payload.usuarioEmpresaId,
          }),
        ),
      );
      return { ok: true };
    }

    return { ok: false };
  },
  async previewImport(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/leads/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data as LeadImportPreview;
  },
  async confirmImport(payload: {
    importId: string;
    mapping: Record<string, string>;
    campaignId: number;
    actorLabel?: string;
  }) {
    const { data } = await api.post('/leads/import/confirm', payload);
    return data as LeadImportJob;
  },
  async getImportProgress(importId: string) {
    const { data } = await api.get(`/leads/import/status/${importId}`);
    return data as LeadImportJob;
  },
  // Descarga la plantilla oficial de importaciÃ³n usando el token del usuario
  async downloadImportTemplate() {
    const { data } = await api.get('/leads/import/template', {
      responseType: 'blob',
    });
    return data as Blob;
  },
  async collectAll(params: Record<string, unknown> = {}, pageSize = 200) {
    let page = 1;
    const items: Lead[] = [];
    let total = 0;
    while (true) {
      const response = await this.listAll({ ...params, page, limit: pageSize });
      const batch = unwrapLeadCollection<Lead>(response);
      items.push(...batch);
      const meta = (response as Partial<LeadPaginatedResponse>) ?? {};
      const responseTotal =
        typeof meta.total === 'number' ? meta.total : items.length;
      total = responseTotal;
      const responseLimit =
        typeof meta.limit === 'number' && meta.limit > 0 ? meta.limit : pageSize;
      if (batch.length < responseLimit || items.length >= total) {
        break;
      }
      page += 1;
    }
    return { data: items, total };
  },
  async collectByEmpresa(params: Record<string, unknown> = {}, pageSize = 200) {
    let page = 1;
    const items: Lead[] = [];
    let total = 0;
    while (true) {
      const response = await this.listByEmpresa({ ...params, page, limit: pageSize });
      const batch = unwrapLeadCollection<Lead>(response);
      items.push(...batch);
      const meta = (response as Partial<LeadPaginatedResponse>) ?? {};
      const responseTotal =
        typeof meta.total === 'number' ? meta.total : items.length;
      total = responseTotal;
      const responseLimit =
        typeof meta.limit === 'number' && meta.limit > 0 ? meta.limit : pageSize;
      if (batch.length < responseLimit || items.length >= total) {
        break;
      }
      page += 1;
    }
    return { data: items, total };
  },
  async collectForEmpresa(
    companyId: number,
    params: Record<string, unknown> = {},
    pageSize = 200,
  ) {
    return this.collectByEmpresa({ ...params, id_empresa: companyId }, pageSize);
  },
  async listVendorUniverse(options: {
    filters?: Record<string, unknown>;
    includeEmpresa?: boolean;
    freelerUserId?: number | null;
    empresaUserId?: number | null;
  } = {}) {
    const { filters = {}, includeEmpresa = true, freelerUserId, empresaUserId } = options;
    const { asignado_a_usuario_empresa_id: _omitAssignFilter, ...assignedFilters } = filters;
    const assignedPromise = this.listAssignedToMe(assignedFilters);
    const companyPromise = includeEmpresa
      ? this.listByEmpresa({
          ...filters,
          solo_referidos: false,
          ...(empresaUserId ? { asignado_a_usuario_empresa_id: empresaUserId } : {}),
        })
      : Promise.resolve(null);
    const freelerPromise = freelerUserId
      ? this.listMine(freelerUserId, filters)
      : Promise.resolve(null);
    const [assignedResult, companyResult, freelerResult] = await Promise.allSettled([
      assignedPromise,
      companyPromise,
      freelerPromise,
    ]);
    const assigned =
      assignedResult.status === 'fulfilled'
        ? unwrapLeadCollection<Lead>(assignedResult.value)
        : [];
    const company =
      companyResult.status === 'fulfilled'
        ? unwrapLeadCollection<Lead>(companyResult.value)
        : [];
    const freeler =
      freelerResult.status === 'fulfilled'
        ? unwrapLeadCollection<Lead>(freelerResult.value)
        : [];
    return mergeLeadCollections(assigned, company, freeler);
  },
  async assignLead(payload: { leadId: number; usuarioEmpresaId: number; asignarAUsuarioEmpresaId: number }) {
    const { data } = await api.post('/leads/assign', payload);
    return data;
  },
  async getAssignmentHistory(leadId: number) {
    const { data } = await api.get(`/leads/${leadId}/history`);
    return data as LeadAssignmentHistory;
  },
};
