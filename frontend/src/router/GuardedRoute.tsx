import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { APP_ROUTES, Role } from '@/utils/constants';
import SinAcceso from '@/pages/crm/SinAcceso';

type Props = {
  children: ReactNode;
  allow: Role[];
};

export const GuardedRoute = ({ children, allow }: Props) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Validando sesion...</div>;
  }
  if (!user) {
    return <Navigate to={APP_ROUTES.crm.login} replace state={{ from: location.pathname }} />;
  }
  if (user.type !== 'empresa') {
    return <Navigate to={APP_ROUTES.crm.login} replace />;
  }
  if (!user.role || !allow.includes(user.role)) {
    return <SinAcceso requestedPath={location.pathname} />;
  }
  return <>{children}</>;
};
