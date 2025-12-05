import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { useToast } from '@/components/common/Toasts';
import { APP_ROUTES } from '@/utils/constants';
import { isStrongPassword, isValidEmail, isValidRuc } from '@/utils/validators';
import { queryDocument } from '@/services/document.service';
import { UserService, type Empresa } from '@/services/user.service';

const STEP_LABELS = ['Empresa', 'Administrador'];

export const RegisterCrm = () => {
  const { push } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);

  const [companyForm, setCompanyForm] = useState({
    ruc: '',
    nombre: '',
    direccion: '',
    email: '',
    telefono: '',
  });

  const [userForm, setUserForm] = useState({
    nombres: '',
    apellidos: '',
    email: '',
    password: '',
  });

  const [isRepresentativeLegal, setRepresentativeLegal] = useState(false);
  const [showGuideAlert, setShowGuideAlert] = useState(true);

  const [errorsStep1, setErrorsStep1] = useState<Record<string, string>>({});
  const [errorsStep2, setErrorsStep2] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rucStatus, setRucStatus] = useState<'idle' | 'loading' | 'success' | 'not-found'>('idle');
  const lastLookupRef = useRef<string>('');

  useEffect(() => {
    const value = companyForm.ruc.trim();
    if (value.length !== 11) {
      setRucStatus('idle');
      return;
    }
    if (lastLookupRef.current === value) return;

    let cancelled = false;
    setRucStatus('loading');

    queryDocument(value)
      .then((data) => {
        if (cancelled) return;
        if (data && 'name' in data) {
          setCompanyForm((prev) => ({
            ...prev,
            nombre: data.name ?? prev.nombre,
            direccion: data.address ?? prev.direccion,
          }));
          setRucStatus('success');
        } else {
          setRucStatus('not-found');
        }
        lastLookupRef.current = value;
      })
      .catch(() => {
        if (!cancelled) setRucStatus('not-found');
      });

    return () => {
      cancelled = true;
    };
  }, [companyForm.ruc]);

  const handleCompanySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errs: Record<string, string> = {};
    if (!isValidRuc(companyForm.ruc)) errs.ruc = 'Ingresa un RUC valido (11 digitos).';
    if (!companyForm.nombre.trim()) errs.nombre = 'La razon social es obligatoria.';
    if (!isValidEmail(companyForm.email)) errs.email = 'Ingresa un correo valido.';
    if (companyForm.telefono.replace(/\D/g, '').length !== 9) {
      errs.telefono = 'Ingresa un numero valido (9 digitos).';
    }

    if (Object.keys(errs).length > 0) {
      setErrorsStep1(errs);
      return;
    }

    setErrorsStep1({});
    setUserForm((prev) => ({ ...prev, email: companyForm.email }));
    setRepresentativeLegal(false);
    push({ title: 'Datos de empresa guardados', description: 'Completa los datos del administrador.' });
    setStep(2);
  };

  const fetchCompanyIdByRuc = async (ruc: string): Promise<number | null> => {
    try {
      const response = await UserService.getEmpresas({ search: ruc });
      const candidates: Empresa[] = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
        ? response
        : Array.isArray((response as any)?.items)
        ? (response as any).items
        : [];
      const match = candidates.find((empresa) => empresa.ruc === ruc);
      return match?.id_empresa ?? null;
    } catch {
      return null;
    }
  };

  const handleUserSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errs: Record<string, string> = {};
    if (!userForm.nombres.trim()) errs.nombres = 'Ingresa los nombres del usuario.';
    if (!userForm.apellidos.trim()) errs.apellidos = 'Ingresa los apellidos del usuario.';
    if (!isValidEmail(userForm.email)) errs.email = 'Ingresa un correo valido.';
    if (!isStrongPassword(userForm.password))
      errs.password = 'La contrasena debe tener al menos 8 caracteres y combinar letras y numeros.';

    if (Object.keys(errs).length > 0) {
      setErrorsStep2(errs);
      return;
    }

    setErrorsStep2({});
    setIsSubmitting(true);
    try {
      const phoneDigits = companyForm.telefono.replace(/\D/g, '');
      const companyPayload = {
        razon_social: companyForm.nombre.trim(),
        ruc: companyForm.ruc.trim(),
        direccion: companyForm.direccion.trim() || undefined,
        email: companyForm.email.trim(),
        telefono: phoneDigits ? `+51${phoneDigits}` : undefined,
        representante_legal: isRepresentativeLegal
          ? `${userForm.nombres.trim()} ${userForm.apellidos.trim()}`.trim()
          : undefined,
      };

      let empresaId: number | null = null;
      try {
        const empresa = await UserService.createEmpresa(companyPayload);
        empresaId = (empresa as any)?.id_empresa ?? (empresa as any)?.id ?? null;
      } catch (error) {
        const fallback = await fetchCompanyIdByRuc(companyForm.ruc.trim());
        if (fallback) {
          empresaId = fallback;
        } else {
          const message = (error as any)?.response?.data?.message ?? 'No se pudo registrar la empresa.';
          push({
            title: 'Error al registrar empresa',
            description: Array.isArray(message) ? message.join(' ') : message,
            variant: 'danger',
          });
          setIsSubmitting(false);
          return;
        }
      }

      if (!empresaId) {
        empresaId = await fetchCompanyIdByRuc(companyForm.ruc.trim());
      }

      if (!empresaId) {
        push({
          title: 'No encontramos la empresa',
          description: 'Valida el RUC e intenta nuevamente.',
          variant: 'danger',
        });
        setIsSubmitting(false);
        return;
      }

      await UserService.createUsuarioEmpresa({
        id_empresa: empresaId,
        id_rol: 1,
        nombres: userForm.nombres.trim(),
        apellidos: userForm.apellidos.trim(),
        email: userForm.email.trim(),
        password: userForm.password,
        estado: 1,
      });
      push({
        title: 'Registro completado',
        description: 'Ya puedes iniciar sesion en el CRM.',
      });
      navigate(APP_ROUTES.crm.login, { replace: true });
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'No se pudo crear el usuario.';
      push({
        title: 'Error al crear usuario',
        description: Array.isArray(message) ? message.join(' ') : message,
        variant: 'danger',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-160px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl rounded-lg border border-border-subtle bg-surface p-8 shadow-card backdrop-blur">
        <img src="/freeler_logo.svg" alt="Freeler" className="mx-auto mb-4 h-10 w-auto" />
        {showGuideAlert && (
          <Alert
            variant="info"
            title="Registro guiado"
            description="Completa los datos de la empresa y luego del administrador."
            onClose={() => setShowGuideAlert(false)}
            className="mb-4"
          />
        )}
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-semibold">Registro de Empresa</h1>
          <p className="mt-1 text-sm text-content-muted">
            1. Registra a tu empresa   |  2. Registra el primer usuario.
          </p>
        </header>

        <div className="mb-8 flex items-center gap-3">
          {STEP_LABELS.map((label, index) => {
            const current = index + 1;
            const active = step >= current;
            return (
              <div key={label} className="flex w-full items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                    active ? 'bg-primary-600 text-white' : 'bg-surface-muted text-content-subtle'
                  }`}
                >
                  {current}
                </div>
                {index < STEP_LABELS.length - 1 && (
                  <div className={`h-1 flex-1 rounded-full ${step > current ? 'bg-primary-500' : 'bg-surface-muted'}`} />
                )}
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCompanySubmit}>
            <Input
              label="RUC"
              name="ruc"
              autoComplete="off"
              required
              value={companyForm.ruc}
              error={errorsStep1.ruc}
              className="md:col-span-2"
              inputMode="numeric"
              maxLength={11}
              leadingElement={
                rucStatus === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : rucStatus === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-content-muted" />
                ) : undefined
              }
              isValid={rucStatus === 'success'}
              helperText={rucStatus === 'not-found' ? 'No se encontraron datos automaticos para este RUC.' : undefined}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, '').slice(0, 11);
                setCompanyForm((prev) => ({ ...prev, ruc: digits }));
                if (errorsStep1.ruc) {
                  setErrorsStep1((prev) => {
                    const next = { ...prev };
                    delete next.ruc;
                    return next;
                  });
                }
              }}
            />
            <Input
              label="Razon social"
              name="razonSocial"
              autoComplete="organization"
              required
              value={companyForm.nombre}
              error={errorsStep1.nombre}
              className="md:col-span-2"
              onChange={(event) => {
                setCompanyForm((prev) => ({ ...prev, nombre: event.target.value }));
                if (errorsStep1.nombre) {
                  setErrorsStep1((prev) => {
                    const next = { ...prev };
                    delete next.nombre;
                    return next;
                  });
                }
              }}
            />
            <Input
              label="Direccion"
              name="direccion"
              autoComplete="street-address"
              className="md:col-span-2"
              value={companyForm.direccion}
              onChange={(event) =>
                setCompanyForm((prev) => ({ ...prev, direccion: event.target.value }))
              }
            />
            <Input
              label="Correo de contacto"
              type="email"
              name="correoEmpresa"
              autoComplete="email"
              required
              value={companyForm.email}
              error={errorsStep1.email}
              onChange={(event) => {
                setCompanyForm((prev) => ({ ...prev, email: event.target.value }));
                if (errorsStep1.email) {
                  setErrorsStep1((prev) => {
                    const next = { ...prev };
                    delete next.email;
                    return next;
                  });
                }
              }}
            />
            <Input
            label="Telefono"
            name="telefonoEmpresa"
            required
            value={companyForm.telefono}
            inputMode="tel"
            autoComplete="tel"
            leadingElement={<span className="text-xs font-semibold text-content-muted">+51</span>}
            helperText="Ingresa 9 digitos para el numero de contacto."
              error={errorsStep1.telefono}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, '').slice(0, 9);
                setCompanyForm((prev) => ({ ...prev, telefono: digits }));
                if (errorsStep1.telefono) {
                  setErrorsStep1((prev) => {
                    const next = { ...prev };
                    delete next.telefono;
                    return next;
                  });
                }
              }}
            />
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">Continuar</Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form className="space-y-4" onSubmit={handleUserSubmit}>
            <Input
              label="Nombres"
              name="adminNombres"
              autoComplete="given-name"
              required
              value={userForm.nombres}
              error={errorsStep2.nombres}
              onChange={(event) => {
                setUserForm((prev) => ({ ...prev, nombres: event.target.value }));
                if (errorsStep2.nombres) {
                  setErrorsStep2((prev) => {
                    const next = { ...prev };
                    delete next.nombres;
                    return next;
                  });
                }
              }}
            />
            <Input
              label="Apellidos"
              name="adminApellidos"
              autoComplete="family-name"
              required
              value={userForm.apellidos}
              error={errorsStep2.apellidos}
              onChange={(event) => {
                setUserForm((prev) => ({ ...prev, apellidos: event.target.value }));
                if (errorsStep2.apellidos) {
                  setErrorsStep2((prev) => {
                    const next = { ...prev };
                    delete next.apellidos;
                    return next;
                  });
                }
              }}
            />
            <Input
              label="Correo del administrador"
              type="email"
              name="adminEmail"
              autoComplete="email"
              required
              value={userForm.email}
              error={errorsStep2.email}
              onChange={(event) => {
                setUserForm((prev) => ({ ...prev, email: event.target.value }));
                if (errorsStep2.email) {
                  setErrorsStep2((prev) => {
                    const next = { ...prev };
                    delete next.email;
                    return next;
                  });
                }
              }}
            />
            <Input
              label="Contrasena"
              type="password"
              name="adminPassword"
              autoComplete="new-password"
              required
              value={userForm.password}
              error={errorsStep2.password}
              withPasswordToggle
              onChange={(event) => {
                setUserForm((prev) => ({ ...prev, password: event.target.value }));
                if (errorsStep2.password) {
                  setErrorsStep2((prev) => {
                    const next = { ...prev };
                    delete next.password;
                    return next;
                  });
                }
              }}
            />
            <div className="space-y-1 rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm">
              <label className="flex items-center gap-2 text-content">
                <input
                  type="checkbox"
                  checked={isRepresentativeLegal}
                  onChange={(event) => setRepresentativeLegal(event.target.checked)}
                  className="h-4 w-4 rounded border border-border-subtle bg-field text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200"
                />
                Soy el representante legal de la empresa
              </label>
              <p className="text-xs text-content-muted">
                Si marcas esta opcion, registraremos tus nombres como representante legal.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Button variant="ghost" type="button" onClick={() => setStep(1)}>
                Volver
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Crear usuario
              </Button>
            </div>
          </form>
        )}

        <footer className="mt-6 text-center text-sm text-content-muted">
          Ya tienes acceso?{' '}
          <Link className="text-primary-600 hover:underline" to={APP_ROUTES.crm.login}>
            Inicia sesion
          </Link>
        </footer>
      </div>
    </div>
  );
};

export default RegisterCrm;




