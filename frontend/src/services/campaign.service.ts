import { api } from './api';

export type Campaign = {
  id_campania: number;
  id_empresa?: number | null;
  empresa?: {
    razon_social?: string | null;
    ruc?: string | null;
  } | null;
  nombre: string;
  descripcion?: string | null;
  ubicacion?: string | null;
  comision: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: number;
  totalReferidos?: number;
};

export type CampaignFilters = {
  search?: string;
  id_empresa?: number;
  estado?: number;
  fecha_inicio_desde?: string;
  fecha_fin_hasta?: string;
  page?: number;
  limit?: number;
};

export type CreateCampaignPayload = {
  id_empresa: number;
  usuarioEmpresaId: number;
  nombre: string;
  descripcion?: string;
  ubicacion?: string;
  comision: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado?: number;
};

const toApiPayload = (payload: CreateCampaignPayload) => ({
  ...payload,
  comision: payload.comision.toFixed(2),
});

export const CampaignService = {
  async getAll(filters: CampaignFilters = {}) {
    const { data } = await api.get('/campanas', { params: filters });
    return data;
  },
  async getById(id: number) {
    const { data } = await api.get(`/campanas/${id}`);
    return data as Campaign;
  },
  async create(payload: CreateCampaignPayload) {
    const { data } = await api.post('/campanas', toApiPayload(payload));
    return data as Campaign;
  },
  async update(id: number, payload: Partial<CreateCampaignPayload>) {
    const body =
      payload && typeof payload.comision === 'number'
        ? { ...payload, comision: payload.comision.toFixed(2) }
        : payload;
    const { data } = await api.patch(`/campanas/${id}`, body);
    return data as Campaign;
  },
  async remove(id: number) {
    await api.delete(`/campanas/${id}`);
  },
};
