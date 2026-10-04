# Tickard — Bases del producto

## 1. Qué es Tickard

Tickard es una aplicación de gestión de trabajo, proyectos y tareas orientada tanto a usuarios individuales como a equipos y empresas.

La aplicación se organiza alrededor de espacios de trabajo (Workspaces), dentro de los cuales se encuentran los proyectos, tableros y tarjetas.

La jerarquía principal es:

**Workspace → Proyecto → Tablero → Tarjeta**

Tickard debe permitir empezar de forma sencilla y crecer posteriormente hacia necesidades más avanzadas de organización, colaboración, seguimiento y gestión.


## 2. Cuentas de usuario

Cualquier persona puede registrarse directamente en Tickard.

La cuenta representa la identidad de la persona y es independiente de las empresas u organizaciones a las que pertenezca.

Una misma cuenta puede participar en varios Workspaces simultáneamente.

Por ejemplo:

- Mi espacio — Free
- Invbit — Base
- Empresa X — Pro

El usuario utiliza siempre la misma cuenta para acceder a todos ellos.

Las cuentas no son Free, Base o Pro.

El plan pertenece al Workspace.


## 3. Workspace

El Workspace es el contenedor principal de trabajo de Tickard.

Dentro de un Workspace se encuentran sus:

- miembros;
- departamentos;
- equipos;
- clientes;
- proyectos;
- tableros;
- tarjetas;
- configuración;
- permisos;
- y demás información relacionada con el trabajo de esa organización.

Cada Workspace es independiente de los demás.

Un usuario puede pertenecer a varios Workspaces y tener diferentes permisos en cada uno.


### Workspace personal

Cuando una persona crea una cuenta en Tickard se crea automáticamente un Workspace personal con plan Free.

Esto permite comenzar a utilizar Tickard inmediatamente sin necesidad de recibir una invitación ni pertenecer a una empresa.

El nombre inicial del Workspace podrá ser, por ejemplo, **Mi espacio**.


### Workspaces compartidos

Los Workspaces pueden incorporar otros usuarios como miembros.

Todos los miembros trabajan con las capacidades disponibles en el plan de ese Workspace.

Por ejemplo, si un usuario pertenece a:

- Mi espacio — Free
- Invbit — Base
- Empresa X — Pro

dispondrá de las funciones Free dentro de Mi espacio, de las funciones Base dentro de Invbit y de las funciones Pro dentro de Empresa X.

El nivel de servicio no pertenece al usuario, sino al contexto en el que está trabajando.


## 4. Planes

Tickard tendrá inicialmente tres niveles de servicio:

- Free
- Base
- Pro

El plan se asigna al Workspace.

Todos los miembros de un mismo Workspace utilizan las capacidades correspondientes al plan contratado por ese Workspace.

Los límites, precios y características concretas de Free, Base y Pro se definirán posteriormente.

El plan Free deberá permitir probar y utilizar Tickard de forma real, incluyendo cierto nivel de colaboración.

Base estará orientado al uso habitual de equipos y empresas.

Pro añadirá herramientas y capacidades avanzadas.

No se fijan todavía límites concretos de miembros, proyectos, almacenamiento u otras características.


## 5. Miembros, clientes e invitados

Tickard distinguirá entre los usuarios que forman parte de una organización y los usuarios externos que reciben acceso limitado.

Los miembros forman parte del Workspace y trabajan normalmente dentro de sus proyectos.

Los clientes o invitados externos podrán recibir acceso únicamente a la información que la organización decida compartir con ellos.

Un cliente podrá, dependiendo de los permisos configurados:

- consultar determinados proyectos;
- consultar determinados tableros;
- ver las tarjetas que sean visibles para clientes;
- consultar únicamente determinados campos;
- realizar comentarios cuando esté permitido.

Los clientes no deben tener acceso a información interna.

El tratamiento de clientes e invitados respecto a los límites y facturación de los planes queda pendiente de definir.


## 6. Proyectos

Los proyectos pertenecen siempre a un Workspace.

