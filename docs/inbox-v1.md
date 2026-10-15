# Tickard V1 — Bandeja de entrada

## Objetivo

Unificar en una vista las **invitaciones recibidas** y los **avisos internos** que ya genera Tickard, sin introducir mensajería, push ni tiempo real en la primera versión.

La bandeja tiene tres bloques:
- **Invitaciones pendientes:** aceptar o rechazar; la aceptación incorpora al Workspace o proyecto con su rol.
- **Actividad:** notificaciones de asignaciones, comentarios y otras acciones. Indicador leído/no leído, botón «Solo no leídas», «Marcar todas como leídas» y enlace a la Card original cuando se dispone de contexto.
- **Invitaciones respondidas:** pequeño historial con estado aceptada/rechazada.

La actividad aparece ordenada de más reciente a más antigua y se limita a 60 registros para evitar cargar todo el historial. No se alteran los estados de lectura al abrir la bandeja ni el antiguo panel de campana: el usuario decide qué leer y cuándo marcarlo.

## Datos y API

La migración `2026_10_15_160000_add_card_context_to_app_notifications.php` añade dos campos a `app_notifications`:
- `card_id` nullable: navegación directa en los avisos relacionados con Cards.
- `kind` (por defecto `general`): `assignment`, `team`, `comment`, `invitation` o `general`.

No se borran los avisos existentes: quedan sin referencia a Card y se pueden marcar como leídos. El servicio `Notifier` continúa respetando `notify_in_app` y `notify_email`.

Endpoints autenticados:
- `GET /api/notifications`: últimas 60 notificaciones visibles del usuario, con fecha, estado de lectura y contexto de Card si corresponde.
- `POST /api/notifications/{notification}/read`: marcar una notificación propia como leída.
- `POST /api/notifications/read`: marcar como leídas todas las propias.
- `GET /api/my/invitations` y `POST /api/my/invitations/{id}/respond`: sin cambios.

## Permisos

La API no permite acceder a notificaciones de otro usuario. Los avisos enlazados a Cards solo se devuelven si el destinatario **sigue siendo miembro del Workspace y puede consultar el proyecto y la Card**. Las Cards archivadas no se ofrecen desde la bandeja. Los comentarios internos no generan correo ni notificación dirigida a clientes externos.

## Para completar después de la V1

Mensajería directa, web sockets, avisos push, menciones, enlaces a comentarios concretos, paginación histórica avanzada, agrupaciones inteligentes y caducidad de avisos.

## Pruebas

```bash
cd backend
php artisan migrate
php artisan test --filter=NotificationsInboxTest
```

Se comprueba el acceso autenticado, propiedad de notificaciones, lectura individual y masiva, contexto de Card y revocación de permisos.
