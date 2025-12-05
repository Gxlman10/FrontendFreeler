import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { ToastProvider } from './components/common/Toasts';
import { AppRouter } from './router';
import { ThemeProvider } from './theme/ThemeProvider';
import { AuthProvider } from './store/auth';

const defaultTheme =
  (import.meta.env.VITE_DEFAULT_THEME as 'light' | 'dark' | 'system') ?? 'system';
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultMode={defaultTheme}>
        <ToastProvider>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

