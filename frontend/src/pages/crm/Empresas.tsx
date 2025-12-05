import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserService, Empresa } from '@/services/user.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/common/Toasts';
import { t } from '@/i18n';
import { Badge } from '@/components/ui/Badge';
import { getStatusBadgeVariant, normalizeStatusLabel } from '@/utils/badges';

type EmpresaForm = {
  razon_social: string;
  ruc: string;
  representante_legal: string;
  direccion: string;
  telefono: string;
  email: string;
};

const buildInitialForm = (): EmpresaForm => ({
  razon_social: '',
  ruc: '',
  representante_legal: '',
  direccion: '',
  telefono: '',
  email: '',
});

const buildEmptyErrors = (): Record<keyof EmpresaForm, string> => ({
  razon_social: '',
  ruc: '',
  representante_legal: '',
  direccion: '',
  telefono: '',
  email: '',
});

export const Empresas = () => {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState<EmpresaForm>(() => buildInitialForm());
  const [editForm, setEditForm] = useState<EmpresaForm>(() => buildInitialForm());
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [formErrors, setFormErrors] = useState<Record<keyof EmpresaForm, string>>(buildEmptyErrors());
  const [editErrors, setEditErrors] = useState<Record<keyof EmpresaForm, string>>(buildEmptyErrors());

  const { data, isLoading } = useQuery({
    queryKey: ['crm-empresas'],
    queryFn: () => UserService.getEmpresas(),
  });

  const empresas: Empresa[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

  const sanitizePayload = (payload: EmpresaForm) => ({
    razon_social: payload.razon_social.trim(),
    ruc: payload.ruc.trim(),
    representante_legal: payload.representante_legal.trim() || undefined,
    direccion: payload.direccion.trim() || undefined,
    telefono: payload.telefono.trim() || undefined,
    email: payload.email.trim() || undefined,
  });

  const createEmpresa = useMutation({
    mutationFn: () => UserService.createEmpresa(sanitizePayload(form)),
    onSuccess: () => {
      push({ title: 'Empresa registrada', description: form.razon_social });
      setDialogOpen(false);
      setForm(buildInitialForm());
      setFormErrors(buildEmptyErrors());
      queryClient.invalidateQueries({ queryKey: ['crm-empresas'] });
    },
    onError: () => {
      push({
        title: 'No se pudo registrar',
        description: 'Verifica los datos ingresados.',
        variant: 'danger',
      });
    },
  });

  const updateEmpresa = useMutation({
    mutationFn: (payload: EmpresaForm) => {
      if (!editingEmpresa) {
        throw new Error('NO_EMPRESA_SELECTED');
      }
      return UserService.updateEmpresa(editingEmpresa.id_empresa, sanitizePayload(payload));
    },
    onSuccess: (updated) => {
      push({
        title: 'Empresa actualizada',
        description: updated.razon_social ?? 'Datos guardados correctamente.',
      });
      setEditDialogOpen(false);
      setEditingEmpresa(null);
      setEditErrors(buildEmptyErrors());
      queryClient.invalidateQueries({ queryKey: ['crm-empresas'] });
    },
    onError: () => {
      push({
        title: 'No se pudo actualizar',
        description: 'Intenta nuevamente.',
        variant: 'danger',
      });
    },
  });

  const validateForm = (current: EmpresaForm) => {
    const errors: Record<keyof EmpresaForm, string> = {
      razon_social: '',
      ruc: '',
      representante_legal: '',
      direccion: '',
      telefono: '',
      email: '',
    };

    const razon = current.razon_social.trim();
    if (razon.length < 2 || razon.length > 255) {
      errors.razon_social = 'Ingresa una razon social entre 2 y 255 caracteres.';
    }

    const ruc = current.ruc.trim();
    if (!/^\d{11}$/.test(ruc)) {
      errors.ruc = 'El RUC debe contener exactamente 11 digitos.';
    }

    const representante = current.representante_legal.trim();
    if (representante && representante.length > 255) {
      errors.representante_legal = 'El representante legal no puede exceder 255 caracteres.';
    }

    const direccion = current.direccion.trim();
    if (direccion.length > 255) {
      errors.direccion = 'La direccion no puede exceder 255 caracteres.';
    }

    const telefono = current.telefono.trim();
    if (telefono) {
      if (telefono.length > 25) {
        errors.telefono = 'El telefono no puede exceder 25 caracteres.';
      } else if (!/^[+()\-.\d\s]+$/.test(telefono)) {
        errors.telefono = 'El telefono solo puede contener digitos y los simbolos + ( ) - .';
      }
    }

    const email = current.email.trim();
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.email = 'Ingresa un correo electronico valido.';
      } else if (email.length > 255) {
        errors.email = 'El correo no puede exceder 255 caracteres.';
      }
    }

    const hasErrors = Object.values(errors).some(Boolean);
    return { errors, isValid: !hasErrors };
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { errors, isValid } = validateForm(form);
    setFormErrors(errors);
    if (!isValid) {
      const firstError = Object.values(errors).find(Boolean);
      push({
        title: 'Datos invalidos',
        description: firstError ?? 'Revisa los campos resaltados.',
        variant: 'warning',
      });
      return;
    }
    createEmpresa.mutate();
  };

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { errors, isValid } = validateForm(editForm);
    setEditErrors(errors);
    if (!isValid) {
      const firstError = Object.values(errors).find(Boolean);
      push({
        title: 'Datos invalidos',
        description: firstError ?? 'Revisa los campos resaltados.',
        variant: 'warning',
      });
      return;
    }
    updateEmpresa.mutate(editForm);
  };

  const openEditDialog = (empresa: Empresa) => {
    setEditingEmpresa(empresa);
    setEditForm({
      razon_social: empresa.razon_social ?? '',
      ruc: empresa.ruc ?? '',
      representante_legal: empresa.representante_legal ?? '',
      direccion: empresa.direccion ?? '',
      telefono: empresa.telefono ?? '',
      email: empresa.email ?? '',
    });
    setEditErrors(buildEmptyErrors());
    setEditDialogOpen(true);
  };

  const isCreating = createEmpresa.isLoading;
  const isUpdating = updateEmpresa.isLoading;

  const errorMessages = useMemo(() => formErrors, [formErrors]);
  const editErrorMessages = useMemo(() => editErrors, [editErrors]);

  return (
    <section className="space-y-6 text-content">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-content">Empresas</h1>
          <p className="text-sm text-content-muted">Administra las empresas que participan del programa.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>Registrar empresa</Button>
      </header>

      {isLoading ? (
        <p className="text-sm text-content-muted">Cargando empresas...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razon social</TableHead>
              <TableHead>RUC</TableHead>
              <TableHead>Representante</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empresas.map((empresa) => (
              <TableRow key={empresa.id_empresa}>
                <TableCell>{empresa.razon_social ?? ''}</TableCell>
                <TableCell>{empresa.ruc ?? ''}</TableCell>
                <TableCell>{empresa.representante_legal ?? 'Sin asignar'}</TableCell>
                <TableCell>{empresa.email ?? ''}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(empresa.estado)}>
                    {normalizeStatusLabel(empresa.estado, 'Sin estado')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => openEditDialog(empresa)}>
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!empresas.length && (
              <TableRow>
                <TableCell colSpan={6}>Aun no hay empresas registradas.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setForm(buildInitialForm());
            setFormErrors(buildEmptyErrors());
          }
        }}
        title="Registrar nueva empresa"
        description="Completa los datos basicos de la empresa."
      >
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Input
            label="Razon social"
            required
            value={form.razon_social}
            onChange={(event) => setForm((prev) => ({ ...prev, razon_social: event.target.value }))}
            error={errorMessages.razon_social}
          />
          <Input
            label="RUC"
            required
            maxLength={11}
            value={form.ruc}
            onChange={(event) => setForm((prev) => ({ ...prev, ruc: event.target.value }))}
            error={errorMessages.ruc}
          />
          <Input
            label="Representante legal"
            value={form.representante_legal}
            onChange={(event) => setForm((prev) => ({ ...prev, representante_legal: event.target.value }))}
            error={errorMessages.representante_legal}
          />
          <Input
            label="Correo"
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            error={errorMessages.email}
          />
          <Input
            label="Telefono"
            value={form.telefono}
            onChange={(event) => setForm((prev) => ({ ...prev, telefono: event.target.value }))}
            maxLength={25}
            error={errorMessages.telefono}
          />
          <Input
            label="Direccion"
            value={form.direccion}
            onChange={(event) => setForm((prev) => ({ ...prev, direccion: event.target.value }))}
            error={errorMessages.direccion}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isCreating}>
              Guardar
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingEmpresa(null);
            setEditForm(buildInitialForm());
            setEditErrors(buildEmptyErrors());
          }
        }}
        title="Editar empresa"
        description="Actualiza los datos de la empresa seleccionada."
      >
        <form className="space-y-3" onSubmit={handleEditSubmit}>
          <Input
            label="Razon social"
            required
            value={editForm.razon_social}
            onChange={(event) => setEditForm((prev) => ({ ...prev, razon_social: event.target.value }))}
            error={editErrorMessages.razon_social}
          />
          <Input
            label="RUC"
            required
            maxLength={11}
            value={editForm.ruc}
            onChange={(event) => setEditForm((prev) => ({ ...prev, ruc: event.target.value }))}
            error={editErrorMessages.ruc}
          />
          <Input
            label="Representante legal"
            value={editForm.representante_legal}
            onChange={(event) => setEditForm((prev) => ({ ...prev, representante_legal: event.target.value }))}
            error={editErrorMessages.representante_legal}
          />
          <Input
            label="Direccion"
            value={editForm.direccion}
            onChange={(event) => setEditForm((prev) => ({ ...prev, direccion: event.target.value }))}
            error={editErrorMessages.direccion}
          />
          <Input
            label="Telefono"
            maxLength={25}
            value={editForm.telefono}
            onChange={(event) => setEditForm((prev) => ({ ...prev, telefono: event.target.value }))}
            error={editErrorMessages.telefono}
          />
          <Input
            label="Correo"
            type="email"
            value={editForm.email}
            onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
            error={editErrorMessages.email}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isUpdating}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
};

export default Empresas;
