# Tickard — Revisión de seguridad del MVP (2026-10-20)

## Alcance
Revisión estática de rutas Laravel, filtros de entrada, acceso por Workspace,
renderizado HTML de Cards, configuración de autenticación y dependencias.
Sin pentest contra servicios desplegados ni garantía de ausencia de fallos.

## Hallazgos iniciales y correcciones

- **Protección de acceso (corregido en este bloque):** login y registro no tenían
  limitación explícita de solicitudes. Se aplica throttling a ambos endpoints.
  Complementar en producción con protección por IP y monitorización de abusos.
- **XSS en descripciones HTML (endurecido en este bloque):** el filtrado anterior
  eliminaba eventos on* y algunos elementos, pero dejaba pasar otras etiquetas,
  atributos y esquemas. Ahora se permite solo el subconjunto de HTML del editor
  y enlaces seguros. Validar visualmente la compatibilidad del editor.
- **SQL injection (revisión preliminar):** hay consultas con ORM y expresiones
  SQL constantes (DB::raw); la búsqueda de usos de DB::raw/whereRaw no prueba
  ausencia de inyecciones. Revisar especialmente las interpolaciones y entradas
  controladas por usuario en controladores y ordenar/filtrar por columnas.
- **Autorización horizontal/IDOR:** existen comprobaciones en ProjectAccess y
  WorkspacePersonnelGuard. Debe ampliarse la matriz de pruebas cruzadas entre
  Workspaces para cada endpoint sensible.
- **Archivos:** ProjectFileStorage valida extensión/MIME y cuotas; siguen
  pendientes pruebas maliciosas de nombres, contenido y descargas ajenas.
- **Dependencias:** escanear npm y Composer contra advisories actualizados,
  revisar licencias y fijación de versiones. La inyección de dependencias de
  Laravel es un mecanismo válido; los riesgos a revisar son resolución dinámica
  de servicios, dependencias de terceros y supply chain.
- **Producción:** bloquear APP_DEBUG, usar HTTPS y SMTP correcto, habilitar
  backups, proteger tokens y configurar límites del servidor web.

## Casos de prueba de seguridad pendientes

1. SQLi/XSS a través de descripciones, búsquedas, nombres, comentarios y filtros.
2. Usuarios Owner/Admin/Miembro/Cliente intentando leer/editar entidades ajenas.
3. Subidas con MIME falso, extensiones dobles, HTML/SVG y path traversal.
4. Acceso a archivos privados de otros Workspaces y enlaces de invitación caducados.
5. Manipulación de cuota, permisos y parámetros numéricos; concurrencia al subir.
6. Validación de cookies/tokens, CORS, cabeceras HTTP y errores en el despliegue.

No dar la seguridad por aprobada solo porque CI o los analizadores de dependencias
estén verdes. Requiere pruebas en preproducción bajo autorización.

---

## Auditoría complementaria: autorización y aislamiento (20-10-2026)

**Metodología:** análisis de controladores/API, modelos de permisos y
fixtures de integración Laravel; comprobación de las correcciones mediante
GitHub Actions (suite completa, frontend build y lint, npm y Composer audit).
El resultado **no sustituye un pentest, un E2E en navegador o una revisión
de configuración del servidor real**. Las pruebas de CI utilizan el entorno
automatizado y no reproducen por sí solas todos los escenarios de producción.

### Hallazgos corregidos

