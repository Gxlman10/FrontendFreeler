import { api } from './api';

export type Empresa = {
  id_empresa: number;
  razon_social: string;
  ruc?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  estado?: number | string | null;
  representante_legal?: string | null;
};

export type UsuarioEmpresa = {
  id_usuario_empresa: number;
  id_empresa: number;
  nombres: string;
  apellidos: string;
  email: string;
  estado: number;
  rol?: {
    id_rol: number;
    nombre: string;
  } | null;
};

export type UsuarioFreeler = {
  id_usuario_freeler: number;
  nombres: string;
  apellidos: string;
  email: string;
  telefono?: string;
  estado: number;
};

export const UserService = {
  async getEmpresas(params?: Record<string, unknown>) {
    const { data } = await api.get('/empresas', { params });
    return data;
  },

  async createEmpresa(payload: Partial<Empresa>) {
    const { data } = await api.post('/empresas', payload);
    return data as Empresa;
  },

  async updateEmpresa(id: number, payload: Partial<Empresa>) {
    const { data } = await api.patch(`/empresas/${id}`, payload);
    return data as Empresa;
  },

  async deleteEmpresa(id: number) {
    await api.delete(`/empresas/${id}`);
  },

  async getUsuariosEmpresa(params?: Record<string, unknown>) {
    const { data } = await api.get('/usuarios-empresa', { params });
    return data;
  },

  async createUsuarioEmpresa(payload: Partial<UsuarioEmpresa>) {
    const { data } = await api.post('/usuarios-empresa', payload);
    return data as UsuarioEmpresa;
  },

  async updateUsuarioEmpresa(id: number, payload: Partial<UsuarioEmpresa>) {
    const { data } = await api.patch(`/usuarios-empresa/${id}`, payload);
    return data as UsuarioEmpresa;
  },

  async deleteUsuarioEmpresa(id: number) {
    await api.delete(`/usuarios-empresa/${id}`);
  },

  async getUsuariosFreeler(params?: Record<string, unknown>) {
    const { data } = await api.get('/usuarios-freeler', { params });
    return data;
  },

  async getUsuarioFreelerById(id: number) {
    const { data } = await api.get(`/usuarios-freeler/${id}`);
    return data as UsuarioFreeler;
  },

  async updateUsuarioFreeler(id: number, payload: Partial<UsuarioFreeler>) {
    const { data } = await api.patch(`/usuarios-freeler/${id}`, payload);
    return data as UsuarioFreeler;
  },
};
