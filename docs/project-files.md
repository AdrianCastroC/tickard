# Tickard — Archivos del proyecto (V1)

## Alcance

La pestaña **Archivos** ofrece una vista unificada, sin duplicar los adjuntos ya subidos a Cards.

- **Generales:** documentos cargados directamente en el proyecto.
- **Adjuntos de Cards:** archivos existentes, referenciados desde sus Cards originales.
- Búsqueda por nombre, descripción, tablero y Card; filtros por origen, tipo y tablero.
- Lista y cuadrícula; vista previa autenticada de PDF, imágenes y texto; descarga del resto.
- Selección múltiple desde la tabla o la cuadrícula; descargar uno conserva el archivo original y descargar varios genera un único ZIP con nombres desambiguados.
- Un solo panel de filtros, siguiendo el patrón del Calendario/Kanban.
- No hay carpetas, versiones, vídeos, audio ni archivos comprimidos en V1.

## Formatos y almacenamiento

Solo JPG/JPEG, PNG, WebP, PDF, DOCX, XLSX y TXT, con **10 MiB máximo por archivo** (tanto generales como nuevos adjuntos de Cards). Se verifica tipo y estructura en el backend.

El uso se agrega **por Workspace**, sumando archivos generales de sus proyectos y adjuntos de todas las Cards. La vista enseña el total del Workspace, no una cuota independiente por proyecto.

La cuota depende del **plan del propietario** del Workspace:

| Plan | Cuota por Workspace | Límite agregado para los Workspaces del mismo propietario |
|---|---:|---:|
| Free | 200 MB | Un Workspace propio |
| Base | 2 GB | Hasta 5 Workspaces propios (10 GB como máximo si los usa todos) |
| Pro | **20 GB divididos equitativamente** entre sus Workspaces propios | **20 GB totales** para la cuenta |
| Business | Configurable | Según contrato |

Los tamaños de almacenamiento se calculan usando MB/GiB binarios (200 × 1024² bytes, 2 × 1024³ bytes y 20 × 1024³ bytes). Los Workspaces de terceros en los que participas cuentan para la cuota del **propietario**, no para la tuya.

Pro puede crear Workspaces ilimitados, pero sus **20 GB totales se reparten por defecto a partes iguales entre los Workspaces que realmente posea** (no según el máximo de su plan): 1 Workspace → 20 GB; 2 → 10 GB cada uno; 4 → 5 GB; 10 → 2 GB; 20 → 1 GB. El reparto se recalcula al crear o eliminar Workspaces, sin mover ni borrar archivos existentes. Si una redistribución deja un Workspace por encima de su cuota, conservará los archivos pero no podrá realizar nuevas subidas hasta disponer de espacio. La división usa bytes enteros, descartando los restos inferiores a 1 byte. En el futuro podrán comprarse ampliaciones y distribuir manualmente o reservar capacidad entre los Workspaces; **esa funcionalidad no se implementa todavía**.

El backend valida las cuotas en una transacción, bloqueando al propietario durante la comprobación para evitar que dos subidas simultáneas en distintos Workspaces superen el total. El footer de Archivos muestra el porcentaje real utilizado por el Workspace y, en Pro, también el consumo de toda la cuenta. Si se reduce un plan o ya hay archivos por encima de la nueva cuota, estos se conservan y se impiden nuevas subidas hasta liberar capacidad.

## Permisos

- Solo miembros autorizados por `ProjectAccess` pueden listar o descargar.
- Los adjuntos siguen la visibilidad de la Card: un cliente nunca descarga los de Cards internas ni archivadas.
- Responsable (incluido admin según la política actual) puede borrar todos los archivos del proyecto.
- Editor puede subir y eliminar únicamente los archivos que haya subido.
- Lector/cliente no puede subir ni eliminar.
- Eliminar un adjunto desde la biblioteca borra el mismo archivo de la Card original.

Las descargas se sirven por rutas autenticadas y los archivos se guardan en el disco privado `local`. No se exponen URLs directas de almacenamiento público.

## Descarga múltiple

- `POST /api/projects/{project}/files/download`, autenticado con Sanctum.
- Cuerpo JSON: `{"files":[{"origin":"general","id":1},{"origin":"card","id":2}]}`.
- Archivos limitados al proyecto y a la visibilidad de sus Cards; no se admiten identificadores externos ni nombres que puedan salir del ZIP.
- El resultado es un solo ZIP temporal, que se borra tras enviarse. Archivos con nombre repetido se renombran dentro del ZIP.
- Máximo de **200 archivos y 512 MiB por ZIP** para evitar cargas excesivas; selección incompleta o inaccesible provoca error sin generar descarga parcial.
- **Requiere la extensión `zip` de PHP** (`ZipArchive`). Si no está disponible, el servidor devuelve un error explicativo; las descargas individuales siguen funcionando.

## Puesta en marcha

Tras actualizar el repositorio:

```bash
cd backend
php artisan migrate
```

La primera migración crea `project_files` y la segunda mueve los adjuntos antiguos de `storage/app/public/card-attachments` a `storage/app/private/card-attachments`, conservando sus identificadores y asociaciones. **Comprobar la migración antes de dar el despliegue por terminado.** Mantener una copia de seguridad del almacenamiento y la BD antes de ejecutarla en producción.

Los archivos se limpian del disco al borrar su archivo individual, Card, tablero, columna o proyecto. No se migran ni alteran los avatares públicos.
