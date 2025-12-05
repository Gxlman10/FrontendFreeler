# Freeler Frontend

Aplicacion web en React + Vite para la plataforma Freeler. Incluye los portales de **Referidos** y **CRM** con autenticacion basada en JWT emitidos por el backend NestJS.

## Requisitos

- [Node.js](https://nodejs.org/) 18 LTS o superior
- npm 9+

## Instalacion y ejecucion local

```bash
cd frontend-freeler/frontend
npm install
npm run dev
```

Por defecto Vite se levanta en `http://localhost:5173`.

## Variables de entorno

Crea un archivo `.env.local` en `frontend-freeler/frontend/` con las siguientes claves:

```env
VITE_APP_NAME=Freeler
VITE_API_URL=http://localhost:3000
VITE_DEFAULT_THEME=system
```

- `VITE_API_URL` debe apuntar a la URL publica del backend NestJS. Para el entorno cloud usa la direccion HTTPS del API desplegada en AWS (por ejemplo `https://api.freeler.xyz`).
- `VITE_DEFAULT_THEME` acepta `light`, `dark` o `system`.

## Scripts disponibles

| Comando           | Descripcion                                         |
| ----------------- | --------------------------------------------------- |
| `npm run dev`     | Levanta Vite con HMR                                 |
| `npm run build`   | Genera la version optimizada en `dist/`             |
| `npm run preview` | Sirve el build generado para verificacion rapida     |
| `npm run lint`    | Ejecuta ESLint con la configuracion recomendada     |

## Flujo de autenticacion

- **Referidos**: usa `POST /auth/freeler/login` y `POST /usuarios-freeler/register`. El registro requiere DNI de 8 digitos, correo valido y contrasena con letras y numeros.
- **CRM**: el registro de empresa (`POST /auth/empresa/register`) crea un usuario con rol ADMIN ligado a la nueva empresa y redirige al modulo de Usuarios para crear cuentas adicionales (Superadmin, Vendedor, Analitica).

## Datos de ejemplo

Puedes invocar directamente los endpoints desde la terminal para cargar datos de prueba:

```bash
# Registrar empresa (recibe token tipo empresa)
curl -X POST "$VITE_API_URL/auth/empresa/register" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre_empresa": "Empresa Demo SAC",
    "ruc": "20601234567",
    "email": "admin@demo.com",
    "password": "Admin123",
    "telefono": "+51999999999"
  }'

# Registrar usuario freeler
curl -X POST "$VITE_API_URL/usuarios-freeler/register" \
  -H "Content-Type: application/json" \
  -d '{
    "nombres": "Andrea",
    "apellidos": "Rojas",
    "dni": "71384562",
    "email": "andrea@demo.com",
    "password": "Freeler123"
  }'
```

Los tokens devueltos se guardan en LocalStorage (`freeler:auth:user`, `freeler:auth:token`). Para cerrar sesion usa el menu en el header o en el lateral del CRM.

## Convenciones

- Utiliza las constantes de `APP_ROUTES` (`src/utils/constants.ts`) para crear enlaces o redirecciones.
- Las validaciones comunes (RUC, DNI, correo, contrasena) estan en `src/utils/validators.ts`.
- Los componentes atomicos viven en `src/components/ui` y los compuestos en `src/components/common`.
