import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { APP_ROUTES } from '@/utils/constants';

type Props = {
  requestedPath?: string;
};

export const SinAcceso = ({ requestedPath }: Props) => {
  const navigate = useNavigate();
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <ShieldAlert className="h-14 w-14 text-amber-500" />
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-content">Acceso restringido</h1>
        <p className="max-w-xl text-sm text-content-muted">
          {requestedPath
            ? `El módulo ${requestedPath} existe, pero tu perfil aún no tiene permisos para verlo.`
            : 'Tu perfil aún no tiene permisos para acceder a este módulo del CRM.'}
          {' '}
          Pide a un administrador que actualice tu rol o regresa al panel principal.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Button onClick={() => navigate(APP_ROUTES.crm.home)}>Ir al panel</Button>
        <Button variant="outline" onClick={() => navigate(APP_ROUTES.crm.login)}>
          Cambiar de cuenta
        </Button>
      </div>
    </main>
  );
};

export default SinAcceso;
