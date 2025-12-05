import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Flag,
  GraduationCap,
  Gauge,
  LogIn,
  LogOut,
  Menu,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import freelerLogo from '/freeler_logo.svg';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { ThemeSwitch } from '@/components/common/ThemeSwitch';
import { useAuth } from '@/store/auth';
import { APP_ROUTES } from '@/utils/constants';
import { UserService, type UsuarioFreeler } from '@/services/user.service';
import { useToast } from '@/components/common/Toasts';
import { cn } from '@/utils/cn';
import { t } from '@/i18n';

const getInitials = (value?: string | null) => {
  if (!value) return 'FR';
  const parts = value
    .split('@')[0]
    .replace(/[\W_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return value.substring(0, 2).toUpperCase();
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

type NavItem = {
  labelKey: string;
  fallback: string;
  to: string;
  icon: LucideIcon;
  requiresAuth?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { labelKey: 'referidosNav.campaigns', fallback: 'Campañas', to: APP_ROUTES.referidos.home, icon: Flag },
  { labelKey: 'referidosNav.myLeads', fallback: 'Mis referidos', to: APP_ROUTES.referidos.misReferidos, icon: Users, requiresAuth: true },
  { labelKey: 'referidosNav.dashboard', fallback: 'Dashboard', to: APP_ROUTES.referidos.dashboard, icon: Gauge, requiresAuth: true },
  { labelKey: 'referidosNav.training', fallback: 'Capacitación', to: APP_ROUTES.referidos.capacitacion, icon: GraduationCap, requiresAuth: true },
];

export const ReferidosHeader = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { push } = useToast();

  const [isNavOpen, setNavOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isEditProfileOpen, setEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ nombres: '', apellidos: '', telefono: '' });

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'text-primary-600'
      : 'text-content-muted transition hover:text-primary-600';

  const closeNav = () => setNavOpen(false);
  const closeProfile = () => setProfileOpen(false);
  const closeAll = () => {
    closeNav();
    closeProfile();
  };

  const userInitials = getInitials(user?.email ?? user?.type ?? null);
  const isFreeler = user?.type === 'freeler';

  const navItems = useMemo(() => {
    const resolvedItems = NAV_ITEMS.filter((item) => (item.requiresAuth ? Boolean(user) : true));
    return resolvedItems.map((item) => {
      const label = t(item.labelKey);
      return {
        ...item,
        label: label === item.labelKey ? item.fallback : label,
      };
    });
  }, [user]);

  const { data: freelerProfile } = useQuery({
    queryKey: ['freeler-profile', user?.id],
    queryFn: () => UserService.getUsuarioFreelerById(user!.id),
    enabled: Boolean(user && isFreeler),
  });

  useEffect(() => {
    if (!freelerProfile) return;
    setProfileForm({
      nombres: freelerProfile.nombres ?? '',
      apellidos: freelerProfile.apellidos ?? '',
      telefono: freelerProfile.telefono ?? '',
    });
  }, [freelerProfile]);

  const profileName = useMemo(() => {
    const composed = `${freelerProfile?.nombres ?? ''} ${freelerProfile?.apellidos ?? ''}`.trim();
    return composed || user?.email || 'Freeler';
  }, [freelerProfile, user]);

  const handleLogout = () => {
    logout();
    closeAll();
  };

  const updateProfile = useMutation({
    mutationFn: (payload: Partial<UsuarioFreeler>) => UserService.updateUsuarioFreeler(user!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['freeler-profile', user?.id] });
      push({ title: 'Perfil actualizado', description: 'Tus datos se guardaron correctamente.' });
      setEditProfileOpen(false);
    },
    onError: () => {
      push({ title: 'No pudimos actualizar tu perfil', description: 'Inténtalo nuevamente.', variant: 'danger' });
    },
  });

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !isFreeler) {
      setEditProfileOpen(false);
      return;
    }
    updateProfile.mutate({
      nombres: profileForm.nombres.trim(),
      apellidos: profileForm.apellidos.trim(),
      telefono: profileForm.telefono.trim(),
    });
  };

  const profileMenuContent = !user
    ? null
    : (
      <>
        <div className="space-y-1 border-b border-border-subtle px-4 py-3">
          <p className="text-sm font-semibold text-content">{profileName}</p>
          <p className="text-xs text-content-muted">{user.email}</p>
        </div>
        <div className="flex flex-col gap-1 px-4 py-3">
          <Button variant="ghost" className="justify-start" onClick={() => { setEditProfileOpen(true); closeProfile(); }}>
            {t('common.editProfile')}
          </Button>
          <Button
            variant="ghost"
            className="justify-start text-red-500 hover:bg-red-500/10 hover:text-red-500"
            onClick={handleLogout}
            leftIcon={<LogOut className="h-4 w-4" />}
          >
            {t('auth.logout')}
          </Button>
        </div>
      </>
    );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 px-4 py-3 shadow-card backdrop-blur supports-[backdrop-filter]:bg-surface/80 transition-colors">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
        <div className="flex min-h-[52px] flex-nowrap items-center justify-between gap-3 md:h-16">
          <div className="flex flex-1 items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setNavOpen((prev) => !prev);
                  closeProfile();
                }}
                aria-label={isNavOpen ? t('crmShell.menuClose') : t('crmShell.mobileNav')}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-surface transition hover:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:hidden"
              >
                {isNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <button
                type="button"
                className="flex items-center gap-2"
                onClick={() => {
                  closeAll();
                  navigate(APP_ROUTES.referidos.home);
                }}
              >
                <img src={freelerLogo} alt="Freeler" className="hidden h-9 w-auto sm:block" />
                <span className="hidden text-lg font-semibold text-primary-600 sm:block">Freeler</span>
                <img src={freelerLogo} alt="Freeler" className="h-9 w-auto sm:hidden" />
              </button>
            </div>
            <nav className="hidden flex-1 items-center justify-center gap-2 whitespace-nowrap sm:flex md:gap-4">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition md:text-sm',
                      isActive ? 'bg-primary-50 text-primary-600 shadow-sm' : 'text-content-muted hover:text-primary-600',
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex flex-shrink-0 items-center gap-3">
            <ThemeSwitch />
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((prev) => !prev);
                    setNavOpen(false);
                  }}
                  className="flex items-center gap-2 px-0 py-0 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:rounded-full sm:border sm:border-border-subtle sm:bg-surface sm:px-2 sm:py-1.5 sm:shadow-sm"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
                    {userInitials}
                  </span>
                  <span className="hidden min-w-0 flex-col text-left md:flex">
                    <span className="text-sm font-semibold text-content truncate">{profileName}</span>
                    <span className="text-xs text-content-muted truncate">{user.email}</span>
                  </span>
                </button>
                {isProfileOpen && profileMenuContent && (
                  <div className="absolute right-0 top-full z-40 mt-2 hidden w-72 rounded-xl border border-border bg-surface shadow-lg md:block">
                    {profileMenuContent}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => navigate(APP_ROUTES.referidos.login)}>
                  {t('auth.login')}
                </Button>
                <Button onClick={() => navigate(APP_ROUTES.referidos.register)}>{t('auth.register')}</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isProfileOpen && profileMenuContent && (
        <div className="md:hidden">
          <div className="fixed inset-0 z-[var(--z-drawer)] bg-black/30" onClick={closeProfile} />
          <div className="fixed inset-x-4 top-24 z-[var(--z-drawer)] rounded-xl border border-border bg-surface shadow-card">
            {profileMenuContent}
          </div>
        </div>
      )}

      {isNavOpen && (
        <div className="sm:hidden">
          <div className="fixed inset-0 z-[var(--z-drawer)] bg-black/30" onClick={closeNav} />
          <div className="fixed inset-x-4 top-20 z-[var(--z-drawer)] space-y-3 rounded-xl border border-border bg-surface p-4 text-sm text-content shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-content-muted">{t('crmShell.mobileNav')}</span>
              <ThemeSwitch />
            </div>
            <div className="space-y-1">
              {navItems.map((item) => (
                <Button
                  key={`mobile-${item.to}`}
                  variant="ghost"
                  className="w-full justify-start gap-2 text-sm"
                  onClick={() => {
                    closeAll();
                    navigate(item.to);
                  }}
                  leftIcon={<item.icon className="h-4 w-4" />}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={isEditProfileOpen}
        onOpenChange={(open) => {
          setEditProfileOpen(open);
          if (!open) closeProfile();
        }}
        title={t('common.editProfile')}
        description="Actualiza los datos que compartes con las empresas."
      >
        <form className="space-y-4" onSubmit={handleProfileSubmit}>
          <Input
            label="Nombres"
            value={profileForm.nombres}
            onChange={(event) => setProfileForm((prev) => ({ ...prev, nombres: event.target.value }))}
            required
          />
          <Input
            label="Apellidos"
            value={profileForm.apellidos}
            onChange={(event) => setProfileForm((prev) => ({ ...prev, apellidos: event.target.value }))}
            required
          />
          <Input
            label="Teléfono"
            value={profileForm.telefono}
            onChange={(event) => setProfileForm((prev) => ({ ...prev, telefono: event.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditProfileOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={updateProfile.isPending}>
              {t('common.saveChanges')}
            </Button>
          </div>
        </form>
      </Dialog>
    </header>
  );
};

export default ReferidosHeader;
