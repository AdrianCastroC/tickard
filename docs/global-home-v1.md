# Tickard V1 — Inicio global

## Propósito

El inicio muestra un resumen **personal** de todos los Workspaces a los que pertenece el usuario. No sustituye al dashboard administrativo del proyecto. Utiliza únicamente información visible para la sesión, sin inventar proyectos, fechas ni porcentajes.

El diseño sigue el concepto visual validado:
- Cabecera de bienvenida con nombre y fecha local.
- Cuatro indicadores con navegación: Cards asignadas, vencidas, reuniones de hoy y avisos sin leer.
- Reuniones de hoy de los calendarios accesibles (oculta la sección cuando no hay ninguna).
- Cards pendientes más urgentes, con vencimiento e identificación visual de las vencidas.
- Proyectos accesibles de todos los Workspaces, en fichas compactas con tableros y progreso.
- Última actividad y acceso a Bandeja de entrada. Invitaciones pendientes destacan cuando existen.

## Datos y acceso

El frontend obtiene en paralelo:
- `GET /api/my/tasks?today=YYYY-MM-DD&page=1` para indicadores, reuniones y Cards del usuario. La fecha corresponde al calendario local del navegador.
- `GET /api/my/home/projects` para los proyectos visibles y sus métricas (máximo 100 en esta V1).
- `GET /api/notifications` para actividad reciente.
- `GET /api/my/invitations` para invitaciones pendientes.

El endpoint nuevo devuelve `{ projects: [...], has_more: boolean }`, incluyendo `workspace_id`, `project_id`, rol efectivo, número de tableros, Cards visibles y Cards completadas. Se accede a él con Sanctum.

**El progreso** es `Cards en estado done / total de Cards no archivadas y visibles`, no progreso ficticio ni porcentaje fijo. Los clientes solo cuentan Cards públicas; la pertenencia a un Workspace no permite ver proyectos ajenos. El administrador global también requiere pertenecer al Workspace.

La consulta de proyectos y sus agregados no descarga tableros completos ni sus Cards. La consulta de Mis tareas usa paginación, así que el bloque de atención recoge las primeras Cards pendientes de la página inicial. Los avisos recientes mantienen su límite del módulo Bandeja.

## Navegación y UX

Los indicadores de tareas llevan a Mis tareas; «Vencidas» abre el filtro correspondiente. Los avisos llevan a Bandeja. Pulsar una Card abre su detalle real; una reunión abre el calendario del proyecto; una ficha de proyecto abre su vista general, cambiando previamente de Workspace si es necesario. No hay un botón de refresco permanente.

En escritorio, el contenido se contiene dentro del alto disponible y cada panel se desplaza internamente sin barra visible. Para pantallas estrechas, los paneles se apilan y la página puede desplazarse dentro de su contenedor principal.

La página se recarga de forma natural al entrar en Inicio. React no recibe automáticamente cambios de otros usuarios mientras esta vista permanece abierta: tiempo real y actualizaciones en segundo plano quedan fuera de V1.

## Pruebas

`php artisan test --filter=GlobalHomeTest`: autenticación, acceso multi-Workspace, privacidad por proyecto, rol de propietario, acceso cliente y conteo real de Cards.
