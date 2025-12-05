import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { LeadService } from '@/services/lead.service';
import type { Lead, LeadDraft } from '@/services/lead.service';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { useAuth } from '@/store/auth';
import { useToast } from '@/components/common/Toasts';
import { isValidDni, isValidEmail } from '@/utils/validators';
import { queryDocument } from '@/services/document.service';

type LeadFormProps = {
  campaignId?: number;
  lead?: Lead | null;
  onSubmitted?: (leadId: number, status: 'draft' | 'sent') => void;
};

const ORIGIN_VALUE = 'Freeler';

const sanitizePhone = (value?: string | null) =>
  value ? value.replace(/\D/g, '').replace(/^51/, '').slice(0, 9) : '';

const buildInitialDraft = (params: {
  campaignId?: number;
  lead?: Lead | null;
  userId?: number;
  isFreeler: boolean;
}): LeadDraft => {
  const { campaignId, lead, userId, isFreeler } = params;
  return {
    nombres: lead?.nombres ?? '',
    apellidos: lead?.apellidos ?? '',
    dni: lead?.dni ?? '',
    email: lead?.email ?? '',
    telefono: sanitizePhone(lead?.telefono),
    ciudad: lead?.ciudad ?? '',
    ocupacion: lead?.ocupacion ?? '',
    descripcion: lead?.descripcion ?? '',
    origen: lead?.origen ?? ORIGIN_VALUE,
    id_campania: lead?.id_campania ?? campaignId,
    id_usuario_freeler: lead?.id_usuario_freeler ?? (isFreeler ? userId : undefined),
    estado_completo: lead?.estado_completo ?? false,
  };
};

