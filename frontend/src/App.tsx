
import { Link } from 'react-router-dom';
import { APP_ROUTES } from '@/utils/constants';

const App = () => (
  <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-6 px-6 py-12 text-content">
    <h1 className="text-3xl font-semibold">Freeler Frontend</h1>
    <p className="text-sm text-content-muted">
      Esta aplicacion se entrega como SPA montada por Vite. Toda la navegacion se orquesta desde
      <code className="mx-2 rounded bg-surface-muted px-2 py-1 text-xs">
        src/router/index.tsx
      </code>
      ; este componente se mantiene solo como guia rapida.
    </p>
    <div className="flex flex-wrap gap-3 text-sm">
      <Link className="text-primary-600 hover:underline" to={APP_ROUTES.referidos.home}>
        Ir a Referidos
      </Link>
      <Link className="text-primary-600 hover:underline" to={APP_ROUTES.crm.login}>
        Ir al CRM
      </Link>
    </div>
  </div>
);

export default App;
