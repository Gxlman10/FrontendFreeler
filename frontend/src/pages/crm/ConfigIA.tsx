import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { IaService } from '@/services/ia.service';
import { useToast } from '@/components/common/Toasts';

type FormState = {
  apiKey: string;
  provider: 'openai' | 'gemini' | 'groq';
  model: string;
  basePrompt: string;
  temperature: number;
  guidance: number;
  maxTokens: number;
};

const defaultForm: FormState = {
  apiKey: '',
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  basePrompt: '',
  temperature: 0.35,
  guidance: 0.6,
  maxTokens: 600,
};

export const ConfigIA = () => {
  const { push } = useToast();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [showToken, setShowToken] = useState(false);

  const configQuery = useQuery({
    queryKey: ['ia-config'],
    queryFn: () => IaService.getConfig(),
    staleTime: 1000 * 60 * 5,
    onSuccess: (config) => {
      setForm((prev) => ({
        ...prev,
        provider: (config.provider as 'openai' | 'gemini' | 'groq') ?? prev.provider,
        model: config.model ?? prev.model,
        basePrompt: config.basePrompt,
        temperature: Number(config.temperature ?? prev.temperature),
        guidance: Number(config.guidance ?? prev.guidance),
        maxTokens: Number(config.maxTokens ?? prev.maxTokens),
      }));
    },
  });

  const mutation = useMutation({
    mutationFn: () =>
      IaService.updateConfig({
        basePrompt: form.basePrompt,
        provider: form.provider,
        model: form.model,
        temperature: form.temperature,
        guidance: form.guidance,
        maxTokens: form.maxTokens,
        apiKey: form.apiKey || undefined,
      }),
    onSuccess: () => {
      push({ title: 'Configuración guardada', description: 'Los cambios se aplicaron correctamente.' });
      configQuery.refetch();
      setForm((prev) => ({ ...prev, apiKey: '' }));
    },
    onError: () => {
      push({
        title: 'No se pudo guardar',
        description: 'Revisa tu conexión o intenta nuevamente.',
        variant: 'danger',
      });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  useEffect(() => {
    document.title = 'Configuración IA - Freeler CRM';
  }, []);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-content">Configurar asistente IA</h1>
        <p className="text-sm text-content-muted">
          Administra el token y los parámetros básicos que usa la IA para capacitar a los freelers.
        </p>
      </header>

      <form
        className="space-y-6 rounded-xl border border-border bg-surface p-6 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Token del proveedor"
            type={showToken ? 'text' : 'password'}
            placeholder={configQuery.data?.tokenMasked ?? 'sk-***'}
            value={form.apiKey}
            onChange={(event) => setForm((prev) => ({ ...prev, apiKey: event.target.value }))}
            helperText="Se guarda cifrado y se usa solo para generar respuestas."
            trailingElement={
              <button
                type="button"
                className="text-xs font-medium text-primary-600"
                onClick={() => setShowToken((value) => !value)}
              >
                {showToken ? 'Ocultar' : 'Mostrar'}
              </button>
            }
          />
          <Select
            label="Proveedor de IA"
            value={form.provider}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                provider: event.target.value as 'openai' | 'gemini' | 'groq',
              }))
            }
            options={[
              { label: 'OpenAI (ChatGPT)', value: 'openai' },
              { label: 'Google Gemini', value: 'gemini' },
              { label: 'Groq (Llama)', value: 'groq' },
            ]}
            helperText="Selecciona la plataforma que deseas usar."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Modelo"
            value={form.model}
            onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
            helperText={
              form.provider === 'gemini'
                ? 'Ejemplo: gemini-1.5-flash'
                : form.provider === 'groq'
                  ? 'Ejemplo: llama-3.1-8b-instant'
                  : 'Ejemplo: gpt-3.5-turbo'
            }
          />
          <Input
            label="Máx. tokens por respuesta"
            type="number"
            min={128}
            max={2048}
            value={form.maxTokens}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, maxTokens: Number(event.target.value) || prev.maxTokens }))
            }
          />
        </div>

        <TextArea
          label="Mensaje base"
          value={form.basePrompt}
          onChange={(event) => setForm((prev) => ({ ...prev, basePrompt: event.target.value }))}
          rows={5}
          placeholder="Describe cómo debe ayudar la IA a tus freelers."
        />

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-content">Creatividad</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={form.temperature}
              onChange={(event) => setForm((prev) => ({ ...prev, temperature: Number(event.target.value) }))}
              className="w-full"
            />
            <p className="mt-1 text-xs text-content-muted">
              Controla qué tan creativas pueden ser las respuestas ({form.temperature.toFixed(2)}).
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-content">Guía / Enfoque</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={form.guidance}
              onChange={(event) => setForm((prev) => ({ ...prev, guidance: Number(event.target.value) }))}
              className="w-full"
            />
            <p className="mt-1 text-xs text-content-muted">
              Aumenta para que la IA se mantenga enfocada en capacitación ({form.guidance.toFixed(2)}).
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </section>
  );
};

export default ConfigIA;
