# Tickard V1 — Invitaciones entre usuarios

## Alcance

Invitaciones **solo para cuentas Tickard registradas**, identificadas por correo o identificador público `nick#ID`. No hay listas de amigos, enlaces compartibles, invitaciones a cuentas inexistentes ni SMTP.

El identificador se muestra en **Perfil**. La tabla `users` tiene `first_name` obligatorio, `last_name` opcional, `nickname` editable y `public_id` fijo de **seis dígitos**, independiente de la clave primaria interna e indexado con `UNIQUE`. El handle `nickname#public_id` siempre es único porque su sufijo lo es. Al registrarse, el nickname se crea a partir del **nombre**, nunca de los apellidos. El campo legado `name` conserva el nombre completo para las vistas existentes.\n\nLa migración separa el nombre completo de los usuarios existentes, preserva nicknames personalizados y asigna códigos públicos distintos a los registros existentes.

## Dos destinos, mismo flujo

- **Workspace → Vista general → Miembros e invitaciones:** solo el propietario puede invitar. Al aceptar, el usuario pasa a ser miembro del Workspace sin acceso automático a proyectos.
- **Proyecto → Personal → Invitar usuarios:** se selecciona un rol para todos los destinatarios del envío: responsable, editor o lector. Al aceptar, se incorpora al proyecto; si aún no pertenecía al Workspace, también se incorpora como miembro.
- Solo el propietario puede invitar a un proyecto a alguien ajeno al Workspace. Un responsable del proyecto puede invitar a personas que ya son miembros del Workspace. Nunca se puede invitar como owner ni como cliente desde este flujo.

El formulario admite varios destinatarios separados por comas, punto y coma o saltos de línea; mezcla correos e identificadores. Evita duplicados en el envío y devuelve los destinatarios que no se encontraron o no eran elegibles.

## Respuestas y estados

En **Bandeja de entrada** cada destinatario puede aceptar o rechazar. La API comprueba la identidad, el estado pendiente y la cuota de miembros al aceptar; lo hace bajo una transacción y bloqueo del Workspace.

- Pendiente: espera una respuesta; quien invita puede eliminarla individualmente o en bloque (se revoca).
- Rechazada: se mantiene hasta que se elimine manualmente, individualmente o en bloque.
- Aceptada: se mantiene cinco días desde la respuesta, después desaparece y se elimina mediante el comando `invitations:prune`. El usuario sigue siendo miembro y conserva su rol tras eliminar el registro histórico. No se permite eliminarla manualmente.
- Si hay que cambiar el rol mientras la invitación sigue pendiente, se elimina y se envía otra. Aceptar nunca sobreescribe un rol de proyecto previamente asignado.

La migración revoca las invitaciones por correo o enlace de la implementación anterior. Sus rutas públicas se retiran funcionalmente (410): no deben convertirse en una segunda vía de acceso.

## API

Autenticadas con Sanctum:

- `GET /api/workspaces/{workspace}/members-invitations` — vista del propietario.
- `POST /api/workspaces/{workspace}/invitations` — cuerpo `{"recipients":["nick#123456","usuario@example.com"]}`.
- `POST /api/workspaces/{workspace}/invitations/delete` — cuerpo `{"ids":[1,2]}`.
- `GET /api/projects/{project}/invitations` — listado autorizado.
- `POST /api/projects/{project}/invitations` — `{"recipients":["nick#123456"],"role":"editor"}`.
- `POST /api/projects/{project}/invitations/delete` — `{"ids":[1,2]}`.
- `GET /api/my/invitations` — recibidas, para cualquier usuario autenticado.
- `POST /api/my/invitations/{invitation}/respond` — `{"action":"accept"}` o `{"action":"reject"}`.
- `PATCH /api/me` — `{"nickname":"mi-nick"}`.

## Instalación y pruebas

```bash
cd backend
php artisan migrate
php artisan test --filter=WorkspaceInvitationsTest
php artisan invitations:prune
```

En producción ejecutar el **programador de tareas de Laravel** mediante cron (una vez por minuto invocando `php artisan schedule:run`) para que `invitations:prune` se lance automáticamente a diario. Incluso antes de ejecutar el comando, los registros aceptados con más de cinco días se ocultan de la API.

No hay que configurar `MAIL_MAILER` ni `FRONTEND_URL` para estas invitaciones internas.
