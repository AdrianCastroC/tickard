# Tickard — Personal del proyecto (V1)

La pestaña **Personal** es distinta de **Personal** en el menú lateral del Workspace.

## Ámbitos y permisos

- Personal del Workspace: crear y mantener departamentos y equipos, definir sus miembros.
- Personal del proyecto: consultar **miembros de ese proyecto**, sus asignaciones y carga de trabajo; vincular equipos al proyecto.
- Administrador global, **propietario del Workspace** y **responsable**: ver y gestionar membresías, roles, equipos e invitaciones. El owner obtiene permiso efectivo de responsable sin necesitar membresía en cada proyecto.
- Editor y lector: consultar personal, progreso y asignaciones del proyecto, sin operaciones de gestión.
- Cliente: ver **solo su propia ficha** y sus Cards asignadas que no sean internas. No recibe el directorio interno, correos del resto, otros miembros, equipos o departamentos.

Los permisos se validan en el backend con `ProjectAccess`, no solo ocultando controles del frontend.

## Resumen y métricas

- La vista usa directamente los estados reales (`backlog`, `pending`, `in_progress`, `review`, `done`) de las columnas y las asignaciones de `card_user`.
- Solo cuenta Cards no archivadas. Las atrasadas tienen vencimiento pasado, no están completadas y no están en backlog.
- Las Cards compartidas entre varios miembros **solo cuentan una vez** en los totales del proyecto; sí contribuyen a cada persona asignada.
- El progreso mostrado en V1 es **Cards completadas / Cards asignadas a esa persona**; no es el progreso de una checklist.
- Carga relativa: cantidad de Cards asignadas comparada con la persona que más tiene. **No** representa capacidad horaria, disponibilidad ni umbral de saturación (todavía no se han definido).
- Los perfiles utilizan fotos existentes del usuario, no iconos alternativos.
- La pestaña Actividad muestra fechas de modificación de las Cards asignadas, no pretende ser un registro de actividad por usuario.

## Equipos vinculados y acceso

`project_team` asocia equipos del Workspace a un proyecto (relación muchos-a-muchos). Los departamentos se consultan a partir de la pertenencia real de los miembros del proyecto al departamento, sin otorgar permisos automáticamente.

**Al asignar un equipo:**

1. Elegir equipo y rol (`responsable`, `editor` o `lector`).
2. Mostrar todos los integrantes y destacar cuántos todavía no pertenecen al proyecto.
3. Confirmar antes de añadirlos. Se envía la lista de IDs vista por el responsable; si cambia la composición, el servidor rechaza la operación y obliga a actualizar.
4. Incorporar solo a los que faltan, con el rol elegido. Los roles de miembros existentes **no se modifican**.
5. Desvincular el equipo solo quita la asociación; **no revoca** acceso a personas, porque pueden tener asignaciones o pertenecer individualmente al proyecto.

Las altas o bajas posteriores de una persona en la composición de un equipo del Workspace **no sincronizan silenciosamente** sus permisos de acceso a proyectos. La futura sincronización automática requeriría una política explícita de altas/bajas y permisos.

También se pueden añadir directamente usuarios internos que ya sean miembros del Workspace, cambiar roles, retirar usuarios (se limpian sus asignaciones a Cards del proyecto), e invitar mediante el mecanismo de invitaciones existente.

No se puede quitar ni degradar al último responsable registrado en el proyecto. Si el owner del Workspace figura entre los miembros del proyecto, se identifica como **Propietario del Workspace** y no puede cambiarse su rol ni retirarlo desde esa vista. El owner no se cuenta como trabajador ni se le atribuyen Cards automáticamente por ser propietario.

## API

Las siguientes rutas protegidas por Sanctum se añaden:

- `GET /api/projects/{project}/personnel`: datos y permisos para la vista.
- `POST /api/projects/{project}/personnel/members`: alta individual.
- `PATCH /api/projects/{project}/personnel/members/{user}`: cambio de rol.
- `DELETE /api/projects/{project}/personnel/members/{user}`: retirada.
- `POST /api/projects/{project}/personnel/teams`: vínculo y alta en bloque del equipo.
- `DELETE /api/projects/{project}/personnel/teams/{team}`: desvinculación sin bajas.

## Instalación y pruebas

La nueva relación requiere migrar la BD:

```bash
cd backend
php artisan migrate
php artisan test --filter=ProjectPersonnelTest
```

La interfaz reemplaza el placeholder de `ProjectLayout` en la pestaña `team`, manteniendo la etiqueta visible **Personal**.

## Estados de carga

La carga inicial de Personal reutiliza el componente `ProjectContentLoading` y el mismo spinner de 12 puntos verdes que Gantt y Calendario, con una vista previa esquemática del panel desenfocada. Archivos también comparte ese componente, pero presenta su propio esqueleto de listado, detalle y pie de almacenamiento. Los errores conservan un botón de reintento.