Un proyecto agrupa el trabajo relacionado con un objetivo, producto, cliente o iniciativa.

Ejemplos:

- Portal de clientes
- Nueva web corporativa
- Aplicación móvil
- Mantenimiento interno

Un Workspace puede contener múltiples proyectos.

Los proyectos pueden estar asociados a un cliente cuando corresponda.


## 7. Tableros

Los tableros pertenecen siempre a un proyecto.

Un proyecto puede tener uno o varios tableros.

Por ejemplo:

**Portal de clientes**

- Desarrollo
- Incidencias
- Entrega marzo

Los tableros no constituyen una sección independiente de primer nivel dentro de Tickard.

Se accede a ellos desde el proyecto al que pertenecen.

Por este motivo, la navegación principal no necesita una sección global independiente llamada **Tableros**.


## 8. Navegación principal

La aplicación trabaja siempre dentro de un Workspace activo.

El usuario podrá cambiar de Workspace mediante un selector situado en la navegación principal.

Por ejemplo:

- Mi espacio — Free
- Invbit — Base
- Empresa X — Pro

Al cambiar de Workspace cambia todo el contexto de trabajo mostrado por Tickard.

Esto incluye:

- proyectos;
- tableros;
- departamentos;
- equipos;
- clientes;
- miembros;
- configuración;
- y demás información asociada al Workspace.

Los proyectos aparecerán en la navegación y podrán mostrar debajo sus respectivos tableros.


## 9. Columnas

Los tableros se organizan mediante columnas.

Inicialmente pueden utilizarse columnas como:

- Backlog
- Por hacer
- En progreso
- En revisión
- Completado

Las columnas pueden ordenarse.

Una columna puede eliminarse cuando no contiene tarjetas activas.


## 10. Tarjetas

Las tarjetas representan las unidades principales de trabajo.

Una tarjeta puede contener:

- título;
- descripción;
- responsables;
- equipos;
- fecha de vencimiento;
- prioridad;
- etiquetas;
- categoría;
- comentarios;
- actividad.

Tickard podrá ampliar progresivamente las tarjetas con:

- adjuntos;
- checklists;
- estimaciones;
- control de tiempo;
- módulos adicionales.

Las tarjetas pueden moverse entre columnas mediante arrastre.

Una tarjeta puede archivarse cuando deja de estar activa.


## 11. Visibilidad interna y clientes

Las tarjetas pueden ser internas o visibles para clientes.

Una tarjeta interna nunca debe mostrarse a un usuario externo.

Cuando una tarjeta es visible para clientes, el Workspace o proyecto puede determinar qué información puede consultar el cliente.

Entre los campos configurables pueden encontrarse:

- descripción;
- responsable;
- fecha de vencimiento;
- prioridad;
- etiquetas;
- comentarios.

Los comentarios también pueden diferenciar entre contenido interno y contenido visible para clientes.

La seguridad de esta información debe aplicarse en el backend y no depender únicamente de ocultar elementos en la interfaz.


## 12. Roles

Los permisos existirán en diferentes niveles.

### Roles del Workspace

Los roles exactos del Workspace se definirán en la documentación específica de Workspaces.

Estos roles determinarán quién puede administrar aspectos generales de la organización, como:

- miembros;
- equipos;
- departamentos;
- clientes;
- configuración;
- plan;
- proyectos.


### Roles de proyecto

Dentro de cada proyecto podrán existir diferentes niveles de acceso.

El modelo inicial contempla:

- Responsable
- Editor
- Lector
- Cliente

#### Responsable

Puede gestionar el proyecto, sus tableros, miembros, configuración y contenido.

#### Editor

Puede trabajar con las tarjetas y modificar el contenido permitido.

#### Lector

Puede consultar el proyecto y participar mediante las acciones permitidas, pero no modificar su estructura.

#### Cliente

Es un usuario externo con acceso únicamente a la información que haya sido habilitada para clientes.

La relación exacta entre roles de Workspace y roles de proyecto se definirá al desarrollar el nuevo modelo de permisos.


## 13. Equipos

