# Tickard — Auditoría y cierre del MVP

Fecha de revisión: 2026-10-20. Fuente: estructura y código de `main`, rutas API,
componentes de React, tests y configuración de CI. **Una ruta o componente no demuestra
por sí mismo que toda la experiencia funcione**; la aceptación exige probarla.

## Alcance imprescindible del MVP

| Flujo | Evidencia en el repositorio | Validación de aceptación |
| --- | --- | --- |
| Registro, inicio/cierre de sesión, recuperación de identidad | AuthController, AccountSecurityController, AccountModal | Crear usuario nuevo, iniciar/cerrar sesión, cambiar correo/contraseña con envío real |
| Workspaces y planes | WorkspacesController, WorkspaceLimits | Crear, cambiar, editar y eliminar Workspace con permisos y límites correctos |
| Proyectos, tableros y columnas | ProjectsController, BoardSurface, BoardConfigPanel | Crear, editar, eliminar y navegar sin perder estado |
| Cards, módulos y comentarios | CardsController, CardDetailsController, CardDetail | Crear, editar, mover y borrar; probar checklist, archivos y comentarios |
| Kanban, tabla, lista y Gantt | Kanban, TableView, ListView, GanttView | Cambiar vistas, ordenar, filtrar y navegar; comprobar scroll y rendimiento con datos grandes |
| Calendario y eventos | CalendarEventsController, ProjectCalendar | Visibilidad según rol y asignación, eventos de varios días |
| Dependencias e hitos | CardDependenciesController, CardDependencyList, MilestoneDependencyList | Tipos FS/SS/FF/SF, ciclos, fechas y navegación entre Cards |
| Personal, equipos, departamentos y clientes | WorkspaceMembersController, WorkspaceTeamsController, WorkspaceDepartmentsController, WorkspaceClientsController | Comprobar roles, pertenencia y alcance por Workspace |
| Invitaciones y permisos | WorkspaceInvitationsController, WorkspaceRolesController, ProjectAccess | Aceptación, revocación, invitación externa y denegación de accesos indebidos |
| Archivos y cuotas | ProjectFilesController, AccountStorageController, ProjectFileStorage | Cuota Cuenta → Workspace → Proyecto, edición slider/número, límites de subida y descarga |
| Inicio, notificaciones y mis tareas | GlobalHome, Notifications, MyTasks | Enlaces correctos y actualización de estado tras cambios |

## Bloqueos del cierre que deben resolverse/verificarse antes de publicar

1. **Cobertura de CI**: el workflow ejecutaba solo una lista filtrada de tests Laravel.
   Cambiarlo a la suite completa y mantener React build + lint; corregir regresiones detectadas.
2. **Configuración productiva**: `backend/.env.example` está orientado a desarrollo
   (`APP_ENV=local`, `APP_DEBUG=true`, `MAIL_MAILER=log`, credenciales MySQL de ejemplo).
   Preparar guía de variables seguras y validar envío SMTP real.
3. **Pruebas end-to-end manuales**: no se encontró una suite E2E de navegador en el árbol.
   Ejecutar una matriz de roles (Owner, Admin, Miembro, Cliente) con las operaciones críticas.
4. **Persistencia y despliegue**: probar migración sobre BD con datos, archivos privados,
   enlace público de imágenes, `APP_URL`, `FRONTEND_URL`, HTTPS y copia/restauración de BD/archivos.
5. **Experiencia de errores y móvil**: recorrer modales, listas, tableros grandes, formularios,
   estados vacíos, carga y navegación desde móvil. Un build satisfactorio no verifica estas interacciones.

## Hechos y límites de la revisión

- El repositorio contiene tests de dependencias, Card, archivos, cuotas, personas y calendario.
  El antiguo filtro CI no incluía todas esas clases.
- `backend/README.md` y `frontend/README.md` eran textos genéricos de Laravel/Vite;
  no servían para desplegar Tickard.
- No hay pruebas de uso en navegador ni despliegue en producción realizados como parte
  de esta auditoría; las comprobaciones manuales anteriores están **pendientes**, no aprobadas.

## Fuera del MVP

Seguridad avanzada de Workspace (2FA obligatoria, controles de IP y sesiones de otros
usuarios), auditoría administrativa exhaustiva, integraciones, facturación automática,
automatizaciones y flujos multiempresa de soporte. Mantenerlos fuera hasta cerrar el MVP.

## Orden recomendado

1. Suite completa de CI en verde.
2. Guía reproducible de puesta en producción y respaldo.
3. Prueba de humo guiada en entorno de preproducción, con Owner/Admin/Miembro/Cliente.
4. Corregir solo defectos reproducidos, con un commit por corrección y pruebas.
5. Etiquetar la primera versión MVP cuando se validen los cuatro pasos anteriores.
