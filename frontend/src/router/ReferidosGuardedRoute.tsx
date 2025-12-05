import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { APP_ROUTES } from '@/utils/constants';

type Props = {
  children: ReactNode;
};

export const ReferidosGuardedRoute = ({ children }: Props) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="p-4 text-sm text-content-muted">Validando sesión...</div>;
  }

  if (!user || user.type !== 'freeler') {
    return (
      <Navigate
        to={APP_ROUTES.referidos.login}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <>{children}</>;
};

export default ReferidosGuardedRoute;
