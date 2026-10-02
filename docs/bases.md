# Bases del gestor de tareas

Documento de referencia del producto, antes de programar. Los nombres de personas, clientes y tareas que aparecen en los mockups son de ejemplo.

## Producto

La aplicación se llama tickard. Es un gestor de tareas para una empresa informática. El trabajo se organiza en proyectos y cada proyecto tiene uno o varios tableros. El tablero es la pantalla principal: columnas y tarjetas que se arrastran con el ratón. Quien tenga ese tablero abierto ve el cambio al momento.

La primera vista es un tablero Kanban. Lista, diagrama de Gantt y otras vistas posteriores muestran las mismas tarjetas; no son otro conjunto de tareas.

## Personas y permisos

Se entra con correo y contraseña.

Hay una ficha por empresa cliente y, dentro, sus personas. Un proyecto pertenece a un cliente y el responsable elige qué personas de esa ficha entran.

| Papel | Alcance | Puede |
| --- | --- | --- |
| Administrador | Toda la empresa | Usuarios, fichas de cliente y todos los proyectos |
| Responsable | Cada proyecto | Tableros, columnas, miembros, visibilidad del cliente y tarjetas |
| Editor | Cada proyecto | Crear, editar y mover tarjetas, y comentar |
| Lector | Cada proyecto | Ver y comentar. No crea ni mueve tarjetas |
| Cliente | Proyectos a los que está invitado | Ver lo que el proyecto permita y comentar. No crea ni mueve tarjetas |

El acceso de una persona interna se configura por proyecto: editor en uno, lectora en otro y sin acceso en un tercero.

El equipo, lectores incluidos, puede marcar cada comentario como interno o visible para el cliente. El cliente solo escribe comentarios visibles.

Las personas asignadas a una tarjeta son del equipo del proyecto. Una tarjeta puede tener varias.

Un departamento y un equipo no son lo mismo. El departamento es la estructura de la empresa y agrupa personas internas. El equipo es un grupo de trabajo, y se puede crear aparte. El administrador crea los dos. Una tarjeta se asigna a personas, a equipos, o a los dos. Quien pertenece a un equipo asignado ve esa tarjeta en Mis tareas. Las empresas cliente también se crean aparte: un proyecto pertenece a una de ellas.

## Vistas

Cada tablero abierto tiene un selector de vista. En la primera versión solo existe Kanban. Lista, tabla, Gantt y las que se añadan después reutilizan las tarjetas, los permisos y los filtros.

Las columnas pertenecen solo al Kanban. Un tablero nuevo nace con estas, y después se pueden renombrar, reordenar, añadir y quitar:

1. Backlog
2. Por hacer
3. En progreso
4. En revisión
5. Completado

Las tarjetas también se reordenan dentro de una columna. Mover una tarjeta se refleja al momento para quien tenga el tablero abierto.

Quien puede crear tarjetas ve «Añadir tarjeta» al final de cada columna. El formulario se abre encima del tablero y la tarjeta nace en esa columna.

## Tarjeta

### Primera versión

- Título
- Descripción
- Varias personas asignadas, y equipos de la empresa
- Fecha límite. El Gantt, cuando exista, usará también una fecha de inicio
- Prioridad: Baja, Media, Alta, Urgente
- Etiquetas del proyecto
- Comentarios, cada uno interno o visible para el cliente
- Historial breve: creada, movida, asignada y comentada

Al crearla queda **interna**. El cliente no la ve hasta que alguien del equipo la marque como visible.

### Versión siguiente

- Adjuntos
- Checklist
- Estimación
- Tiempo, a mano o con un temporizador

El checklist cubre el desglose de la tarea. No habrá subtareas como tarjetas aparte.

## Qué ve el cliente

El título se muestra siempre. En cada proyecto se activa o se desactiva el resto:

- Descripción
- Asignación: personas y equipos, con el mismo interruptor
- Fecha límite
- Prioridad
- Etiquetas
- Comentarios
- Adjuntos, checklist, estimación y tiempo, cuando existan

