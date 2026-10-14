# Tickard — Archivos del proyecto (V1)

## Alcance

La pestaña **Archivos** ofrece una vista unificada, sin duplicar los adjuntos ya subidos a Cards.

- **Generales:** documentos cargados directamente en el proyecto.
- **Adjuntos de Cards:** archivos existentes, referenciados desde sus Cards originales.
- Búsqueda por nombre, descripción, tablero y Card; filtros por origen, tipo y tablero.
- Lista y cuadrícula; vista previa autenticada de PDF, imágenes y texto; descarga del resto.
- Un solo panel de filtros, siguiendo el patrón del Calendario/Kanban.
- No hay carpetas, versiones, vídeos, audio ni archivos comprimidos en V1.

## Formatos y almacenamiento

Solo JPG/JPEG, PNG, WebP, PDF, DOCX, XLSX y TXT, con **10 MiB máximo por archivo** (tanto generales como nuevos adjuntos de Cards). Se verifica tipo y estructura en el backend.

El uso se agrega **por Workspace**, sumando archivos generales de sus proyectos y adjuntos de todas las Cards. La vista enseña el total del Workspace, no una cuota independiente por proyecto.

El backend respeta `WorkspaceLimits::maxStorageMb()`: cuando el plan/configuración proporcione un límite se valida atómicamente y se muestra el porcentaje. Por ahora Free/Base/Pro no tienen cuotas numéricas definidas en `WorkspaceLimits`; **no se inventa una cifra ni un porcentaje**.

## Permisos

- Solo miembros autorizados por `ProjectAccess` pueden listar o descargar.
- Los adjuntos siguen la visibilidad de la Card: un cliente nunca descarga los de Cards internas ni archivadas.
- Responsable (incluido admin según la política actual) puede borrar todos los archivos del proyecto.
- Editor puede subir y eliminar únicamente los archivos que haya subido.
- Lector/cliente no puede subir ni eliminar.
- Eliminar un adjunto desde la biblioteca borra el mismo archivo de la Card original.

Las descargas se sirven por rutas autenticadas y los archivos se guardan en el disco privado `local`. No se exponen URLs directas de almacenamiento público.

## Puesta en marcha

Tras actualizar el repositorio:

```bash
cd backend
php artisan migrate
```

La primera migración crea `project_files` y la segunda mueve los adjuntos antiguos de `storage/app/public/card-attachments` a `storage/app/private/card-attachments`, conservando sus identificadores y asociaciones. **Comprobar la migración antes de dar el despliegue por terminado.** Mantener una copia de seguridad del almacenamiento y la BD antes de ejecutarla en producción.

Los archivos se limpian del disco al borrar su archivo individual, Card, tablero, columna o proyecto. No se migran ni alteran los avatares públicos.
