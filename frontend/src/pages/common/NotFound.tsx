import { SearchX } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { APP_ROUTES } from '@/utils/constants';
import { useAuth } from '@/store/auth';

export const NotFound = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isCrmPath = location.pathname.startsWith('/crm');
  const primaryTarget =
    user?.type === 'empresa' || isCrmPath ? APP_ROUTES.crm.home : APP_ROUTES.referidos.home;
  const secondaryTarget =
    user?.type === 'empresa' || isCrmPath ? APP_ROUTES.crm.login : APP_ROUTES.referidos.login;

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <SearchX className="h-14 w-14 text-content-muted" />
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-content">No encontramos la ruta</h1>
        <p className="max-w-xl text-sm text-content-muted">
          {location.pathname
            ? `La dirección ${location.pathname} no existe o fue movida.`
            : 'La página que estás buscando no existe.'}{' '}
          Elige una de las opciones disponibles para continuar navegando.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Button onClick={() => navigate(primaryTarget, { replace: true })}>
          {isCrmPath || user?.type === 'empresa' ? 'Ir al panel CRM' : 'Ver campañas disponibles'}
        </Button>
        <Button variant="outline" onClick={() => navigate(secondaryTarget, { replace: true })}>
          {isCrmPath || user?.type === 'empresa' ? 'Volver al login CRM' : 'Iniciar sesión como referidor'}
        </Button>
      </div>
    </main>
  );
};

export default NotFound;
