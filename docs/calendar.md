# Calendario de proyecto — Tickard

## Concepto

El calendario es una vista del **proyecto**, que combina referencias de Cards
de sus tableros con eventos independientes. No altera las fechas del Gantt.

### Cards (planificación frente a actividad diaria)

- Backlog y Cards archivadas no se muestran.
- Se muestra un marcador en `start_date` («Inicio») y otro en `due_date` («Vencimiento»).
  Si coinciden, solo aparece un marcador.
- Una Card pendiente, en progreso o revisión, una vez alcanzada su fecha de inicio,
  aparece **solo en el día actual** si aún no está terminada. No se repite retrospectivamente
  en cada día que ha transcurrido.
- Después de `due_date`, ese marcador diario lleva el estado «Atrasada».
- Cuando la Card está completada, deja de aparecer diariamente y conserva
  un marcador «Completada» en su `completed_at`, si existe.
- Si `completed_at` coincide con otro marcador, se prioriza «Completada».
- La actualización diaria no modifica `start_date` ni `due_date`: las fechas
  originales siguen siendo las del Gantt, y sus dependencias no cambian.
- La representación compacta del tablero incluye `completed_at` cuando el
  usuario tiene permiso para ver fechas.

### Eventos: reuniones, citas y otros

- Son registros `calendar_events` independientes, asociados directamente
  a un proyecto, nunca a una Card ni a un tablero.
- Se pueden crear, consultar, editar y eliminar desde «Calendario → Nuevo evento».
- Tienen tipo (`meeting`, `appointment` u `other`), título, descripción y lugar opcionales,
  fecha inicial y final **inclusive**, indicador de todo el día y horas opcionales.
- Los eventos de varios días ocupan barras continuas en la vista mensual.
- No aparecen en el Gantt y no generan dependencias ni progreso.
- Las fechas y horas representan horas locales sin zona horaria asociada en esta V1;
  la integración de calendarios externos exigirá definir un modelo de zonas horarias.

### Permisos

- Responsables y editores: consultar y gestionar eventos.
- Lectores: consultar eventos, sin editarlos.
- Clientes: no ven eventos y el backend bloquea la API de eventos (403).
- Las Cards respetan siempre el filtrado de visibilidad existente en `CardPresenter`.

### API

- `GET /api/projects/{project}/calendar-events?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- `POST /api/projects/{project}/calendar-events`
- `PATCH /api/calendar-events/{calendarEvent}`
- `DELETE /api/calendar-events/{calendarEvent}`

El listado se limita a intervalos de hasta 63 días e incluye eventos cuyo rango
interseca la ventana solicitada.

## Despliegue

Ejecutar `php artisan migrate` en el directorio `backend` después de actualizar el código.

## Mejoras posteriores

Invitaciones a asistentes, avisos, eventos recurrentes, disponibilidad, zonas horarias
y conectores con Google Calendar/Outlook. Ninguna se implementa todavía.

## Visibilidad de tareas según el usuario

- **Administrador de Tickard** (`users.is_admin = true`) y **responsable del
  proyecto** (`role = responsable`): ven todas las Cards consultables de ese
  proyecto, incluidos los elementos sin asignación. Pueden filtrar por una o
  varias personas (coincidencia con cualquiera) y por Cards sin asignar.
  Ser responsable basta; no se necesita el indicador global `is_admin`.
- **Editor, lector o cliente sin rol de responsable**: en el Calendario reciben
  únicamente Cards asignadas expresamente a su usuario. Las Cards sin asignados
  no aparecen. El calendario sigue respetando las reglas de visibilidad del cliente.
- La API `GET /api/boards/{board}?calendar=1` limita las Cards mediante
  `whereHas('assignees')` antes de serializarlas. No se hace depender la
  seguridad del filtro del navegador; tampoco se incluyen previews de dependencias.
- El Gantt y Kanban conservan sus endpoints y comportamientos anteriores.
- Los eventos del proyecto mantienen su política de permisos independiente;
  no son Cards ni tienen asignados en esta versión.

## Filtro compacto de usuarios (calendario)

Los administradores globales y responsables disponen de un selector «Usuarios asignados» dentro
del panel «Filtros», con búsqueda de nombres, selección múltiple, fotos de
perfil reutilizadas de las Cards y accesos rápidos «Todos» y «Solo yo».
El selector permite incluir tareas sin asignar. No altera las citas y reuniones.
Las miniaturas de asignados se representan mediante el mismo componente
`Avatar` compartido con Kanban, respetando las fotografías cargadas.