Un proyecto nuevo deja visibles descripción, fecha, etiquetas y comentarios. Deja ocultos asignado, prioridad y los campos de la versión siguiente. El responsable puede cambiarlo.

Una tarjeta interna no aparece en ningún tablero del proyecto para el cliente. Al marcarla como visible, entra en los tableros de ese proyecto con los campos que el proyecto tenga activos.

## Avisos

- Dentro de la aplicación: al asignar una tarjeta y al comentar.
- Por correo: al asignar y cuando comenta un cliente.

Cada persona puede desactivar los avisos de la aplicación, el correo, o los dos.

## Distribución de la pantalla

La aplicación se divide en dos zonas.

**Lateral izquierdo.** Abre con la marca. Inicio y Mis tareas llevan al módulo de tableros. Personal, solo para el administrador, agrupa departamentos, equipos y clientes. Debajo, Proyectos: los que la persona puede abrir. El administrador ve todos. «Nuevo proyecto» es una acción de esa lista. Los miembros y la visibilidad del cliente se gestionan dentro del proyecto.

**Zona principal.** Arriba, la búsqueda, los avisos y la persona. El proyecto activo tiene el título, el botón Nueva tarea y, debajo, el icono de filtros. Los filtros no están siempre visibles. Los proyectos abiertos van en pestañas: abrir uno lo añade, y cerrar la pestaña no borra el proyecto ni el tablero. La vista de esta fase es Tablero.

Debajo de las columnas, el tablero resume cada una con el número de tarjetas y el porcentaje que suponen sobre el total del tablero.

Si no hay ningún proyecto accesible, la zona principal muestra un estado vacío:

- Quien puede crear proyectos: iniciar un proyecto.
- Quien no puede: esperar a que le asignen uno.

## Pantallas de referencia

1. **Tablero del equipo.** Abierto en una pestaña, con filtros encima. Cinco columnas. Cada tarjeta muestra título, etiquetas, prioridad, fecha y asignados. Las ocultas al cliente llevan la marca Interna.
2. **Detalle de la tarjeta.** Se abre al lado del tablero. Título, paso de interna a visible, descripción, asignados, fecha, prioridad, etiquetas y comentarios con su visibilidad.
3. **Tablero del cliente.** Misma estructura, sin tarjetas internas, sin los campos apagados en el proyecto y sin la administración del lateral. El cliente comenta y no crea ni mueve tarjetas.
4. **Proyecto.** Personas y su papel, e interruptores de lo que el cliente puede ver.
5. **Sin proyectos.** Ilustración y la acción que corresponda al papel: iniciar un proyecto o esperar asignación.

## Paleta

