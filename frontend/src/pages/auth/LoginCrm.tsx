import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/store/auth';
import { useToast } from '@/components/common/Toasts';
import { APP_ROUTES, Role } from '@/utils/constants';

export const LoginCrm = () => {
  const { loginEmpresa } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleForgotPassword = () => {
    push({
      title: 'Recuperar contrasena',
      description: 'Esta opcion estara disponible proximamente.',
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const session = await loginEmpresa(email, password);
      push({
        title: 'Bienvenido',
        description: `Rol asignado: ${session.role ?? 'empresa'}`,
      });
      const target = (() => {
        switch (session.role) {
          case Role.ADMIN:
            return APP_ROUTES.crm.home;
          case Role.SUPERVISOR:
            return APP_ROUTES.crm.supervisor.home;
          case Role.VENDEDOR:
            return APP_ROUTES.crm.vendedor.home;
          case Role.ANALISTA:
            return APP_ROUTES.crm.analitica;
          default:
            return APP_ROUTES.crm.home;
        }
      })();
      navigate(target, { replace: true });
    } catch {
      push({
        title: 'Credenciales invalidas',
        description: 'Revisa tus datos o solicita soporte.',
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
          <h1 className="text-2xl font-semibold">Acceso CRM Empresas</h1>
          <p className="mt-1 text-sm text-content-muted">
            Gestiona campanas, usuarios y leads de tu organizacion.
          </p>
        </header>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Correo corporativo"
            name="email"
            autoComplete="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Contrasena"
            name="password"
            autoComplete="current-password"
            type="password"
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
            Ingresar
          </Button>
        </form>
        <footer className="text-center text-sm text-content-muted">
          Tu empresa no tiene acceso?{' '}
          <Link className="text-primary-600 hover:underline" to={APP_ROUTES.crm.register}>
            Registra una empresa
          </Link>
        </footer>
      </div>
    </div>
  );
};

export default LoginCrm;


