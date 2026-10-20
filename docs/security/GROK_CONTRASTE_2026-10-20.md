# Tickard — Contraste independiente de la auditoría de Grok

Fecha: 2026-10-20. Grok revisó `main` en `0664546e2f2d80caf0b0ec8c8eee0771c1621a0c`.
La comparación y correcciones de Tickard llegan hasta la fusión de la PR #84
(`82184714b378dd9bd4c91bb3cb6d1c8136e0cf6c`).

**Método:** revisión de implementaciones actuales por GitHub, cambios en ramas
separadas, tests de regresión y validación con CI. No es un pentest de un servidor
desplegado ni una certificación de ausencia de vulnerabilidades.

## Resultado por hallazgo

| ID Grok | Situación contrastada | Acción |
| --- | --- | --- |
| GROK-SEC-001 · Alta | **Corregido en PR #84.** Alta sin token, código de correo + nonce del solicitante; verifica antes de crear cuenta, Workspace o sesión. Cuenta antigua no verificada: nuevo desafío, verificación y revocación de tokens previos. | Desplegar migración y SMTP real. |
| GROK-SEC-002 · Alta | **Corregido previamente en PR #79.** `is_admin` no cruza Workspaces sin membresía. En PR #83 `DatabaseSeeder` y `UserSeeder` de demostración quedan restringidos a `local` y `testing`. | `is_admin` sigue siendo un atributo interno asignable en Eloquent para seeders/test; no se ha encontrado endpoint que permita asignarlo libremente. |
| GROK-SEC-003 · Alta | **Corregido en PR #81**, sumándose a las PR #69/#80. Expulsar a un usuario de proyecto revoca sus invitaciones pendientes de ese proyecto dentro de la transacción sincronizada con aceptación; las invitaciones ya caducan a 30 días. | Validar aceptación/baja simultáneas también en MySQL de preproducción. |
| GROK-SEC-004 · Media | **Corregido parcialmente (PR #82 y anteriores).** El listado de miembros ya exige `workspace.members`; Inicio, Mis tareas y resumen del Workspace utilizan permisos efectivos (PR #77). | El sistema diferencia deliberadamente **deshabilitar un rol para nuevas asignaciones** de **revocar roles ya asignados**. El segundo comportamiento requeriría decisión funcional explícita. |
| GROK-SEC-005 · Media | **Riesgo de diseño vigente, sin exploit demostrado.** El HTML del editor se sanea en navegador; las descripciones ahora se limitan a 12.000 caracteres. El token Bearer permanece en `localStorage`. | Test de XSS/E2E y CSP de servidor; evaluar migración coordinada a sesiones `HttpOnly` si se cambia el contrato de autenticación. |
| GROK-SEC-006 · Media | **Corregido en PR #83.** Registro y cambio de contraseña tienen regla equivalente de 10 caracteres con números, símbolos y mezcla de mayúsculas/minúsculas. Login limitado además por correo, no solo por IP. | Validar rate limiting compartido entre varias instancias en preproducción. |
| GROK-SEC-007 · Media | **Corregido en PR #83.** Límite de 12.000 caracteres de descripción en creación y edición de Cards, con tests. | Vigilar tamaño de peticiones en reverse proxy. |
| GROK-SEC-008 · Baja | **Parcial.** PR #83 hace verificación de hash de coste comparable y añade límite por correo en login. El registro de un email ya verificado continúa respondiendo que existe. | Enumeración de registro de baja gravedad: valorar respuestas neutras/recuperación cuando se implemente el flujo completo de recuperación de contraseña. |
| GROK-SEC-009 · Baja | **Corregido en PR #82.** Publicar un hilo interno para cliente exige además `cards.edit`; Lector conserva `cards.comment`. El frontend oculta la acción si falta permiso. | Considerar un permiso `cards.publish` diferenciado si el producto necesita granularidad adicional. |
| GROK-SEC-010 · Condicional | **Pendiente del servidor.** `.env.example` está preparado para desarrollo, no constituye configuración productiva. | Verificar `APP_DEBUG=false`, `APP_ENV=production`, SMTP/secretos y permisos de logs. |
| GROK-SEC-011 · Condicional | **Pendiente de infraestructura.** HSTS, CSP, proxies y `X-Frame-Options` requieren validar servidor real y dominios/CDN. | Probar cabeceras, HTTPS, cookies y detección de IP tras proxy. |
| GROK-SEC-012 · Baja | **Potencial; sin explotación demostrada.** Relaciones antiguas cruzadas podrían alterar navegación de backlog. La creación actual rechaza dependencias entre proyectos. | Validar datos heredados y añadir control de integridad si existieran relaciones inválidas. |
| GROK-SEC-013 · Baja | **Riesgo residual contextual.** PDF y texto pueden descargarse inline con `nosniff`, acceso autenticado y cache privada. | Evaluar CSP de previsualizaciones y política de descarga forzada según navegadores admitidos. |
| GROK-SEC-014 · Baja | **Auditorías presentes y CI verde.** `npm audit --audit-level=high` y `composer audit --locked`. Actions utiliza etiquetas de versión y no hashes de commit. | Seguir actualizando lockfiles; valorar fijación de acciones a SHA durante endurecimiento del pipeline. |

## Cambios derivados directamente del informe de Grok

- **PR #81:** revocación de invitaciones tras expulsión del proyecto.
- **PR #82:** lectura del personal según permisos efectivos y publicación de
  hilos restringida a usuarios con edición.
- **PR #83:** política de contraseña, limitación de fuerza bruta por cuenta,
  tamaño máximo de descripción y protección de cuentas de demostración.
- **PR #84:** verificación del correo antes de dar de alta, tokens o acceso,
  nuevas pantallas de confirmación, recuperación de cuentas antiguas y tests.

Los commits se mantienen separados dentro de cada PR para permitir rollback
selectivo cuando sea viable.

## Resultado de pruebas observado

Último workflow de la PR #84: **260 pruebas Laravel, 2031 aserciones**,
React/TypeScript build y lint aprobados, auditorías npm/Composer aprobadas.
No se ejecutaron pruebas de navegador E2E, pentest ni pruebas manuales en
entorno de producción.

## Condiciones pendientes para dar salida al MVP

1. Configurar correo SMTP real y desplegar migración `pending_registrations`
   antes de habilitar el registro público. Confirmar entrega de códigos
   y recuperación de cuentas anteriores sin verificar.
2. Prueba de matriz de roles con al menos dos Workspaces y distintos
   miembros/propietarios/clientes, incluyendo expulsión e invitación pendiente.
3. Auditar el despliegue: TLS, CORS, cookies, CSP, HSTS, proxies, secreto `APP_KEY`,
   usuarios mínimos de base de datos, registros, límites del servidor y backup.
4. Probar concurrencia de subida/aceptación con MySQL y restauración
   de respaldo, así como E2E de registro, Cards, Gantt, calendario y archivos.
5. Decidir a nivel de producto si deshabilitar un rol debe revocar a todos
   los miembros ya asignados. Actualmente **no** equivale a revocación masiva.

**Dictamen:** las vulnerabilidades altas reproducibles del snapshot de Grok
están corregidas en código, pero el cierre de preproducción y la publicación
siguen condicionados a validar la infraestructura y las pruebas manuales.