Los equipos pertenecen al Workspace.

Permiten agrupar miembros para facilitar asignaciones y organización.

Ejemplos:

- Frontend
- Backend
- Diseño
- Marketing
- Producto

Una tarjeta puede asignarse tanto a personas concretas como a equipos.


## 14. Departamentos

Los departamentos pertenecen al Workspace.

Representan la estructura organizativa más estable de una empresa.

Ejemplos:

- Desarrollo
- Administración
- Comercial
- Marketing
- Recursos Humanos

Equipos y departamentos son conceptos diferentes.

Un departamento representa la estructura organizativa.

Un equipo representa una agrupación operativa de personas.


## 15. Clientes

Los clientes pertenecen al Workspace.

Un Workspace puede gestionar múltiples clientes y asociar proyectos a ellos.

Los usuarios externos asociados a clientes podrán acceder únicamente a los proyectos y contenidos que les hayan sido habilitados.


## 16. Invitaciones

Las invitaciones sirven para incorporar personas a un Workspace o conceder acceso externo cuando corresponda.

Las invitaciones no son el mecanismo principal para crear una identidad en Tickard.

Cualquier persona puede registrarse directamente.

Si una invitación corresponde a una persona que ya tiene una cuenta Tickard, utilizará esa misma cuenta para incorporarse al Workspace.

Si todavía no tiene cuenta, podrá registrarse y posteriormente incorporarse al Workspace utilizando la invitación.

Aceptar una invitación nunca debe permitir modificar las credenciales de una cuenta existente.


## 17. Notificaciones

Tickard podrá generar notificaciones por eventos relevantes, como:

- asignación de tarjetas;
- menciones;
- comentarios;
- invitaciones;
- cambios importantes;
- vencimientos.

Inicialmente existirán notificaciones dentro de la aplicación y podrán complementarse con correo electrónico.


## 18. Tiempo real

Los cambios realizados en un tablero deberán poder reflejarse para los usuarios que estén trabajando simultáneamente en él.

El sistema deberá evolucionar hacia sincronización en tiempo real.

La tecnología concreta utilizada para esta funcionalidad podrá decidirse durante su implementación.


## 19. Apariencia

Tickard tendrá una interfaz limpia orientada al trabajo diario.

La identidad visual utilizará principalmente una paleta verde.

La aplicación deberá disponer de:

- modo claro;
- modo oscuro;
- diseño adaptable;
- navegación consistente;
- componentes reutilizables.

La interfaz debe priorizar claridad y rapidez sobre elementos decorativos innecesarios.


## 20. Estructura funcional

La estructura principal de Tickard queda definida como:

Workspace
→ Proyecto
→ Tablero
→ Columna
→ Tarjeta

Alrededor del Workspace existen además:

- miembros;
- equipos;
- departamentos;
- clientes;
- configuración;
- plan.

Esta estructura constituye la base funcional sobre la que crecerá Tickard.


## 21. Arquitectura técnica actual

### Backend

- Laravel
- API REST
- Laravel Sanctum para autenticación

La estrategia definitiva de autenticación para producción se revisará antes del lanzamiento.


### Frontend

- React
- TypeScript
- Vite

La interfaz consume la API del backend.


### Base de datos

- MySQL


### Desarrollo local

El entorno de desarrollo utiliza Docker para los servicios que lo requieran.

El correo electrónico durante desarrollo puede enviarse al log u otro sistema de pruebas.


## 22. Principios de evolución

Tickard debe poder evolucionar sin comprometer los datos existentes de los usuarios.

Los cambios importantes en arquitectura o base de datos deberán realizarse mediante migraciones.

Las nuevas funcionalidades deben integrarse progresivamente sin obligar a reconstruir el sistema cada vez que el producto crezca.

Se priorizará:

- código comprensible;
- componentes reutilizables;
- separación de responsabilidades;
- seguridad aplicada en backend;
- compatibilidad con datos existentes;
- evolución progresiva del producto.

No se añadirá complejidad arquitectónica únicamente por anticipar necesidades que todavía no existen.