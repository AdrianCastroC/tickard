# Tickard V1 — Invitaciones entre usuarios

## Alcance

Invitaciones **solo para cuentas Tickard registradas**, identificadas por correo o identificador público `nick#ID`. No hay listas de amigos, enlaces compartibles, invitaciones a cuentas inexistentes ni SMTP.

En **Mi perfil** se muestra una única línea llamada **ID**, con el valor completo (por ejemplo, `ana#00001`) y un botón para copiarlo. No hay un campo independiente de nickname.

La base de datos guarda directamente el identificador completo y permanente en `users.public_handle` (índice `UNIQUE`). Se genera **una sola vez** al crear la cuenta, usando el primer nombre normalizado a minúsculas y el ID numérico real de `users.id`, completado con ceros a la izquierda hasta cinco dígitos como mínimo. Por ejemplo: `ana#00001`, `maria#00125`, `juan#100000`. Los IDs más largos nunca se truncan.

El nombre y los apellidos pueden cambiarse posteriormente sin modificar `public_handle`. No puede cambiarse el ID desde el perfil, la API ni mediante actualizaciones ordinarias del modelo. Para disponer de otro ID hay que registrar otra cuenta.

La migración `2026_10_16_090000_replace_nickname_with_immutable_public_handle.php` conserva **exactamente los identificadores ya utilizados**, calcula y guarda su valor antes de retirar la antigua columna `nickname`. Los IDs internos y las relaciones existentes no se modifican.

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
- `POST /api/workspaces/{workspace}/invitations` — cuerpo `{"recipients":["nick#00042","usuario@example.com"]}`.
- `POST /api/workspaces/{workspace}/invitations/delete` — cuerpo `{"ids":[1,2]}`.
- `GET /api/projects/{project}/invitations` — listado autorizado.
- `POST /api/projects/{project}/invitations` — `{"recipients":["nick#00042"],"role":"editor"}`.
- `POST /api/projects/{project}/invitations/delete` — `{"ids":[1,2]}`.
- `GET /api/my/invitations` — recibidas, para cualquier usuario autenticado.
- `POST /api/my/invitations/{invitation}/respond` — `{"action":"accept"}` o `{"action":"reject"}`.
- `PATCH /api/me` — permite editar `first_name`, `last_name`, contraseña y preferencias. Rechaza `public_handle`, `nickname` (parámetro antiguo), `email`, `handle`, `name` e `id`.

## Instalación y pruebas

```bash
cd backend
php artisan migrate
php artisan test --filter=WorkspaceInvitationsTest
php artisan invitations:prune
```

En producción ejecutar el **programador de tareas de Laravel** mediante cron (una vez por minuto invocando `php artisan schedule:run`) para que `invitations:prune` se lance automáticamente a diario. Incluso antes de ejecutar el comando, los registros aceptados con más de cinco días se ocultan de la API.

No hay que configurar `MAIL_MAILER` ni `FRONTEND_URL` para estas invitaciones internas.
