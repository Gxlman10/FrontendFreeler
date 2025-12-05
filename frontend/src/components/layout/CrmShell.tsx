import { FormEvent, Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Bot,
  Building2,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  User as UserIcon,
  UserCog,
  Users2,
  Waypoints,
  Coins,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/store/auth';
import { APP_ROUTES, Role, ROLE_LABELS } from '@/utils/constants';
import { getRoleBadgeVariant } from '@/utils/badges';
import { cn } from '@/utils/cn';
import { useToast } from '@/components/common/Toasts';
import { AuthService } from '@/services/auth.service';
import { UserService } from '@/services/user.service';
import type { Empresa, UsuarioEmpresa } from '@/services/user.service';
import { storage } from '@/utils/helpers';
import { ThemeSwitch } from '@/components/common/ThemeSwitch';
import freelerLogo from '/freeler_logo.svg';
import { t } from '@/i18n';
import { useIsMobile } from '@/hooks/useMediaQuery';
type NavItem = {
  to: string;
  label: string;
  icon: JSX.Element;
};
type SessionEmpresaProfile = UsuarioEmpresa & {
  empresa?: Empresa | null;
};
type ProfileFormState = {
  nombres: string;
  apellidos: string;
  email: string;
};
type CompanyFormState = {
  razon_social: string;
  ruc: string;
  direccion: string;
  telefono: string;
  email: string;
  representante_legal: string;
};
const emptyProfileForm: ProfileFormState = {
  nombres: '',
  apellidos: '',
  email: '',
};
const emptyCompanyForm: CompanyFormState = {
  razon_social: '',
  ruc: '',
  direccion: '',
  telefono: '',
  email: '',
  representante_legal: '',
};
const buildNavItems = (role: Role | null | undefined): NavItem[] => {
  const labels = {
    dashboard: t('nav.dashboard'),
    campaigns: t('nav.campaigns'),
    leads: t('nav.leads'),
    users: t('nav.users'),
    analytics: t('nav.analytics'),
    kanban: t('nav.kanban'),
    ai: t('nav.aiConfig'),
    commissions: t('nav.commissions'),
  };
  switch (role) {
    case Role.ADMIN:
      return [
        { to: APP_ROUTES.crm.home, label: labels.dashboard, icon: <LayoutDashboard className="h-5 w-5" /> },
        { to: APP_ROUTES.crm.campanas, label: labels.campaigns, icon: <Waypoints className="h-5 w-5" /> },
        { to: APP_ROUTES.crm.leads, label: labels.leads, icon: <Users2 className="h-5 w-5" /> },
        { to: APP_ROUTES.crm.leadsKanban, label: labels.kanban, icon: <Kanban className="h-5 w-5" /> },
        { to: APP_ROUTES.crm.usuarios, label: labels.users, icon: <UserCog className="h-5 w-5" /> },
        { to: APP_ROUTES.crm.analitica, label: labels.analytics, icon: <BarChart3 className="h-5 w-5" /> },
        { to: APP_ROUTES.crm.comisiones, label: labels.commissions, icon: <Coins className="h-5 w-5" /> },
        { to: APP_ROUTES.crm.iaConfig, label: labels.ai, icon: <Bot className="h-5 w-5" /> },
      ];
    case Role.SUPERVISOR:
      return [
        { to: APP_ROUTES.crm.supervisor.home, label: labels.dashboard, icon: <LayoutDashboard className="h-5 w-5" /> },
        { to: APP_ROUTES.crm.campanas, label: labels.campaigns, icon: <Waypoints className="h-5 w-5" /> },
        { to: APP_ROUTES.crm.supervisor.leads, label: labels.leads, icon: <Users2 className="h-5 w-5" /> },
        { to: APP_ROUTES.crm.usuarios, label: labels.users, icon: <UserCog className="h-5 w-5" /> },
        { to: APP_ROUTES.crm.analitica, label: labels.analytics, icon: <BarChart3 className="h-5 w-5" /> },
      ];
    case Role.VENDEDOR:
      return [
        { to: APP_ROUTES.crm.vendedor.home, label: labels.dashboard, icon: <LayoutDashboard className="h-5 w-5" /> },
        { to: APP_ROUTES.crm.vendedor.leads, label: labels.leads, icon: <Users2 className="h-5 w-5" /> },
        { to: APP_ROUTES.crm.vendedor.kanban, label: labels.kanban, icon: <Kanban className="h-5 w-5" /> },
      ];
    case Role.ANALISTA:
      return [{ to: APP_ROUTES.crm.analitica, label: labels.analytics, icon: <BarChart3 className="h-5 w-5" /> }];
    default:
      return [];
  }
};
const getInitials = (value?: string | null) => {
  if (!value) return 'UX';
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return value.charAt(0).toUpperCase();
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
};
const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('FILE_READ_ERROR'));
    reader.readAsDataURL(file);
  });
