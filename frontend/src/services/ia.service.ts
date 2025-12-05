import { api } from './api';

export type IaConfig = {
  provider: string;
  model: string;
  basePrompt: string;
  temperature: number;
  guidance: number;
  maxTokens: number;
  tokenMasked: string | null;
  updatedAt?: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const IaService = {
  async getConfig() {
    const { data } = await api.get('/ia-config');
    return data as IaConfig;
  },
  async updateConfig(payload: Partial<IaConfig> & { apiKey?: string }) {
    const { data } = await api.put('/ia-config', payload);
    return data as { message: string; updatedAt?: string };
  },
  async chat(payload: { message: string; history?: ChatMessage[] }) {
    const { data } = await api.post('/ia-config/chat', payload);
    return data as { reply: string };
  },
};

export default IaService;
