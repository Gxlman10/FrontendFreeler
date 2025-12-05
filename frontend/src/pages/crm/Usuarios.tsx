import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserService } from '@/services/user.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { ROLE_LABELS, Role, mapBackendRole } from '@/utils/constants';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/common/Toasts';
import { useAuth } from '@/store/auth';
import { Badge } from '@/components/ui/Badge';
import { getRoleBadgeVariant, getStatusBadgeVariant, normalizeStatusLabel } from '@/utils/badges';
import { t } from '@/i18n';

const ROLE_OPTIONS = [
  { value: 1, label: ROLE_LABELS[Role.ADMIN] },
  { value: 2, label: ROLE_LABELS[Role.SUPERVISOR] },
  { value: 3, label: ROLE_LABELS[Role.VENDEDOR] },
  { value: 4, label: ROLE_LABELS[Role.ANALISTA] },
];

type NewUserForm = {
  nombres: string;
  apellidos: string;
  email: string;
  password: string;
  roleId: number;
  status: number;
};

const buildInitialForm = (): NewUserForm => ({
  nombres: '',
  apellidos: '',
  email: '',
  password: '',
  roleId: ROLE_OPTIONS[0]?.value ?? 1,
  status: 1,
});

export const Usuarios = () => {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const { user } = useAuth();
  const usuariosQueryKey = ['crm-usuarios-empresa', user?.companyId ?? 'none'];

  const { data, isLoading } = useQuery({
    queryKey: usuariosQueryKey,
    queryFn: () =>
      UserService.getUsuariosEmpresa(
        user?.companyId ? { id_empresa: user.companyId } : {},
      ),
    enabled: Boolean(user?.companyId),
  });

  const usuarios = useMemo(
    () => (Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []),
    [data],
  );

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NewUserForm>(() => buildInitialForm());
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<NewUserForm>(() => buildInitialForm());
  const [editingUser, setEditingUser] = useState<any | null>(null);

  const createUser = useMutation({
    mutationFn: async () => {
      if (!user?.companyId) {
        push({
          title: t('crmUsers.errors.missingCompanyTitle'),
          description: t('crmUsers.errors.missingCompanyDescription'),
          variant: 'danger',
        });
        throw new Error('MISSING_COMPANY_ID');
      }

      return UserService.createUsuarioEmpresa({
        id_empresa: user.companyId,
        id_rol: form.roleId,
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        email: form.email.trim(),
        password: form.password,
        estado: form.status ?? 1,
      });
    },
    onSuccess: () => {
      const description = form.nombres
        ? t('crmUsers.toasts.createSuccess.descriptionNamed', { name: form.nombres })
        : t('crmUsers.toasts.createSuccess.description');
      push({ title: t('crmUsers.toasts.createSuccess.title'), description });
      setDialogOpen(false);
      setForm(buildInitialForm());
      queryClient.invalidateQueries({ queryKey: usuariosQueryKey });
    },
    onError: () => {
      push({
        title: t('crmUsers.toasts.createError.title'),
        description: t('crmUsers.toasts.createError.description'),
        variant: 'danger',
      });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.nombres.trim() || !form.apellidos.trim() || !form.email.trim() || !form.password.trim()) {
      push({
        title: t('crmUsers.errors.incompleteTitle'),
        description: t('crmUsers.errors.createIncomplete'),
        variant: 'warning',
      });
      return;
    }
    createUser.mutate();
  };

  const updateUser = useMutation({
    mutationFn: async (payload: NewUserForm) => {
      if (!editingUser) {
        throw new Error('NO_USER_SELECTED');
      }
      return UserService.updateUsuarioEmpresa(editingUser.id_usuario_empresa, {
        nombres: payload.nombres.trim(),
        apellidos: payload.apellidos.trim(),
        email: payload.email.trim(),
        id_rol: payload.roleId,
        estado: payload.status,
        ...(payload.password.trim() ? { password: payload.password } : {}),
      });
    },
    onSuccess: (updated) => {
      const updatedName = `${updated.nombres ?? ''} ${updated.apellidos ?? ''}`.trim();
      const description = updatedName
        ? t('crmUsers.toasts.updateSuccess.descriptionNamed', { name: updatedName })
        : t('crmUsers.toasts.updateSuccess.description');
      push({
        title: t('crmUsers.toasts.updateSuccess.title'),
        description,
      });
      setEditDialogOpen(false);
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: usuariosQueryKey });
    },
    onError: () => {
      push({
        title: t('crmUsers.toasts.updateError.title'),
        description: t('crmUsers.toasts.updateError.description'),
        variant: 'danger',
      });
    },
  });

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editForm.nombres.trim() || !editForm.apellidos.trim() || !editForm.email.trim()) {
      push({
        title: t('crmUsers.errors.incompleteTitle'),
        description: t('crmUsers.errors.editIncomplete'),
        variant: 'warning',
      });
      return;
    }
    updateUser.mutate(editForm);
  };

  const openEditDialog = (usuario: any) => {
    setEditingUser(usuario);
    setEditForm({
      nombres: usuario.nombres ?? '',
      apellidos: usuario.apellidos ?? '',
      email: usuario.email ?? '',
      password: '',
      roleId: usuario.rol?.id_rol ?? ROLE_OPTIONS[0].value,
      status: typeof usuario.estado === 'number' ? usuario.estado : 1,
    });
    setEditDialogOpen(true);
  };

  return (
    <section className="space-y-6 text-content">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-content">{t('crmUsers.title')}</h1>
          <p className="text-sm text-content-muted">{t('crmUsers.subtitle')}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>{t('crmUsers.actions.newUser')}</Button>
      </header>

      {isLoading ? (
        <p className="text-sm text-content-muted">{t('crmUsers.loading')}</p>
      ) : (
        <Table minWidthClass="min-w-[680px]">
          <TableHeader>
            <TableRow>
              <TableHead>{t('crmUsers.table.name')}</TableHead>
              <TableHead>{t('crmUsers.table.email')}</TableHead>
              <TableHead>{t('crmUsers.table.role')}</TableHead>
              <TableHead>{t('crmUsers.table.status')}</TableHead>
              <TableHead className="text-right">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((usuario: any) => (
              <TableRow key={usuario.id_usuario_empresa}>
                <TableCell>{`${usuario.nombres ?? ''} ${usuario.apellidos ?? ''}`.trim()}</TableCell>
                <TableCell className="whitespace-pre-wrap break-words">{usuario.email ?? '-'}</TableCell>
                <TableCell>
                  {(() => {
                    const role = mapBackendRole(usuario.rol?.nombre);
                    const label = role ? ROLE_LABELS[role] : t('crmUsers.table.noRole');
                    return <Badge variant={getRoleBadgeVariant(role)}>{label}</Badge>;
                  })()}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(usuario.estado)}>
                    {normalizeStatusLabel(usuario.estado, t('crmUsers.table.noStatus'))}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => openEditDialog(usuario)}>
                    {t('crmUsers.actions.edit')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!usuarios.length && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-content-muted">
                  {t('crmUsers.table.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setForm(buildInitialForm());
        }}
        title={t('crmUsers.dialogs.createTitle')}
        description={t('crmUsers.dialogs.createDescription')}
      >
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Input
            label={t('crmShell.fields.firstName')}
            placeholder={t('crmUsers.form.firstNamePlaceholder')}
            required
            value={form.nombres}
            onChange={(event) => setForm((prev) => ({ ...prev, nombres: event.target.value }))}
          />
          <Input
            label={t('crmShell.fields.lastName')}
            placeholder={t('crmUsers.form.lastNamePlaceholder')}
            required
            value={form.apellidos}
            onChange={(event) => setForm((prev) => ({ ...prev, apellidos: event.target.value }))}
          />
          <Input
            label={t('crmShell.fields.email')}
            placeholder={t('crmUsers.form.emailPlaceholder')}
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <Input
            label={t('crmUsers.form.tempPasswordLabel')}
            placeholder={t('crmUsers.form.tempPasswordPlaceholder')}
            type="password"
            required
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          />
          <Select
            label={t('crmShell.fields.role')}
            value={String(form.roleId)}
            onChange={(event) => setForm((prev) => ({ ...prev, roleId: Number(event.target.value) }))}
            options={ROLE_OPTIONS.map((option) => ({ label: option.label, value: String(option.value) }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createUser.isLoading}>
              {t('crmUsers.actions.register')}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingUser(null);
            setEditForm(buildInitialForm());
          }
        }}
        title={t('crmUsers.dialogs.editTitle')}
        description={t('crmUsers.dialogs.editDescription')}
      >
        <form className="space-y-3" onSubmit={handleEditSubmit}>
          <Input
            label={t('crmShell.fields.firstName')}
            placeholder={t('crmUsers.form.firstNamePlaceholder')}
            required
            value={editForm.nombres}
            onChange={(event) => setEditForm((prev) => ({ ...prev, nombres: event.target.value }))}
          />
          <Input
            label={t('crmShell.fields.lastName')}
            placeholder={t('crmUsers.form.lastNamePlaceholder')}
            required
            value={editForm.apellidos}
            onChange={(event) => setEditForm((prev) => ({ ...prev, apellidos: event.target.value }))}
          />
          <Input
            label={t('crmShell.fields.email')}
            placeholder={t('crmUsers.form.emailPlaceholder')}
            type="email"
            required
            value={editForm.email}
            onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <Input
            label={t('crmUsers.form.updatePasswordLabel')}
            placeholder={t('crmUsers.form.updatePasswordPlaceholder')}
            type="password"
            value={editForm.password}
            onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
            helperText={t('crmUsers.form.updatePasswordHelper')}
          />
          <Select
            label={t('crmShell.fields.role')}
            value={String(editForm.roleId)}
            onChange={(event) => setEditForm((prev) => ({ ...prev, roleId: Number(event.target.value) }))}
            options={ROLE_OPTIONS.map((option) => ({ label: option.label, value: String(option.value) }))}
          />
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-3">
            <div>
              <p className="text-sm font-medium text-content">{t('crmUsers.form.statusLabel')}</p>
              <p className="text-xs text-content-muted">{t('crmUsers.form.statusHelper')}</p>
            </div>
            <Switch
              checked={editForm.status === 1}
              onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.checked ? 1 : 0 }))}
              aria-label={t('crmUsers.form.statusLabel')}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={updateUser.isLoading}>
              {t('common.saveChanges')}
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
};

export default Usuarios;