Sale del gradiente [Iridescent](https://feralui.dev/gradients?g=2.Hc0xC4JAGIfxrxJ_13c4o6N6t1O5CguhpSEawiyOxBM9kBC31tY-R5vfKPwYYdtveOBpcQO3qJ0ta_ARnp7qSC9B8NRCiygcJadhEIhR_myupMaJ4B5lBobeJgcQ7mAM7-fw6r-fHoQKjLWKY7VKkv0GhLHdmcJNTJqBcM1t8_-m5zwDS0G4mNrZyhlbgKUk1I2pcrAvuq77AQ) de Feral, cuatro verdes japoneses en este orden:

| Nombre | Hex | Uso |
| --- | --- | --- |
| Willow mist | `#F2FDF9` | Fondo más claro, tarjetas en claro |
| Young willow | `#A8F0DC` | Selección suave, halos |
| Clear bamboo | `#52CBB0` | Señal activa, foco, botón en oscuro |
| Forest tea | `#147A5F` | Texto de acento, botón principal en claro, tinta verde |

El gradiente completo se reserva al acceso y al estado vacío. El tablero de trabajo usa estos tonos en superficies planas para que las tarjetas se lean. Hay tema claro y tema oscuro.

### Superficie y texto

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| Canvas | `#e7f7f2` | `#0c2420` | Fondo del tablero |
| Superficie | `#f7fefb` | `#14312b` | Tarjetas y paneles |
| Lateral | `#d7f3ea` | `#102824` | Listado de proyectos |
| Tinta | `#12312b` | `#f2fdf9` | Texto principal |
| Secundario | `#3d6b60` | `#a8d9cc` | Fechas, metadatos, secciones |
| Línea | `#c5e8de` | `#1e463e` | Bordes |

### Acento

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| Acento | `#147A5F` | `#a8f0dc` | Proyecto activo, pestaña abierta, enlaces |
| Botón | `#147A5F` | `#52cbb0` | Fondo del botón principal |
| Texto del botón | `#f2fdf9` | `#0c2420` | Texto sobre el botón |
| Selección | `#a8f0dc` | `#1a4a40` | Fila seleccionada |

### Estado de la tarea

Alta y urgente quedan fuera del verde, para que no se confundan con una tarjeta seleccionada.

| Estado | Claro | Oscuro |
| --- | --- | --- |
| Baja | Fondo `#e7f4f0`, texto `#3d6258` | Fondo `#1a3330`, texto `#cfe7e0` |
| Media | Fondo `#c8f3e6`, texto `#0f5c4c` | Fondo `#145246`, texto `#d7f3ea` |
| Alta | Fondo `#f8ead3`, texto `#6a4b12` | Fondo `#3a2e18`, texto `#f3ddb0` |
| Urgente | Fondo `#f8e4e4`, texto `#8a2b2b` | Fondo `#3a2222`, texto `#f3c7c7` |
| Interna | Fondo `#efe8df`, texto `#5c4e3a` | Fondo `#2c2822`, texto `#e6dccf` |

### Etiquetas

Seis tonos fijos, en pastilla: bosque, bambú, niebla, tinta, ciruela y arena. Bosque y bambú salen de la referencia; el resto distingue etiquetas que coincidirían si todo fuera verde.

| Tono | Claro | Oscuro |
| --- | --- | --- |
| Bosque | Fondo `#d7f3ea`, texto `#147a5f` | Fondo `#1a4a40`, texto `#a8f0dc` |
| Bambú | Fondo `#e7faf4`, texto `#0f6e62` | Fondo `#143832`, texto `#c8f6ea` |
| Niebla | Fondo `#e7f4f0`, texto `#3d6258` | Fondo `#1a3330`, texto `#cfe7e0` |
| Tinta | Fondo `#e7f4f0`, texto `#12312b` | Fondo `#102824`, texto `#f2fdf9` |
| Ciruela | Fondo `#f3e8ee`, texto `#6e3a52` | Fondo `#32242c`, texto `#f0d5e2` |
| Arena | Fondo `#f8ead3`, texto `#6a4b12` | Fondo `#3a2e18`, texto `#f3ddb0` |

## Construcción

### Fase 1

Acceso, clientes, proyectos, permisos por proyecto, tableros, arrastre en tiempo real, tarjeta básica, visibilidad del cliente y avisos.

### Fase 2

Adjuntos, checklist, estimación y tiempo, con los mismos interruptores de visibilidad.

### Vistas posteriores

Lista, tabla y diagrama de Gantt sobre las mismas tarjetas. El selector de vista ya queda previsto en la primera versión, con Kanban como única opción activa. Lista prioriza lectura rápida; tabla prioriza comparar y editar campos en columnas.

## Arranque

- Solo el administrador crea proyectos. El responsable gestiona los que ya existen.
- El primer usuario de la instalación es administrador.
- Un proyecto nuevo pide la ficha de cliente y nace con un tablero llamado General y las cinco columnas de partida.
- Las personas entran por invitación: reciben un correo y eligen su contraseña desde el enlace.
- El tema claro es el de inicio. La persona puede pasar al oscuro.
- Una tarjeta se archiva; no se borra. Una columna se puede quitar cuando no tiene tarjetas.
- El correo de un comentario de cliente llega a los asignados y al responsable del proyecto.

## Técnica

- API en Laravel, con Sanctum para la sesión de la interfaz.
- Interfaz en React y Vite, en español.
- Tiempo real con Laravel Reverb.
- Base de datos MySQL.
- Dos partes en el repositorio: `backend` y `frontend`.
- En local, los correos se guardan en el registro hasta configurar un servidor de correo.
