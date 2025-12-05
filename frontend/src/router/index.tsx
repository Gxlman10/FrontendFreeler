import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ReferidosLayout } from '@/components/layout/ReferidosLayout';
import { CrmShell } from '@/components/layout/CrmShell';
import LoginReferidos from '@/pages/auth/LoginReferidos';
import RegisterReferidos from '@/pages/auth/RegisterReferidos';
import LoginCrm from '@/pages/auth/LoginCrm';
import RegisterCrm from '@/pages/auth/RegisterCrm';
import HomeReferidos from '@/pages/referidos/Home';
import MisReferidos from '@/pages/referidos/MisReferidos';
import DashboardReferidos from '@/pages/referidos/Dashboard';
import Capacitacion from '@/pages/referidos/Capacitacion';
import HomeAdmin from '@/pages/crm/HomeAdmin';
import Usuarios from '@/pages/crm/Usuarios';
import Campanas from '@/pages/crm/Campanas';
import LeadsAdmin from '@/pages/crm/LeadsAdmin';
import HomeVendedor from '@/pages/crm/HomeVendedor';
import LeadsVendedor from '@/pages/crm/LeadsVendedor';
import LeadsKanban from '@/pages/crm/LeadsKanban';
import HomeAnalitica from '@/pages/crm/HomeAnalitica';
import ComisionesAdmin from '@/pages/crm/ComisionesAdmin';
import SinAcceso from '@/pages/crm/SinAcceso';
import Proximamente from '@/pages/crm/Proximamente';
import ConfigIA from '@/pages/crm/ConfigIA';
import { GuardedRoute } from './GuardedRoute';
import { ReferidosGuardedRoute } from './ReferidosGuardedRoute';
import NotFound from '@/pages/common/NotFound';
import { APP_ROUTES, Role } from '@/utils/constants';
import { useAuth } from '@/store/auth';

const CrmLanding = () => {
  const { user } = useAuth();
  if (!user?.role) {
    return <Navigate to={APP_ROUTES.crm.login} replace />;
  }
  switch (user.role) {
    case Role.ADMIN:
      return <Navigate to={APP_ROUTES.crm.home} replace />;
    case Role.SUPERVISOR:
      return <Navigate to={APP_ROUTES.crm.supervisor.home} replace />;
    case Role.VENDEDOR:
      return <Navigate to={APP_ROUTES.crm.vendedor.home} replace />;
    case Role.ANALISTA:
      return <Navigate to={APP_ROUTES.crm.analitica} replace />;
    default:
      return <Navigate to={APP_ROUTES.crm.sinAcceso} replace />;
  }
};

export const AppRouter = () => (
  <BrowserRouter future={{ v7_relativeSplatPath: true }}>
    <Routes>
      <Route element={<ReferidosLayout />}>
        <Route path={APP_ROUTES.referidos.home} element={<HomeReferidos />} />
        <Route path={APP_ROUTES.referidos.login} element={<LoginReferidos />} />
        <Route path={APP_ROUTES.referidos.register} element={<RegisterReferidos />} />
        <Route
          path={APP_ROUTES.referidos.misReferidos}
          element={
            <ReferidosGuardedRoute>
              <MisReferidos />
            </ReferidosGuardedRoute>
          }
        />
        <Route
          path={APP_ROUTES.referidos.dashboard}
          element={
            <ReferidosGuardedRoute>
              <DashboardReferidos />
            </ReferidosGuardedRoute>
          }
        />
        <Route
          path={APP_ROUTES.referidos.capacitacion}
          element={
            <ReferidosGuardedRoute>
              <Capacitacion />
            </ReferidosGuardedRoute>
          }
        />
      </Route>

      <Route path={APP_ROUTES.crm.login} element={<LoginCrm />} />
      <Route path={APP_ROUTES.crm.register} element={<RegisterCrm />} />

      <Route element={<CrmShell />}>
        <Route
          path="/crm"
          element={
            <GuardedRoute allow={[Role.ADMIN, Role.SUPERVISOR, Role.VENDEDOR, Role.ANALISTA]}>
              <CrmLanding />
            </GuardedRoute>
          }
        />
        <Route
          path={APP_ROUTES.crm.home}
          element={
            <GuardedRoute allow={[Role.ADMIN]}>
              <HomeAdmin />
            </GuardedRoute>
          }
        />
        <Route
          path={APP_ROUTES.crm.campanas}
          element={
            <GuardedRoute allow={[Role.ADMIN, Role.SUPERVISOR]}>
              <Campanas />
            </GuardedRoute>
          }
        />
        <Route
          path={APP_ROUTES.crm.leads}
          element={
            <GuardedRoute allow={[Role.ADMIN, Role.SUPERVISOR]}>
              <LeadsAdmin />
            </GuardedRoute>
          }
        />
        <Route
          path={APP_ROUTES.crm.leadsKanban}
          element={
            <GuardedRoute allow={[Role.ADMIN, Role.SUPERVISOR]}>
              <LeadsKanban variant="admin" />
            </GuardedRoute>
          }
        />
        <Route
          path={APP_ROUTES.crm.usuarios}
          element={
            <GuardedRoute allow={[Role.ADMIN, Role.SUPERVISOR]}>
              <Usuarios />
            </GuardedRoute>
          }
        />
        <Route
          path={APP_ROUTES.crm.comisiones}
          element={
            <GuardedRoute allow={[Role.ADMIN, Role.SUPERVISOR]}>
              <ComisionesAdmin />
            </GuardedRoute>
          }
        />
        <Route
          path={APP_ROUTES.crm.iaConfig}
          element={
            <GuardedRoute allow={[Role.ADMIN]}>
              <ConfigIA />
            </GuardedRoute>
          }
        />
        <Route
          path={APP_ROUTES.crm.supervisor.home}
          element={
            <GuardedRoute allow={[Role.SUPERVISOR]}>
              <HomeAdmin variant="supervisor" />
            </GuardedRoute>
          }
        />
        <Route
          path={APP_ROUTES.crm.supervisor.leads}
          element={
            <GuardedRoute allow={[Role.SUPERVISOR]}>
              <LeadsAdmin variant="supervisor" showOriginColumn={false} showOriginFilter={false} />
            </GuardedRoute>
          }
        />
        <Route
          path={APP_ROUTES.crm.vendedor.home}
          element={
            <GuardedRoute allow={[Role.VENDEDOR]}>
              <HomeVendedor />
            </GuardedRoute>
          }
        />
        <Route
          path={APP_ROUTES.crm.vendedor.leads}
          element={
            <GuardedRoute allow={[Role.VENDEDOR]}>
              <LeadsVendedor />
            </GuardedRoute>
          }
        />
        <Route
          path={APP_ROUTES.crm.vendedor.kanban}
          element={
            <GuardedRoute allow={[Role.VENDEDOR]}>
              <LeadsKanban variant="vendor" />
            </GuardedRoute>
          }
        />
        <Route
          path={APP_ROUTES.crm.analitica}
          element={
            <GuardedRoute allow={[Role.ANALISTA, Role.ADMIN, Role.SUPERVISOR]}>
              <HomeAnalitica />
            </GuardedRoute>
          }
        />
        <Route path={APP_ROUTES.crm.sinAcceso} element={<SinAcceso />} />
        <Route path={APP_ROUTES.crm.proximamente} element={<Proximamente />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default AppRouter;

