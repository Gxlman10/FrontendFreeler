import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/store/auth';
import { useToast } from '@/components/common/Toasts';
import { APP_ROUTES } from '@/utils/constants';
import { isValidDni, isStrongPassword, isValidEmail } from '@/utils/validators';
import { queryDocument } from '@/services/document.service';

export const RegisterReferidos = () => {
  const { registerFreeler } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dniStatus, setDniStatus] = useState<'idle' | 'loading' | 'success' | 'not-found'>('idle');
  const lastLookupRef = useRef<string>('');

  useEffect(() => {
    const value = dni.trim();
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
          if (data.names) setNombres(data.names);
          const surname =
            data.surnames ??
            [data.paternalLastName, data.maternalLastName].filter(Boolean).join(' ');
          if (surname) setApellidos(surname);
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
  }, [dni]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!isValidDni(dni)) nextErrors.dni = 'Ingresa un DNI valido (8 digitos).';
    if (!isValidEmail(email)) nextErrors.email = 'Ingresa un correo valido.';
    if (telefono.replace(/\D/g, '').length !== 9) {
      nextErrors.telefono = 'Ingresa un numero valido (9 digitos).';
    }
    if (!isStrongPassword(password))
      nextErrors.password =
        'La contrasena debe tener al menos 8 caracteres, combinando letras y numeros.';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      const formattedPhone = telefono ? `+51${telefono}` : '';
      await registerFreeler({ nombres, apellidos, dni, email, telefono: formattedPhone, password });
      push({ title: 'Registro completado', description: 'Ya puedes referir campanas.' });
      navigate(APP_ROUTES.referidos.home, { replace: true });
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        'Verifica los datos e intenta otra vez.';
      push({
        title: 'No pudimos registrar tu cuenta',
        description: Array.isArray(message) ? message.join(' ') : message,
        variant: 'danger',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-160px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-border-subtle bg-surface p-6 shadow-card backdrop-blur">
        <img src="/freeler_logo.svg" alt="Freeler" className="mx-auto mb-4 h-10 w-auto" />
        <header className="text-center">
          <h1 className="text-2xl font-semibold">Crear cuenta de Referidos</h1>
          <p className="mt-1 text-sm text-content-muted">
            Completa tus datos para empezar a generar comisiones.

          </p>
        </header>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="DNI"
            name="dni"
            autoComplete="off"
            required
            value={dni}
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
            helperText={dniStatus === 'not-found' ? 'No se encontraron datos para este DNI.' : undefined}
            error={errors.dni}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
              setDni(digits);
              if (errors.dni) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.dni;
                  return next;
                });
              }
            }}
          />
          <Input
            label="Nombres"
            name="nombres"
            autoComplete="given-name"
            required
            value={nombres}
            onChange={(event) => setNombres(event.target.value)}
          />
          <Input
            label="Apellidos"
            name="apellidos"
            autoComplete="family-name"
            required
            value={apellidos}
            onChange={(event) => setApellidos(event.target.value)}
          />
          <Input
            label="Telefono"
            name="telefono"
            required
            value={telefono}
            inputMode="tel"
            leadingElement={<span className="text-xs font-semibold text-content-muted">+51</span>}
            error={errors.telefono}
            helperText="Solo numeros. Se agregara el prefijo automaticamente."
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, '').slice(0, 9);
              setTelefono(digits);
              if (errors.telefono) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.telefono;
                  return next;
                });
              }
            }}
          />
          <Input
            label="Correo"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            error={errors.email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Contrasena"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            value={password}
            error={errors.password}
            withPasswordToggle
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Crear cuenta
          </Button>
        </form>
        <footer className="text-center text-sm text-content-muted">
          Ya tienes una cuenta?{' '}
          <Link className="text-primary-600 hover:underline" to={APP_ROUTES.referidos.login}>
            Inicia sesin
          </Link>
        </footer>
      </div>
    </div>
  );
};

export default RegisterReferidos;