| Referencia | Hallazgo | Corrección |
| --- | --- | --- |
| PR #62–#65 | Autorización horizontal, checklists, adjuntos y relaciones entre Cards | Comprobaciones de IDOR y regresión, descarga privada, auditoría de dependencias |
| PR #66–#67 | Token de larga duración y configuración HTTP | Sanctum expira a los 7 días por defecto; CORS explícito; cookies seguras en producción |
| PR #68 | Personal y calendario verificaban solo pertenencia | Comprobar permiso efectivo `project.view` |
| PR #69 | Invitaciones normales aceptables tras `expires_at` | Validar caducidad dentro de la transacción |
| PR #70–#71 | Invitaciones pendientes podían sobrevivir a la revocación del emisor | Revalidar autoridad del emisor en invitaciones internas y clientes |
| PR #72–#75 | Accesos de lectura en adjuntos, notificaciones, tableros y resúmenes | Comprobar `project.view`; limitar columnas y contenido visible para clientes |
| PR #74 | Borrado y reacción a respuestas de un hilo convertido en interno | Respetar privacidad del comentario raíz y autorización efectiva |
| PR #76 | Cuenta cliente podía usar un rol interno heredado | Rechazar roles internos para cuentas asociadas a empresas cliente |
| PR #77 | Inicio/Mis tareas/resumen Workspace filtraban por membresía, no permiso efectivo | Aplicar ámbito `project.view` a todas las consultas globales |
| PR #78 | Membresía `client` sin asociación válida podía parecer miembro interno | Reconocer el rol cliente aunque se pierda la empresa asociada |
| PR #79 | El administrador global podía acceder a proyectos de otros Workspaces | Exigir pertenencia al Workspace, también tras expulsión |
| PR #80 | Invitaciones pendientes antiguas y nuevos miembros tras desactivar el rol | Límite de 30 días y revalidación del rol en aceptación |

Estos casos corresponden a defectos del código que se corrigieron y para los
que se añadieron pruebas automatizadas. Consultar el estado exacto de cada PR
antes de asumir que una corrección está publicada.

### Decisión de permisos que debe mantenerse explícita

Actualmente, marcar un rol como `enabled=false` impide asignarlo **a nuevos
miembros o invitaciones**, pero no revoca automáticamente los permisos de
miembros ya asignados. Los tests existentes documentan ese comportamiento.
Si el producto debe permitir la revocación inmediata, se requiere una decisión
funcional y su correspondiente migración/control adicional; no cambiarla
silenciosamente durante el endurecimiento del MVP.

### Aspectos revisados que requieren aceptación adicional

- **Aislamiento entre tenants:** probar manualmente al menos dos Workspaces y
  usuarios Owner/Admin/Responsable/Editor/Lector/Cliente, incluido permiso
  personalizado sin lectura, expulsión e invitación pendiente.
- **Archivos:** existen verificaciones de extensión/MIME, estructura OOXML,
  cuotas y descargas privadas. Aún se requieren pruebas en el sistema de
  almacenamiento real y subidas concurrentes contra MySQL de producción.
- **XSS/Frontend:** el HTML enriquecido se sanea antes de representarse. Los
  tokens Bearer permanecen en `localStorage`; un XSS que escapase al saneado
  podría extraerlos. Priorizar CSP, revisar cualquier nuevo renderizado HTML y
  valorar una migración a cookies seguras con CSRF en una fase planificada.
- **Inyección SQL:** las búsquedas revisadas emplean parámetros o SQL estático;
  no se ha demostrado una SQLi con las inspecciones efectuadas. Mantener
  revisión de toda consulta dinámica en cambios futuros.
- **Supply chain:** CI ejecuta `npm audit --audit-level=high` y
  `composer audit --locked --no-interaction`; una ejecución correcta indica
  ausencia de advisories bloqueantes detectados por estas herramientas, no
  ausencia absoluta de riesgo.
- **Producción:** validar `APP_DEBUG=false`, HTTPS/HSTS, CORS exacto,
  `APP_KEY`, SMTP, límites de carga, ruta privada de archivos, backups y
  restauración, rotación de credenciales, monitoreo/rate limiting y permisos de
  BD. El archivo `.env.example` es únicamente para desarrollo.
- **Cobertura:** faltan pruebas de navegador E2E con cuentas y roles reales,
  test de concurrencia MySQL y pruebas de recuperación ante fallos de red o
  almacenamiento. La suite PHPUnit no reemplaza estos controles.

### Criterio de seguridad para publicar

La suite CI en verde habilita continuar a **preproducción**. No declarar
el MVP seguro para producción hasta confirmar la matriz de roles en un
entorno desplegado, configuración TLS/CORS/cookies, gestión de secretos,
subidas/descargas reales y restauración probada de copias de seguridad.
