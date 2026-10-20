# Tickard — Preparación de despliegue del MVP

Esta guía es una **lista de validación**; no acredita que exista un entorno de producción listo.
Conserva las credenciales reales fuera de Git.

## Requisitos

- Backend PHP 8.4+ con extensiones requeridas por Composer y Laravel.
- Base de datos MySQL, servidor web HTTPS, acceso persistente a almacenamiento privado y público.
- Node y npm para compilar el frontend; configurar la URL de la API según el entorno.
- Servicio de correo SMTP real para invitaciones y verificaciones.

## Variables críticas

Configurar en el servidor, nunca versionar el `.env` real:

- `APP_ENV=production`; `APP_DEBUG=false`; `APP_URL=https://...`.
- `APP_KEY` único y persistente entre despliegues.
- `FRONTEND_URL=https://...` para los enlaces de invitación.
- Credenciales individuales `DB_*`, `MAIL_*`, `MAIL_FROM_*`.
- `SESSION_SECURE_COOKIE=true`, política de cookies y CORS adaptadas a los dominios.
- Ruta persistente para `storage/app/private` y `storage/app/public`; permisos mínimos.

**No copiar** los secretos de ejemplo de `backend/.env.example` a producción.

## Secuencia de despliegue

1. Respaldar BD y archivos, y comprobar que se pueden restaurar.
2. Publicar backend, ejecutar `composer install --no-dev --optimize-autoloader`.
3. Configurar `.env`, comprobar `php artisan about`, ejecutar `php artisan migrate --force`.
4. Configurar enlace de imágenes públicas con `php artisan storage:link`.
5. Compilar frontend con `npm ci && npm run build` e instalar el directorio `dist` en el servidor.
6. Asegurar fallback de SPA hacia `index.html` para rutas de invitación y acceso.
7. Comprobar HTTPS, cabeceras, límites de tamaño de subida (PHP y servidor), SMTP y permisos.
8. Ejecutar pruebas de humo con usuario real **sin usar datos de producción**.
9. Documentar rollback por versión de código y copia de seguridad; no revertir migraciones destructivas a ciegas.

## Prueba de humo previa a publicar

- Registrar, iniciar y cerrar sesión. Verificar cambio de contraseña/correo mediante correo real.
- Crear y seleccionar Workspaces, proyectos y tableros; crear una Card y moverla.
- Subir/descargar un archivo, alcanzar el límite de cuota y comprobar el error esperado.
- Crear una dependencia, verificar que aparece en Gantt y en el detalle de la Card.
- Invitar un usuario, aceptar la invitación y verificar los permisos de acceso/denegación.
- Validar vistas tabla, Kanban, Gantt y calendario en escritorio y móvil.
- Eliminar una entidad de prueba y verificar sus archivos asociados y el aislamiento entre Workspaces.

## Criterio de salida

No declarar el MVP publicado hasta que CI pase, se documenten los resultados de la
prueba de humo y exista un procedimiento probado de backup/rollback.

## Registro y recuperación de cuentas sin verificar

- `POST /api/register` envía un código de seis cifras por correo y responde
  **202**, con un identificador temporal de desafío; no crea una sesión ni entrega token.
- `POST /api/registration/verify` requiere el desafío guardado en el navegador
  y el código recibido. Solo entonces verifica la identidad, crea el Workspace
  inicial y emite un token Sanctum. Los desafíos expiran a los 15 minutos y
  admiten como máximo cinco intentos.
- Las cuentas antiguas con `email_verified_at=null` no pueden usar sesiones
  previas ni aceptar invitaciones. Su titular debe repetir el alta con **el mismo
  correo** y una contraseña nueva; al verificarlo se conserva su cuenta y se
  revocan sus tokens anteriores. No pedir códigos de terceros ni reutilizar
  contraseñas de la demostración.
- Configurar SMTP saliente real **antes de abrir el registro** y comprobar la
  recepción del código (no usar `MAIL_MAILER=log` en entornos compartidos).
- La migración `pending_registrations` debe ejecutarse antes de desplegar la
  nueva API/frontend, preferiblemente en una ventana coordinada.
- Validar casos manuales: código erróneo/caducado, recarga del navegador antes
  de verificar (volver a iniciar el registro), reclamación de cuenta antigua,
  rechazo de invitación por correo sin verificar y login verificado.
