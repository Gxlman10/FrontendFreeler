import { api } from './api';
import type { LeadAssignment } from './lead.service';
import { buildQueryParams } from '@/utils/http';

export type CommissionRequest = {
  id_solicitud: number;
  metodo_pago: 'yape' | 'transferencia' | 'plin';
  datos_pago?: Record<string, unknown> | null;
  estado: 'pendiente' | 'pagada' | 'rechazada';
  fecha_solicitud: string;
  fecha_resolucion?: string | null;
};

export type Commission = {
  id_comision: number;
  id_lead?: number | null;
  id_usuario_freeler?: number | null;
  id_campania?: number | null;
  monto: string;
  id_estado_comision?: number | null;
  fecha_pago?: string | null;
  fecha_generada?: string | null;
  freeler?: {
    id_usuario_freeler: number;
    nombres?: string | null;
    apellidos?: string | null;
    email?: string | null;
  } | null;
  campania?: {
    id_campania?: number | null;
    nombre?: string | null;
  } | null;
  lead?: {
    id_lead?: number | null;
    nombres?: string | null;
    apellidos?: string | null;
    fecha_creacion?: string | null;
    asignaciones?: LeadAssignment[];
  } | null;
  retiros?: CommissionRequest[];
};

export type CommissionPaginatedResponse = {
  data: Commission[];
  total: number;
  page?: number;
  limit?: number;
};

export type CommissionSummary = {
  totals: {
    pendiente: number;
    solicitada: number;
    pagada: number;
  };
  byCampaign: Array<{
    id_campania: number | null;
    nombre: string;
    pendiente: number;
    pagada: number;
    total: number;
  }>;
  commissions: Array<
    Commission & {
      campania?: { nombre?: string | null } | null;
    }
  >;
};

const coerceNumber = (value?: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildFallbackSummary = (commissions: Commission[]): CommissionSummary => {
  const totals = {
    pendiente: 0,
    solicitada: 0,
    pagada: 0,
  };
  const byCampaignMap = new Map<
    number | null,
    { id_campania: number | null; nombre: string; pendiente: number; pagada: number; total: number }
  >();

  commissions.forEach((commission) => {
    const amount = coerceNumber(commission.monto);
    const estado = commission.id_estado_comision ?? 0;
    if (estado === 1) totals.pendiente += amount;
    else if (estado === 2) totals.solicitada += amount;
    else if (estado === 3) totals.pagada += amount;

    const key = commission.campania?.id_campania ?? null;
    if (!byCampaignMap.has(key)) {
      byCampaignMap.set(key, {
        id_campania: key,
        nombre: commission.campania?.nombre ?? 'Sin campana',
        pendiente: 0,
        pagada: 0,
        total: 0,
      });
    }
    const entry = byCampaignMap.get(key)!;
    if (estado === 3) entry.pagada += amount;
    else entry.pendiente += amount;
    entry.total += amount;
  });

  return {
    totals,
    byCampaign: Array.from(byCampaignMap.values()),
    commissions,
  };
};

export const CommissionService = {
  async list(params: Record<string, unknown> = {}) {
    const { data } = await api.get('/comisiones', {
      params: buildQueryParams(params),
    });
    return data as CommissionPaginatedResponse | Commission[];
  },
  async getMySummary(userId?: number | null) {
    try {
      const { data } = await api.get('/comisiones/mine');
      return data as CommissionSummary;
    } catch (error) {
      if (!userId) throw error;
      try {
        const response = await this.list({ id_usuario_freeler: userId, limit: 500 });
        const commissions = Array.isArray((response as CommissionPaginatedResponse)?.data)
          ? (response as CommissionPaginatedResponse).data ?? []
          : Array.isArray(response)
            ? (response as Commission[])
            : [];
        return buildFallbackSummary(commissions);
      } catch {
        throw error;
      }
    }
  },
  async requestMyPayout(payload: {
    metodo_pago: 'yape' | 'transferencia';
    telefono_yape?: string;
    nombres_yape?: string;
    cci?: string;
    titular?: string;
    banco?: string;
    notas?: string;
    commissionIds?: number[];
  }) {
    const { data } = await api.post('/comisiones/mine/request', payload);
    return data;
  },
  async requestPayout(
    commissionId: number,
    payload: {
      metodo_pago: 'yape' | 'transferencia';
      telefono_yape?: string;
      nombres_yape?: string;
      cci?: string;
      titular?: string;
      banco?: string;
      notas?: string;
    },
  ) {
    try {
      const { data } = await api.post(`/comisiones/${commissionId}/request-payout`, payload);
      return data;
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 401 || status === 403) {
        const { data } = await api.post('/comisiones/mine/request', {
          ...payload,
          commissionIds: [commissionId],
        });
        return data;
      }
      throw error;
    }
  },
  async resolvePayment(
    commissionId: number,
    payload: { estado: 'pagado' | 'pendiente' },
  ) {
    const { data } = await api.post(
      `/comisiones/${commissionId}/pay`,
      payload,
    );
    return data;
  },
  async collectAll(params: Record<string, unknown> = {}, pageSize = 200) {
    let page = 1;
    const items: Commission[] = [];
    let total = 0;
    while (true) {
      const response = await this.list({ ...params, page, limit: pageSize });
      const batch = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : [];
      items.push(...batch);
      const meta = (response as Partial<CommissionPaginatedResponse>) ?? {};
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
};

export default CommissionService;
