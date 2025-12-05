import { Outlet } from 'react-router-dom';
import { ReferidosHeader } from './ReferidosHeader';

export const ReferidosLayout = () => (
  // Layout principal de referidos con superficies limpias y tipografia legible por defecto
  <div className="flex min-h-screen flex-col bg-background text-content transition-colors">
    <ReferidosHeader />
    <div className="flex flex-1 flex-col overflow-hidden">
      <main className="flex-1 overflow-y-auto px-4 py-4 sm:py-8">
        <div className="mx-auto max-w-7xl px-2 sm:px-4">
          <Outlet />
        </div>
      </main>
      {/* Footer simple con informacion de derechos de autor */}
      <footer className="border-t border-border bg-surface px-4 py-6 text-sm text-content-subtle">
        <div className="mx-auto max-w-7xl px-2 text-center sm:px-4">
          <p>{new Date().getFullYear()} Freeler. Todos los derechos reservados.</p>
          <p className="mt-1">Desarrollado por Grupo 03 - Curso: Capstone Project Sistemas</p>
        </div>
      </footer>
    </div>
  </div>
);

export default ReferidosLayout;
