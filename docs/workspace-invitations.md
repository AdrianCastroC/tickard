# Tickard — Invitaciones al Workspace (V1)

## Jerarquía

La cuenta personal es independiente de los Workspaces. Pertenecer a un Workspace **no da acceso automático a sus proyectos**. Una vez incorporado, el responsable concede acceso a cada proyecto desde **Personal**.

En V1 solo el **propietario** crea, consulta o cancela invitaciones del Workspace. Las nuevas personas entran con rol **member**; **owner** nunca se asigna por invitación.

## Métodos

### Correo electrónico

Se especifica dirección y caducidad (1–30 días; por defecto 7). Se genera un token aleatorio de 64 caracteres, almacenado únicamente como hash SHA-256. Se envía correo con enlace de un uso; el enlace también aparece después de crearlo para poder copiarlo.

Un usuario ya registrado debe **iniciar sesión** con la cuenta correspondiente a la dirección invitada; sus credenciales y perfil **no se modifican**. Si no tiene cuenta, se registra normalmente y después acepta con esa sesión. El enlace prueba el acceso al buzón destinatario; no es una invitación abierta a otra dirección.

No se puede enviar una nueva invitación por correo si la cuenta ya pertenece al Workspace o existe otra invitación de ese correo pendiente y vigente.

### Enlace compartible

La persona propietaria puede emitir un enlace para enviar por otros medios. Define caducidad (1–30 días) y número de usos (1–50). No se exige un correo predeterminado. Requiere una cuenta Tickard autenticada para aceptarlo.

La pantalla de administración muestra usos consumidos, usos máximos y caducidad, pero **nunca vuelve a revelar un token existente**: copiarlo corresponde al momento de la generación. Cancelar invalida el enlace.

## Comprobaciones en aceptación

La API rechaza enlaces revocados, caducados o agotados; cuentas con correo distinto al destinatario, miembros existentes y Workspaces que han alcanzado su límite de plazas. La comprobación del límite se ejecuta en transacción con bloqueo del Workspace, para evitar sobrepasarlo en aceptaciones simultáneas.

Los planes efectivos pertenecen al propietario; Free tiene 3 plazas, Base 10, Pro 30, Business usa su configuración. Los asientos adicionales se suman a la capacidad. El propietario ocupa una plaza.

## Interfaz y API

- Workspace → Vista general → **Miembros e invitaciones** (solo propietario).
- `GET /api/workspaces/{workspace}/members-invitations` — miembros, plazas e invitaciones vigentes.
- `POST /api/workspaces/{workspace}/invitations` — modo `email` o `link`, `expires_days`, `max_uses`.
- `DELETE /api/workspaces/{workspace}/invitations/{invitation}` — revocar.
- `GET /api/workspace-invitations/{token}` — información pública necesaria para la aceptación.
- `POST /api/workspace-invitations/{token}/accept` — requiere sesión autenticada.

La página `/invitar/workspace/{token}` admite iniciar sesión o registrarse, y devuelve al Workspace aceptado.

Las invitaciones antiguas de proyecto no deben cambiar credenciales: su aceptación ahora requiere iniciar sesión con el correo invitado. El formulario antiguo deja de ofrecer creación nueva; primero se invita al Workspace y luego se asigna al proyecto.

## Entorno local

Ejecutar migraciones:

```bash
cd backend
php artisan migrate
php artisan test --filter=WorkspaceInvitationsTest
```

Configurar en el backend:

```dotenv
FRONTEND_URL=http://localhost:5173
MAIL_MAILER=log
```

Con `MAIL_MAILER=log`, **el correo no sale realmente**: queda en `storage/logs/laravel.log`. Para entregar invitaciones a direcciones reales hay que configurar un transporte de correo válido (SMTP, etc.) y sus credenciales. Nunca incrustar tokens en logs públicos.

## Fuera de esta primera fase

Gestión de bajas y roles de miembros, reasignación de proyectos y Cards, transferencia de propiedad, reenvío de invitaciones sin revocar, preferencias de recepción, validación de correo de registro genérica y controles avanzados de uso compartido. Los enlaces compartidos se deben tratar como secretos: cualquiera que los posea puede usarlos mientras sigan vigentes.
