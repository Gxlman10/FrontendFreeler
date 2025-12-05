import { api } from './api';

const GRAPH_PERU_ENDPOINT = 'https://graphperu.daustinn.com/api/query';

type DniResponse = {
  documentID: string;
  names?: string;
  surnames?: string;
  fullName?: string;
  paternalLastName?: string;
  maternalLastName?: string;
  error?: string;
};

type RucResponse = {
  documentID: string;
  name?: string;
  address?: string;
  district?: string;
  province?: string;
  region?: string;
  error?: string;
};

type BackendDniResponse = {
  dni: string;
  nombres: string | null;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  verificador?: string | null;
};

type BackendRucResponse = {
  ruc: string;
  razonSocial: string | null;
  nombreComercial: string | null;
  estado: string | null;
  condicion: string | null;
  direccion: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  telefonos: string[];
  ubigeo: string | null;
  capital: string | null;
};

const toFrontDni = (payload: BackendDniResponse): DniResponse => ({
  documentID: payload.dni,
  names: payload.nombres ?? undefined,
  paternalLastName: payload.apellidoPaterno ?? undefined,
  maternalLastName: payload.apellidoMaterno ?? undefined,
  fullName: [payload.nombres, payload.apellidoPaterno, payload.apellidoMaterno]
    .filter(Boolean)
    .join(' ')
    .trim(),
});

const toFrontRuc = (payload: BackendRucResponse): RucResponse => ({
  documentID: payload.ruc,
  name: payload.razonSocial ?? payload.nombreComercial ?? undefined,
  address: payload.direccion ?? undefined,
  district: payload.distrito ?? undefined,
  province: payload.provincia ?? undefined,
  region: payload.departamento ?? undefined,
});

const fetchGraphPeru = async (documentId: string) => {
  try {
    const response = await fetch(`${GRAPH_PERU_ENDPOINT}/${documentId}`);
    if (!response.ok) return null;
    const data = (await response.json()) as DniResponse | RucResponse;
    if ('error' in data && data.error) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

export const queryDocument = async <T extends DniResponse | RucResponse>(
  documentId: string,
): Promise<T | null> => {
  const trimmed = (documentId ?? '').trim();
  if (!trimmed) return null;
  const isDni = /^\d{8}$/.test(trimmed);
  const isRuc = /^\d{11}$/.test(trimmed);

  if (!isDni && !isRuc) return fetchGraphPeru(trimmed) as Promise<T | null>;

  const endpoint = isDni ? `/documentos/dni/${trimmed}` : `/documentos/ruc/${trimmed}`;

  try {
    const { data } = await api.get<BackendDniResponse | BackendRucResponse>(endpoint);
    if (isDni) {
      return toFrontDni(data as BackendDniResponse) as T;
    }
    return toFrontRuc(data as BackendRucResponse) as T;
  } catch {
    const fallback = await fetchGraphPeru(trimmed);
    return (fallback as T | null) ?? null;
  }
};

export type { DniResponse, RucResponse };