export const LeadForm = ({ campaignId, lead = null, onSubmitted }: LeadFormProps) => {
  const { user } = useAuth();
  const { push } = useToast();
  const isFreeler = user?.type === 'freeler';
  const userId = user?.id;
  const [form, setForm] = useState<LeadDraft>(() =>
    buildInitialDraft({ campaignId, lead, userId, isFreeler }),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dniStatus, setDniStatus] = useState<'idle' | 'loading' | 'success' | 'not-found'>('idle');
  const lastLookupRef = useRef<string>('');
  const isEditing = Boolean(lead);

  useEffect(() => {
    setForm(buildInitialDraft({ campaignId, lead, userId, isFreeler }));
    setErrors({});
    setFeedback(null);
    setDniStatus('idle');
  }, [campaignId, lead, userId, isFreeler]);

  useEffect(() => {
    const value = (form.dni ?? '').trim();
    if (value.length !== 8) {
      setDniStatus('idle');
      return;
    }

    if (lastLookupRef.current === value) return;

    let cancelled = false;
    setDniStatus('loading');

    queryDocument(value)
      .then((data) => {
        if (cancelled) return;
        if (data && 'names' in data) {
          setForm((prev) => {
            const surnames =
              data.surnames ??
              [data.paternalLastName, data.maternalLastName].filter(Boolean).join(' ');

            return {
              ...prev,
              nombres: data.names ?? prev.nombres,
              apellidos: (surnames && surnames.trim()) ? surnames : prev.apellidos,
            };
          });
          setDniStatus('success');
        } else {
          setDniStatus('not-found');
        }
        lastLookupRef.current = value;
      })
      .catch(() => {
        if (!cancelled) setDniStatus('not-found');
      });

    return () => {
      cancelled = true;
    };
  }, [form.dni]);

  const clearError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleChange =
    (field: keyof LeadDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setForm((prev) => {
        if (field === 'telefono') {
          const digits = value.replace(/\D/g, '').slice(0, 9);
          return { ...prev, telefono: digits };
        }
        if (field === 'dni') {
          const digits = value.replace(/\D/g, '').slice(0, 8);
          return { ...prev, dni: digits };
        }
        return { ...prev, [field]: value };
      });
      clearError(field as string);
    };

  const ensureFreelerSession = () => {
    if (!isFreeler || !userId) {
      push({
        title: 'Sesin requerida',
        description: 'Debes iniciar sesin como freeler para registrar referidos.',
        variant: 'danger',
      });
      return false;
    }
    return true;
  };

  const buildPayload = (overrides: Partial<LeadDraft> = {}): LeadDraft => {
    const digits = (form.telefono ?? '').replace(/\D/g, '').slice(0, 9);
    const formattedPhone = digits ? `+51${digits}` : undefined;
    return {
      nombres: form.nombres?.trim() || undefined,
      apellidos: form.apellidos?.trim() || undefined,
      dni: form.dni?.trim() || undefined,
      email: form.email?.trim() || undefined,
      telefono: formattedPhone,
      ciudad: form.ciudad?.trim() || undefined,
      ocupacion: form.ocupacion?.trim() || undefined,
      descripcion: form.descripcion?.trim() || undefined,
      origen: ORIGIN_VALUE,
      id_campania: form.id_campania ?? campaignId,
      id_usuario_freeler:
        form.id_usuario_freeler ?? (isFreeler && userId ? userId : undefined),
      estado_completo: overrides.estado_completo ?? form.estado_completo,
      ...overrides,
    };
  };

  const draftValidationErrors = useMemo(() => {
    const next: Record<string, string> = {};
    if (form.email && !isValidEmail(form.email)) next.email = 'Ingresa un correo valido.';
    const digits = (form.telefono ?? '').replace(/\D/g, '');
    if (digits && digits.length !== 9) next.telefono = 'Ingresa 9 dgitos o deja vaco.';
    if (form.dni && form.dni.length !== 8) next.dni = 'El DNI debe tener 8 dgitos.';
    return next;
  }, [form.email, form.telefono, form.dni]);

  const handleSaveDraft = async () => {
    if (!ensureFreelerSession()) return;
    setIsSavingDraft(true);
    setFeedback(null);

    try {
      const payload = buildPayload({ estado_completo: false });
      const response = isEditing
        ? await LeadService.update(lead!.id_lead, payload)
        : await LeadService.createDraft(payload);
      push({
        title: 'Borrador guardado',
        description: 'Tus datos quedaron registrados en la plataforma.',
      });
      onSubmitted?.(response.id_lead, 'draft');
    } catch (error) {
      push({
        title: 'No pudimos guardar el borrador',
        description: 'Intenta nuevamente en unos segundos.',
        variant: 'danger',
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ensureFreelerSession()) return;
    setIsSubmitting(true);
    setFeedback(null);

    const nextErrors: Record<string, string> = {};
    if (!isValidDni(form.dni ?? '')) nextErrors.dni = 'Ingresa un DNI valido (8 dgitos).';
    if (!form.nombres?.trim()) nextErrors.nombres = 'Ingresa el nombre del referido.';
    if (!form.apellidos?.trim()) nextErrors.apellidos = 'Ingresa los apellidos del referido.';
    const phoneDigits = (form.telefono ?? '').replace(/\D/g, '');
    if (phoneDigits.length !== 9) nextErrors.telefono = 'Ingresa un nmero valido (9 dgitos).';
    if (form.email && !isValidEmail(form.email)) nextErrors.email = 'Ingresa un correo valido.';
    if (!form.ciudad?.trim()) nextErrors.ciudad = 'Ingresa la ciudad.';
    if (!form.ocupacion?.trim()) nextErrors.ocupacion = 'Ingresa la ocupacin.';
    if (!form.descripcion?.trim()) nextErrors.descripcion = 'Describe brevemente el referido.';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = buildPayload({ estado_completo: true });
      const response = isEditing
        ? await LeadService.update(lead!.id_lead, payload)
        : await LeadService.create(payload);
      let finalResponse = response;
      if (isEditing && !lead?.estado_completo) {
        try {
          finalResponse = await LeadService.refreshCreatedAt(response.id_lead);
        } catch {
          push({
            title: 'Fecha de ingreso no actualizada',
            description: 'El lead se envio, pero no pudimos refrescar la fecha.',
            variant: 'warning',
          });
        }
      }

      setErrors({});
      setFeedback(
        `Lead enviado con exito${finalResponse?.id_lead ? ` (ID ${finalResponse.id_lead})` : ''}.`,
      );
      push({
        title: 'Referido registrado',
        description: 'Compartimos los datos con el equipo de campaas.',
      });
      onSubmitted?.(finalResponse.id_lead, 'sent');
    } catch (error) {
      setFeedback('Ocurrio un problema al enviar el lead. Intenta nuevamente.');
      push({
        title: 'No pudimos registrar el referido',
        description: 'Revisa los datos e intenta nuevamente.',
        variant: 'danger',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="DNI"
          required
          value={form.dni ?? ''}
          inputMode="numeric"
          maxLength={8}
          leadingElement={
            dniStatus === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : dniStatus === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin text-content-muted" />
            ) : undefined
          }
          isValid={dniStatus === 'success'}
          helperText={dniStatus === 'not-found' ? 'No encontramos datos para este DNI.' : undefined}
          error={errors.dni ?? draftValidationErrors.dni}
          onChange={handleChange('dni')}
        />
        <Input
          label="Nombres"
          required
          value={form.nombres ?? ''}
          error={errors.nombres}
          onChange={handleChange('nombres')}
        />
        <Input
          label="Apellidos"
          required
          value={form.apellidos ?? ''}
          error={errors.apellidos}
          onChange={handleChange('apellidos')}
        />
        <Input
          label="Telefono (WhatsApp)"
          required
          value={form.telefono ?? ''}
          inputMode="tel"
          leadingElement={<span className="text-xs font-semibold text-content-muted">+51</span>}
          helperText="Ingresa solo numeros, sin espacios."
          error={errors.telefono ?? draftValidationErrors.telefono}
          onChange={handleChange('telefono')}
        />
        <Input
          label="Correo"
          type="email"
          value={form.email ?? ''}
          error={errors.email ?? draftValidationErrors.email}
          onChange={handleChange('email')}
        />
        <Input
          label="Ciudad"
          required
          value={form.ciudad ?? ''}
          error={errors.ciudad}
          onChange={handleChange('ciudad')}
        />
        <Input
          label="Ocupacion"
          required
          value={form.ocupacion ?? ''}
          error={errors.ocupacion}
          onChange={handleChange('ocupacion')}
        />
      </div>
      <TextArea
        label="Descripcion"
        minRows={3}
        required
        value={form.descripcion ?? ''}
        error={errors.descripcion}
        onChange={handleChange('descripcion')}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={handleSaveDraft} isLoading={isSavingDraft}>
          Guardar borrador
        </Button>
        <Button type="submit" isLoading={isSubmitting} disabled={isSavingDraft}>
          Enviar
        </Button>
      </div>
      {feedback && <p className="text-sm text-content-muted">{feedback}</p>}
    </form>
  );
};

export default LeadForm;
