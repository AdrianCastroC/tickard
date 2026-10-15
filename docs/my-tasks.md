# Tickard V1 — Mis tareas

## Alcance

`Mis tareas` es una vista personal **global**, independiente del Workspace seleccionado en la barra lateral. Presenta **Cards asignadas directamente al usuario** mediante `card_user` en todos los proyectos y Workspaces en los que conserva acceso. Se excluyen Cards archivadas. Las asignaciones a equipos y las asignaciones individuales de elementos de checklist quedan fuera de esta primera versión; no equivalen a una Card asignada al usuario.

La vista contiene:
- Resumen: total, vencidas, en progreso, completadas.
- Filtros por Workspace, proyecto, estado y prioridad, además de búsqueda por título, proyecto o tablero.
- Filas con título, Workspace/proyecto/tablero, estado, prioridad y vencimiento.
- Paginación de 30 Cards y carga independiente del Kanban/Gantt.
- Apertura directa de la Card original, incluso al cambiar de Workspace.
- Scroll interno para mantener los filtros y la navegación visibles.

La fecha vencida exige `due_date` anterior a hoy y estado distinto de `done` y `backlog`. Las Cards sin fecha también aparecen, pero después de las que sí están planificadas. Los estados se derivan de `columns.workflow_state`, no de etiquetas de columnas.

## Seguridad

`GET /api/my/tasks` está autenticado con Sanctum y comprueba en la consulta:
- Asignación real al usuario solicitado (`card_user.user_id`).
- Membresía vigente del Workspace.
- Pertenencia vigente al proyecto, salvo propietario del Workspace (o administración global, conforme al `ProjectAccess` existente).
- Para el rol Cliente, exclusión de Cards internas.
- Exclusión de Cards archivadas.

Los filtros, resumen y opciones de proyecto se calculan sobre el mismo conjunto autorizado, por lo que no revelan proyectos ni Cards de otros usuarios. La búsqueda nunca amplía esos permisos.

## API

`GET /api/my/tasks`

Parámetros opcionales: `workspace_id`, `project_id`, `state` (all/backlog/pending/in_progress/review/done/overdue), `priority` (all/baja/media/alta/urgente), `q` (máximo 120 caracteres), `page`.

Devuelve:
- `tasks`: 30 Cards como máximo con IDs de navegación y datos de presentación.
- `summary`: contadores para Workspace/proyecto seleccionados, sin restringir por estado, prioridad o búsqueda.
- `scopes`: Workspaces/proyectos donde el usuario tiene Cards asignadas y visibles.
- `pagination`: `page`, `last_page`, `total` y `per_page`.

Pruebas: `php artisan test --filter=MyTasksTest`.

## Pendiente para futuras versiones

Checklist personales, trabajo asignado por equipo, ordenación manual, favoritos, edición masiva y preferencias por usuario. Esta primera versión es deliberadamente de solo lectura; para modificar la Card se abre su vista original.