const AvatarCircle = ({
  name,
  imageUrl,
  size = 'md',
  className,
}: {
  name?: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) => {
  const sizeClasses =
    size === 'lg'
      ? 'h-16 w-16 text-xl'
      : size === 'sm'
        ? 'h-9 w-9 text-sm'
        : 'h-12 w-12 text-base';
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name ? t('common.avatarAlt', { name }) : t('common.avatar')}
        className={cn(
          'rounded-full border border-border-subtle object-cover shadow-sm',
          sizeClasses,
          className,
        )}
      />
    );
  }
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full bg-primary-600/15 font-semibold text-primary-700 shadow-sm',
        sizeClasses,
        className,
      )}
      aria-hidden
    >
      {getInitials(name)}
    </span>
  );
};
export const CrmShell = () => {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [isProfileDialogOpen, setProfileDialogOpen] = useState(false);
  const [isCompanyDialogOpen, setCompanyDialogOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const navToggleRef = useRef<HTMLButtonElement | null>(null);
  const [isHeaderMenuOpen, setHeaderMenuOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileOverflowOpen, setMobileOverflowOpen] = useState(false);
  const [mobileOverflowAnchor, setMobileOverflowAnchor] = useState<{ top: number; left: number } | null>(null);
  const [isDesktopLayout, setDesktopLayout] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 768px)').matches;
  });
  const [mobileNavCount, setMobileNavCount] = useState(6);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(emptyProfileForm);
  const [companyForm, setCompanyForm] = useState<CompanyFormState>(emptyCompanyForm);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const navItems = useMemo(() => buildNavItems(user?.role ?? null), [user?.role]);
  const isMobileScreen = useIsMobile();
  const effectiveMobileNavCount = useMemo(
    () => Math.min(navItems.length, Math.max(4, mobileNavCount)),
    [navItems.length, mobileNavCount],
  );
  const visibleMobileNavItems = useMemo(
    () => navItems.slice(0, effectiveMobileNavCount),
    [navItems, effectiveMobileNavCount],
  );
  const overflowNavItems = useMemo(
    () => navItems.slice(effectiveMobileNavCount),
    [navItems, effectiveMobileNavCount],
  );
  useEffect(() => {
    if (!overflowNavItems.length) {
      setMobileOverflowOpen(false);
    }
  }, [overflowNavItems.length]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const computeCount = () => {
      const width = window.innerWidth;
      let count = 6;
      if (width < 360) {
        count = 4;
      } else if (width < 460) {
        count = 5;
      } else if (width < 540) {
        count = 5;
      } else {
        count = 6;
      }
      setMobileNavCount((prev) => (prev === count ? prev : count));
    };
    computeCount();
    window.addEventListener('resize', computeCount);
    return () => window.removeEventListener('resize', computeCount);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate(APP_ROUTES.crm.login, { replace: true });
      return;
    }
    if (user.type !== 'empresa') {
      navigate(APP_ROUTES.crm.login, { replace: true });
    }
  }, [isLoading, user, navigate]);
  const empresaUserId = useMemo(() => {
    if (!user || user.type !== 'empresa') return null;
    const parsed = Number(user.id);
    return Number.isFinite(parsed) ? parsed : null;
  }, [user]);
  const sessionProfileQuery = useQuery({
    queryKey: ['session-profile', empresaUserId],
    queryFn: () => AuthService.fetchEmpresaProfile(empresaUserId!) as Promise<SessionEmpresaProfile>,
    enabled: empresaUserId !== null,
    staleTime: 1000 * 60 * 3,
  });
  const profile = sessionProfileQuery.data ?? null;
  const company = profile?.empresa ?? null;
  const avatarStorageKey = user ? `freeler:avatar:${user.id}` : null;
  const companyLogoStorageKey = company?.id_empresa ? `freeler:company-logo:${company.id_empresa}` : null;
  useEffect(() => {
    if (!avatarStorageKey) {
      setProfileAvatar(null);
      return;
    }
    const stored = storage.get<string>(avatarStorageKey);
    setProfileAvatar(stored ?? null);
  }, [avatarStorageKey]);
  useEffect(() => {
    if (!companyLogoStorageKey) {
      setCompanyLogo(null);
      return;
    }
    const stored = storage.get<string>(companyLogoStorageKey);
    setCompanyLogo(stored ?? null);
  }, [companyLogoStorageKey]);
  useEffect(() => {
    if (!profile || isProfileDialogOpen) return;
    setProfileForm({
      nombres: profile.nombres ?? '',
      apellidos: profile.apellidos ?? '',
      email: profile.email ?? '',
    });
  }, [profile, isProfileDialogOpen]);
  useEffect(() => {
    if (!company || isCompanyDialogOpen) {
      if (!company) setCompanyForm(emptyCompanyForm);
      return;
    }
    setCompanyForm({
      razon_social: company.razon_social ?? '',
      ruc: company.ruc ?? '',
      telefono: company.telefono ?? '',
      email: company.email ?? '',
      representante_legal: company.representante_legal ?? '',
    });
  }, [company, isCompanyDialogOpen]);
  useEffect(() => {
    if (!isHeaderMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHeaderMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isHeaderMenuOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setDesktopLayout(event.matches ?? mediaQuery.matches);
    };
    handleChange(mediaQuery);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    mediaQuery.addListener(handleChange as (this: MediaQueryList, ev: MediaQueryListEvent) => void);
    return () =>
      mediaQuery.removeListener(handleChange as (this: MediaQueryList, ev: MediaQueryListEvent) => void);
  }, []);

  useEffect(() => {
    if (isDesktopLayout) {
      setMobileOverflowOpen(false);
    }
  }, [isDesktopLayout]);
  const handleAvatarFile = useCallback(
    async (file?: File | null) => {
      if (!file) return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setProfileAvatar(dataUrl);
        if (avatarStorageKey) storage.set(avatarStorageKey, dataUrl);
        push({
          title: t('crmShell.avatarUpdated'),
          description: t('crmShell.avatarUpdatedDescription'),
        });
      } catch {
        push({
          title: t('crmShell.avatarUpdateError'),
          description: t('crmShell.avatarUpdateErrorDescription'),
          variant: 'danger',
        });
      }
    },
    [avatarStorageKey, push],
  );
  const handleCompanyLogoFile = useCallback(
    async (file?: File | null) => {
      if (!file) return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setCompanyLogo(dataUrl);
        if (companyLogoStorageKey) storage.set(companyLogoStorageKey, dataUrl);
        push({
          title: t('crmShell.logoUpdated'),
          description: t('crmShell.logoUpdatedDescription'),
        });
      } catch {
        push({
          title: t('crmShell.logoUpdateError'),
          description: t('crmShell.logoUpdateErrorDescription'),
          variant: 'danger',
        });
      }
    },
    [companyLogoStorageKey, push],
  );
  const clearAvatar = useCallback(() => {
    setProfileAvatar(null);
    if (avatarStorageKey) storage.remove(avatarStorageKey);
  }, [avatarStorageKey]);
  const clearCompanyLogo = useCallback(() => {
    setCompanyLogo(null);
    if (companyLogoStorageKey) storage.remove(companyLogoStorageKey);
  }, [companyLogoStorageKey]);
  const updateProfile = useMutation({
    mutationFn: (payload: Partial<UsuarioEmpresa>) =>
      UserService.updateUsuarioEmpresa(user!.id, payload),
    onSuccess: async () => {
      push({
        title: t('crmShell.profileUpdated'),
        description: t('crmShell.profileUpdatedDescription'),
      });
      await queryClient.invalidateQueries({ queryKey: ['session-profile'] });
      setProfileDialogOpen(false);
    },
    onError: () => {
      push({
        title: t('crmShell.profileUpdateError'),
        description: t('crmShell.profileUpdateErrorDescription'),
        variant: 'danger',
      });
    },
  });
  const updateCompany = useMutation({
    mutationFn: ({ companyId, payload }: { companyId: number; payload: Partial<Empresa> }) =>
      UserService.updateEmpresa(companyId, payload),
    onSuccess: async () => {
      push({
        title: t('crmShell.companyUpdated'),
        description: t('crmShell.companyUpdatedDescription'),
      });
      await queryClient.invalidateQueries({ queryKey: ['session-profile'] });
      setCompanyDialogOpen(false);
    },
    onError: () => {
      push({
        title: t('crmShell.companyUpdateError'),
        description: t('crmShell.companyUpdateErrorDescription'),
        variant: 'danger',
      });
    },
  });
  const roleLabel = user?.role ? ROLE_LABELS[user.role] : t('crmShell.noRole');
  const roleBadgeVariant = getRoleBadgeVariant(user?.role);
  const safeUserEmail = user?.email ?? t('crmShell.profileEmailFallback');
  const canManageUsers = user?.role === Role.ADMIN || user?.role === Role.SUPERVISOR;
  const profileName =
    profile
      ? `${profile.nombres ?? ''} ${profile.apellidos ?? ''}`.trim() || profile.email
      : user?.email ?? t('crmShell.profileEmailFallback');
  const companyName = company?.razon_social ?? t('crmShell.noAssignedCompany');
  const activeCampaignLabel = t('common.allCampaigns');
  const handleNavigationToggle = () => {
    if (isDesktopLayout) {
      setSidebarCollapsed((prev) => !prev);
      return;
    }
    if (!overflowNavItems.length) {
      setMobileOverflowOpen(false);
      setMobileOverflowAnchor(null);
      return;
    }
    if (!isMobileOverflowOpen) {
      const rect = navToggleRef.current?.getBoundingClientRect();
      if (rect) {
        setMobileOverflowAnchor({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
        });
      } else {
        setMobileOverflowAnchor(null);
      }
      setMobileOverflowOpen(true);
    } else {
      setMobileOverflowOpen(false);
      setMobileOverflowAnchor(null);
    }
  };
  const navigationToggleLabel = isDesktopLayout
    ? isSidebarCollapsed
      ? t('crmShell.expandNav')
      : t('crmShell.collapseNav')
    : overflowNavItems.length
    ? isMobileOverflowOpen
      ? t('crmShell.hideOverflowNav')
      : t('crmShell.showOverflowNav')
    : t('crmShell.showOverflowNav');
  const isHamburgerActive = isDesktopLayout ? isSidebarCollapsed : isMobileOverflowOpen && overflowNavItems.length > 0;
  const closeHeaderMenu = () => setHeaderMenuOpen(false);
  const overflowMenuPosition = useMemo(() => {
    if (isDesktopLayout || !mobileOverflowAnchor) return null;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const computedLeft = Math.min(
      Math.max(16, mobileOverflowAnchor.left - 20),
      Math.max(16, viewportWidth ? viewportWidth - 260 : 0),
    );
    return {
      top: mobileOverflowAnchor.top + 8,
      left: computedLeft,
    };
  }, [isDesktopLayout, mobileOverflowAnchor]);
  const headerMenuContent = (
    <>
      <div className="space-y-4 border-b border-border-subtle px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
            {getInitials(profileName || user?.email)}
          </span>
          <div className="text-sm">
            <p className="font-semibold text-content">{profileName}</p>
            <p className="text-xs text-content-muted">{safeUserEmail}</p>
          </div>
        </div>
        <div className="space-y-3 rounded-2xl bg-surface-muted/70 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 uppercase tracking-wide text-content-muted">
              <UserIcon className="h-3.5 w-3.5" />
              {t('crmShell.roleLabel')}
            </span>
            <Badge variant={roleBadgeVariant}>{roleLabel}</Badge>
          </div>
          <div className="flex items-center gap-2 text-content">
            <Building2 className="h-3.5 w-3.5 text-primary-500" />
            <div className="flex flex-col">
              <span className="text-[0.7rem] uppercase tracking-wide text-content-muted">
                {t('common.company')}
              </span>
              <span className="text-sm font-medium text-content">{companyName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-content">
            <Waypoints className="h-3.5 w-3.5 text-primary-500" />
            <div className="flex flex-col">
              <span className="text-[0.7rem] uppercase tracking-wide text-content-muted">
                {t('common.campaign')}
              </span>
              <span className="text-sm font-medium">{activeCampaignLabel}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1 px-4 py-3">
        <Button
          variant="ghost"
          className="justify-start"
          leftIcon={<UserIcon className="h-4 w-4" />}
          onClick={() => {
            closeHeaderMenu();
            setProfileDialogOpen(true);
          }}
        >
          {t('common.editProfile')}
        </Button>
        {user?.role === Role.ADMIN && (
          <Button
            variant="ghost"
            className="justify-start"
            leftIcon={<Building2 className="h-4 w-4" />}
            onClick={() => {
              closeHeaderMenu();
              setCompanyDialogOpen(true);
            }}
          >
            {t('crmShell.editCompany', 'Editar empresa')}
          </Button>
        )}
        {canManageUsers && (
          <Button
            variant="ghost"
            className="justify-start"
            leftIcon={<Users2 className="h-4 w-4" />}
            onClick={() => {
              closeHeaderMenu();
              navigate(APP_ROUTES.crm.usuarios);
            }}
          >
            {t('nav.manageUsers')}
          </Button>
        )}
        <Button
          variant="ghost"
          className="justify-start text-red-500 hover:bg-red-500/10 hover:text-red-500"
          onClick={() => {
            closeHeaderMenu();
            handleLogout();
          }}
          leftIcon={<LogOut className="h-4 w-4" />}
        >
          {t('crmShell.logoutConfirm')}
        </Button>
      </div>
    </>
  );
  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateProfile.mutate({
      nombres: profileForm.nombres.trim(),
      apellidos: profileForm.apellidos.trim(),
      email: profileForm.email.trim(),
    });
  };
  const handleCompanySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!company) return;
    updateCompany.mutate({
      companyId: company.id_empresa,
      payload: {
        razon_social: companyForm.razon_social.trim(),
        ruc: companyForm.ruc.trim(),
        direccion: companyForm.direccion.trim() || undefined,
        telefono: companyForm.telefono.trim() || undefined,
        email: companyForm.email.trim() || undefined,
        representante_legal: companyForm.representante_legal.trim() || undefined,
      },
    });
  };
  const handleLogout = useCallback(() => {
    setHeaderMenuOpen(false);
    logout();
    navigate(APP_ROUTES.crm.login);
  }, [logout, navigate]);
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-content">
        <p className="text-sm text-content-muted">{t('crmShell.loading')}</p>
      </div>
    );
  }

  if (!user || user.type !== 'empresa') {
    return null;
  }
  return (
    <Fragment>
      <div className="flex min-h-screen flex-col bg-background text-content transition-colors">
        <header className="sticky top-0 z-40 border-b border-border bg-surface/95 px-4 py-1.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-surface/80 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 md:min-h-[56px]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={navigationToggleLabel}
                title={navigationToggleLabel}
                onClick={handleNavigationToggle}
                ref={navToggleRef}
                className={cn(
                  'flex items-center justify-center rounded-full border border-border-subtle bg-surface text-content transition hover:border-primary-400 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  isMobileScreen ? 'h-12 w-12' : 'h-10 w-10',
                  isHamburgerActive && 'border-primary-500 text-primary-600',
                )}
              >
                <Menu className={cn(isMobileScreen ? 'h-7 w-7' : 'h-5 w-5')} />
              </button>
              <div className="hidden items-center gap-3 sm:flex">
                <img src={freelerLogo} alt="Freeler CRM" className="h-8 w-auto" />
                <div>
                  <h1 className="text-xl font-semibold text-content">{t('common.freelerCrm')}</h1>
                  <p className="text-xs text-content-muted">{companyName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:hidden">
                <img src={freelerLogo} alt="Freeler CRM" className="h-8 w-auto" />
                <div>
                  <h1 className="text-lg font-semibold text-content">{t('common.freelerCrm')}</h1>
                  <p className="text-xs text-content-muted">{companyName}</p>
                </div>
              </div>
            </div>
            <div className="relative flex items-center gap-2 sm:gap-3" ref={headerMenuRef}>
              <ThemeSwitch />
              <button
                type="button"
                onClick={() => setHeaderMenuOpen((prev) => !prev)}
                className="flex items-center gap-3 rounded-full border border-border-subtle bg-surface px-2 py-1.5 transition hover:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
                  {getInitials(profileName || user?.email)}
                </span>
                <span className="hidden flex-col items-start text-left sm:flex">
                  <span className="text-xs text-content-muted">{t('crmShell.myProfile')}</span>
                  <span className="text-sm font-medium text-content">{profileName || user?.email}</span>
                </span>
              </button>
              {isHeaderMenuOpen && (
                <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-border bg-surface shadow-lg">
                  {headerMenuContent}
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="flex flex-1 bg-background-subtle">
          <aside
            className={cn(
              'relative hidden flex-shrink-0 overflow-hidden border-r border-border/40 bg-white/95 text-slate-700 shadow-xl transition-all duration-300 dark:border-transparent dark:bg-gradient-to-b dark:from-slate-950/95 dark:via-slate-900/95 dark:to-slate-950/90 dark:text-white md:flex md:flex-col md:sticky md:top-[64px] md:h-[calc(100vh-64px)]',
              isSidebarCollapsed ? 'w-20 px-3 py-4' : 'w-72 px-5 py-6 lg:w-80',
            )}
          >
            <div className="flex flex-1 flex-col gap-6">
              <div
                className={cn(
                  'flex gap-3 px-1 text-left',
                  isSidebarCollapsed ? 'flex-col items-center gap-2 px-0' : 'items-center',
                )}
              >
                <div className="relative inline-flex">
                  <AvatarCircle name={companyName} imageUrl={companyLogo} size="md" />
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-700 shadow-card dark:bg-white/90">
                    <Building2 className="h-3 w-3" />
                  </span>
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex flex-col leading-tight">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{companyName}</p>
                  </div>
                )}
              </div>
              <nav
                className={cn(
                  'flex flex-1 flex-col gap-1.5 text-sm font-semibold text-slate-600 dark:text-white/70',
                  isSidebarCollapsed && 'gap-2 p-0 py-1',
                )}
              >
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-xl border px-3 py-2 transition-all',
                        isActive
                          ? 'border-primary-300/70 bg-primary-50/60 text-primary-900 shadow-sm dark:border-primary-500 dark:bg-white/10 dark:text-white'
                          : 'border-transparent text-slate-500 hover:border-primary-100 hover:bg-primary-50/60 hover:text-slate-900 dark:text-white/60 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white',
                        isSidebarCollapsed && 'justify-center px-0 py-2',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <div className="flex flex-1 items-center gap-3">
                        {isSidebarCollapsed ? (
                          <span
                            className={cn(
                              'text-lg transition-colors',
                              isActive
                                ? 'text-primary-600 dark:text-primary-200'
                                : 'text-slate-500 dark:text-white/70 group-hover:text-primary-400',
                            )}
                          >
                            {item.icon}
                          </span>
                        ) : (
                          <span
                            className={cn(
                              'flex h-9 w-9 items-center justify-center rounded-2xl border border-transparent bg-white text-lg text-primary-600 shadow-sm transition-all dark:bg-white/10 dark:text-white',
                              isActive && 'border-primary-300 bg-white text-primary-800 dark:border-primary-500',
                            )}
                          >
                            {item.icon}
                          </span>
                        )}
                        {!isSidebarCollapsed && (
                          <div className="flex flex-1 items-center justify-between gap-2">
                            <span
                              className={cn(
                                'font-semibold tracking-wide',
                                isActive ? 'text-primary-900 dark:text-white' : 'text-slate-700 dark:text-white/80',
                              )}
                            >
                              {item.label}
                            </span>
                            {isActive && (
                              <span className="h-1 w-10 rounded-full bg-primary-400 shadow-[0_0_10px_rgba(59,130,246,0.6)] dark:bg-primary-200" />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </NavLink>
                ))}
              </nav>
              <div className="mt-auto flex items-center justify-start gap-3 px-1">
                <div className="relative inline-flex">
                  <AvatarCircle name={profileName} imageUrl={profileAvatar} size="md" />
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-100 text-primary-700 shadow-card dark:bg-white/80">
                    <UserIcon className="h-3 w-3" />
                  </span>
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex flex-col text-left leading-tight">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{profileName}</p>
                  </div>
                )}
              </div>
            </div>
          </aside>
          <div className="flex flex-1 flex-col overflow-hidden">
            <main className="flex-1 overflow-auto px-4 py-6 pb-28 transition-colors sm:px-6 lg:px-10 lg:pb-10 min-h-0">
              <div className="mx-auto w-full max-w-screen-2xl">
                <div className="min-w-full overflow-x-auto">
                  <div className="space-y-8">
                    <Outlet />
                  </div>
                </div>
              </div>
            </main>
            {/* Barra inferior para navegacin en dispositivos mviles */}
            <nav className="crm-mobile-footer fixed inset-x-0 bottom-0 z-[var(--z-drawer)] border-t border-transparent bg-gradient-to-r from-primary-700 via-primary-600 to-primary-700 text-white shadow-[0_-10px_30px_rgba(15,23,42,0.45)] dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 md:hidden">
              <div className="mx-auto flex max-w-4xl items-center justify-around gap-1 px-3 py-2">
                {visibleMobileNavItems.map((item) => (
                  <NavLink
                    key={`mobile-${item.to}`}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex flex-1 flex-col items-center gap-1 text-[0.8em] font-semibold uppercase tracking-wide transition',
                        isActive ? 'text-white' : 'text-white/70 hover:text-white',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-lg shadow-inner transition',
                            isActive ? 'bg-white text-primary-700 dark:bg-white/90' : 'text-white/80',
                          )}
                        >
                          {item.icon}
                        </span>
                        <span className="max-w-[5rem] truncate text-[0.7em] font-semibold">
                          {item.label}
                        </span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </nav>
          </div>
        </div>
      </div>
      {/* Hoja de acciones simplificada pensada para navegacin mvil */}
      <Dialog
        open={isProfileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        title={t('crmShell.profileDialogTitle')}
        description={t('crmShell.profileDialogDescription')}
      >
        <form className="space-y-5" onSubmit={handleProfileSubmit}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
            <AvatarCircle name={profileName} imageUrl={profileAvatar} size="lg" />
            <div className="flex-1 space-y-2">
              <p className="text-sm text-content-muted">
                {t('crmShell.uploadAvatarHint')}
              </p>
              <div className="flex flex-wrap gap-2">
                <label className="relative inline-flex cursor-pointer items-center rounded-md border border-border-subtle bg-surface px-3 py-2 text-xs font-semibold text-content hover:bg-surface-muted">
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void handleAvatarFile(file ?? null);
                      event.target.value = '';
                    }}
                  />
                  {t('crmShell.changePhoto')}
                </label>
                {profileAvatar && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 px-3 text-xs"
                    onClick={clearAvatar}
                  >
                    {t('crmShell.remove')}
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label={t('crmShell.fields.firstName')}
              value={profileForm.nombres}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, nombres: event.target.value }))}
              required
            />
            <Input
              label={t('crmShell.fields.lastName')}
              value={profileForm.apellidos}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, apellidos: event.target.value }))}
              required
            />
            <Input
              label={t('crmShell.fields.email')}
              type="email"
              value={profileForm.email}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
            <Input
              label={t('crmShell.fields.role')}
              value={roleLabel}
              disabled
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setProfileDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={updateProfile.isLoading}>
              {t('common.saveChanges')}
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={isCompanyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        title={t('crmShell.companyDialogTitle')}
        description={t('crmShell.companyDialogDescription')}
        size="lg"
      >
        <form className="space-y-5" onSubmit={handleCompanySubmit}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
            <AvatarCircle name={companyName} imageUrl={companyLogo} size="lg" />
            <div className="flex-1 space-y-2">
              <p className="text-sm text-content-muted">
                {t('crmShell.uploadLogoHint')}
              </p>
              <div className="flex flex-wrap gap-2">
                <label className="relative inline-flex cursor-pointer items-center rounded-md border border-border-subtle bg-surface px-3 py-2 text-xs font-semibold text-content hover:bg-surface-muted">
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void handleCompanyLogoFile(file ?? null);
                      event.target.value = '';
                    }}
                  />
                  {t('crmShell.changeLogo')}
                </label>
                {companyLogo && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 px-3 text-xs"
                    onClick={clearCompanyLogo}
                  >
                    {t('crmShell.remove')}
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label={t('crmShell.fields.businessName')}
              value={companyForm.razon_social}
              onChange={(event) =>
                setCompanyForm((prev) => ({ ...prev, razon_social: event.target.value }))
              }
              required
            />
            <Input
              label={t('crmShell.fields.ruc')}
              value={companyForm.ruc}
              onChange={(event) => setCompanyForm((prev) => ({ ...prev, ruc: event.target.value }))}
              required
            />
            <Input
              label={t('crmShell.fields.contactEmail')}
              type="email"
              value={companyForm.email}
              onChange={(event) => setCompanyForm((prev) => ({ ...prev, email: event.target.value }))}
            />
            <Input
              label={t('crmShell.fields.phone')}
              value={companyForm.telefono}
              onChange={(event) => setCompanyForm((prev) => ({ ...prev, telefono: event.target.value }))}
            />
            <Input
              label={t('crmShell.fields.address')}
              value={companyForm.direccion}
              onChange={(event) =>
                setCompanyForm((prev) => ({ ...prev, direccion: event.target.value }))
              }
            />
            <Input
              label={t('crmShell.fields.legalRepresentative')}
              value={companyForm.representante_legal}
              onChange={(event) =>
                setCompanyForm((prev) => ({ ...prev, representante_legal: event.target.value }))
              }
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setCompanyDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={updateCompany.isLoading} disabled={!company}>
              {t('common.saveChanges')}
            </Button>
          </div>
        </form>
      </Dialog>
      {!isDesktopLayout && isMobileOverflowOpen && (
        <div className="fixed inset-0 z-[var(--z-drawer)]" onClick={() => setMobileOverflowOpen(false)}>
          <div
            className="absolute w-60 rounded-2xl border border-border-subtle bg-surface p-3 shadow-2xl"
            style={overflowMenuPosition ?? { right: 16, top: 76 }}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="px-2 text-xs uppercase tracking-wide text-content-muted">
              {t('crmShell.moreModules')}
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {overflowNavItems.length ? (
                overflowNavItems.map((item) => (
                  <NavLink
                    key={`overflow-${item.to}`}
                    to={item.to}
                    onClick={() => setMobileOverflowOpen(false)}
                    className="flex items-center gap-3 rounded-xl border border-border-subtle px-3 py-2 text-sm font-semibold text-content transition hover:border-primary-500 hover:text-primary-600"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/70 text-primary-600 shadow-sm dark:bg-white/10 dark:text-white">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </NavLink>
                ))
              ) : (
                <p className="px-2 text-xs text-content-muted">{t('crmShell.moreModulesEmpty')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Fragment>
  );
};
export default CrmShell;



