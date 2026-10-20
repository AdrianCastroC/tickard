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
