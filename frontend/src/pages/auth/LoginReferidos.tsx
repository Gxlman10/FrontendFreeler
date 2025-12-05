import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/store/auth';
import { useToast } from '@/components/common/Toasts';
import { APP_ROUTES } from '@/utils/constants';

export const LoginReferidos = () => {
  const { loginReferidos } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleForgotPassword = () => {
    push({
      title: 'Recuperar contrasena',
      description: 'Muy pronto podras restablecer tu acceso desde aqui.',
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await loginReferidos(email, password);
      push({ title: 'Bienvenido', description: 'Ingreso correcto.' });
      navigate(APP_ROUTES.referidos.home, { replace: true });
    } catch {
      push({
        title: 'No pudimos iniciar sesion',
        description: 'Revisa tu correo y contrasena.',
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
          <h1 className="text-2xl font-semibold">Ingresar a Referidos</h1>
          <p className="mt-1 text-sm text-content-muted">
            Gestiona tus campanas y referidos desde un solo lugar.
          </p>
        </header>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Correo"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Contrasena"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            withPasswordToggle
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm font-medium text-primary-600 transition hover:text-primary-700"
            >
              Olvidaste tu contrasena?
            </button>
          </div>
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Iniciar sesion
          </Button>
        </form>
        <footer className="text-center text-sm text-content-muted">
          Aun no tienes cuenta?{' '}
          <Link className="text-primary-600 hover:underline" to={APP_ROUTES.referidos.register}>
            Registrate
          </Link>
        </footer>
      </div>
    </div>
  );
};

export default LoginReferidos;
