# Tickard — Workspaces

## 1. Concepto de Workspace

Un Workspace es el espacio de trabajo principal de Tickard y representa el contexto dentro del cual una persona, equipo u organización gestiona su trabajo.

Cada Workspace mantiene de forma independiente sus:

- miembros;
- proyectos;
- tableros;
- equipos;
- departamentos;
- clientes;
- configuración;
- permisos;
- asientos adicionales.

Una misma cuenta de usuario puede pertenecer a varios Workspaces.

El usuario trabaja siempre dentro de un Workspace activo y puede cambiar entre aquellos a los que tenga acceso.

El plan comercial pertenece al usuario propietario.

Los Workspaces de los que ese usuario sea propietario heredan las capacidades correspondientes a su plan.

Una misma cuenta puede pertenecer además a Workspaces propiedad de otros usuarios y disponer dentro de ellos de las capacidades correspondientes al plan de su propietario.

---

## 2. Cuenta de usuario y Workspace

La cuenta de usuario y el Workspace son entidades independientes.

La cuenta representa la identidad de la persona dentro de Tickard.

El Workspace representa uno de los espacios de trabajo a los que esa persona tiene acceso.

Esto permite que una única cuenta pueda:

- ser propietaria de uno o varios Workspaces;
- pertenecer como miembro a otros Workspaces;
- cambiar entre diferentes Workspaces sin crear cuentas adicionales;
- disponer de diferentes capacidades dependiendo del Workspace activo.

Los datos de trabajo no pertenecen directamente a la cuenta del usuario, sino al Workspace correspondiente.

---

## 3. Registro y Workspace inicial

Cualquier persona puede crear una cuenta en Tickard sin necesidad de invitación.

Al registrarse se crea automáticamente un Workspace inicial.

Inicialmente:

- el usuario tendrá plan Free;
- el Workspace utilizará las capacidades correspondientes al plan Free de su propietario;
- el usuario que lo crea será su propietario;
- el usuario tendrá el rol de propietario dentro de ese Workspace;
- podrá comenzar a utilizar Tickard inmediatamente;
- podrá crear proyectos, tableros y tarjetas dentro de los límites correspondientes a su plan.

El nombre inicial será:

**Mi espacio**

Este nombre podrá modificarse posteriormente.

---

## 4. El Workspace inicial no es un tipo especial

El Workspace creado durante el registro no constituye un tipo especial de Workspace.

No existe conceptualmente una diferencia entre:

- Workspace personal;
- Workspace de equipo;
- Workspace empresarial.

Todos utilizan el mismo modelo de Workspace.

`Mi espacio` es únicamente el nombre inicial utilizado para facilitar el comienzo al usuario.

El Workspace inicial puede posteriormente:

- renombrarse;
- contener proyectos;
- contener equipos;
- contener departamentos;
- contener clientes;
- incorporar otros miembros;
- utilizarse de forma colaborativa.

Por ejemplo:

Ana se registra en Tickard.

Se crea:

**Mi espacio**

Ana es su propietaria.

Posteriormente Ana puede renombrarlo:

**Tickard Demo**

e invitar a Luis, Marta y Elena.

Sigue siendo exactamente el mismo Workspace. No se crea un Workspace adicional ni cambia su naturaleza.

---

## 5. Propiedad y pertenencia

Un usuario puede relacionarse con un Workspace de diferentes formas.

Como mínimo existe el concepto de:

- propietario;
- miembro.

El propietario es el usuario responsable del Workspace.

Su rol `owner` está en el nivel del Workspace, **no** es un quinto rol de proyecto. Dispone de permisos efectivos de `responsable` en todos sus proyectos aunque no figure en `project_members`, y puede gestionar sus miembros y recursos. No se puede degradar ni retirar su participación desde la gestión de un proyecto. La propiedad del Workspace solo podrá transferirse mediante un procedimiento específico futuro.

Un usuario también puede pertenecer como miembro a Workspaces propiedad de otras personas.

Por ejemplo, Luis podría tener acceso a:

- Mi espacio — propietario;
- Tickard Demo — miembro;
- Empresa X — miembro.

La pertenencia a un Workspace no implica ser propietario del mismo.

### Baja de miembros internos

Solo el propietario puede dar de baja a un miembro interno desde **Personal → Miembros → Información → Quitar del Workspace**.

La operación utiliza `DELETE /api/workspaces/{workspace}/members/{user}` y se ejecuta en una transacción:

- revoca su membresía del Workspace, las pertenencias a proyectos, departamentos y equipos;
- elimina sus asignaciones directas a Cards y elementos de checklist de ese Workspace (si hay otras personas asignadas, sus asignaciones se mantienen);
- invalida la revisión de los tableros afectados y revoca invitaciones pendientes a ese Workspace;
- deja sin responsable los equipos o departamentos que dirigía, para que el propietario asigne uno nuevo;
- conserva Cards, checklists, comentarios, actividad histórica y la cuenta global de Tickard, además de todas sus relaciones con otros Workspaces.

La baja del `owner` está prohibida. Los accesos de empresas cliente se administran desde **Clientes**, no desde esta operación. La confirmación de baja explica las consecuencias antes de ejecutarse.

Los roles y permisos adicionales dentro del Workspace se definirán posteriormente.

---

## 6. Workspaces propios y compartidos

Los límites de creación de Workspaces se aplican únicamente a los Workspaces de los que el usuario es propietario.

Los Workspaces a los que accede como miembro o invitado no consumen su límite de Workspaces propios.

Por ejemplo, un usuario Free podría tener:

- Mi espacio — propietario;
- Tickard Demo — miembro;
- Empresa X — miembro;
- Proyecto externo — miembro.

Aunque tenga acceso a cuatro Workspaces, solamente utiliza:

**1 / 1 Workspace propio**

Los otros tres pertenecen a otros usuarios y no afectan a su capacidad para crear Workspaces propios.

Los límites concretos de cada plan se documentan en `docs/plans.md`.

---

## 7. Jerarquía del trabajo

La jerarquía principal de Tickard es:

**Workspace → Proyecto → Tablero → Columna → Tarjeta**

Un Workspace puede contener múltiples proyectos.

Cada proyecto pertenece a un único Workspace.

Cada proyecto puede contener múltiples tableros.

Cada tablero puede contener múltiples columnas.

Cada columna puede contener múltiples tarjetas.

Por tanto, un tablero pertenece indirectamente a un Workspace a través de su proyecto, y una tarjeta pertenece indirectamente al Workspace a través del tablero y del proyecto.

No es necesario considerar cada nivel como un espacio de trabajo independiente.

El Workspace es el contexto superior que agrupa toda la información relacionada.

---

## 8. Entidades compartidas dentro del Workspace

Además de los proyectos, un Workspace contiene información que puede utilizarse de forma compartida por diferentes proyectos.

Entre estas entidades se encuentran:

- miembros;
- equipos;
- departamentos;
- clientes.

Estas entidades pertenecen al Workspace y no globalmente a la cuenta del usuario.

Por ejemplo, un equipo creado dentro de `Tickard Demo` pertenece a ese Workspace y no debe aparecer automáticamente dentro de `Mi espacio` aunque el mismo usuario tenga acceso a ambos.

Lo mismo se aplica a departamentos y clientes.

---

## 9. Proyectos

Los proyectos pertenecen directamente a un Workspace.

Un proyecto no puede pertenecer simultáneamente a varios Workspaces.

Ejemplo:

**Tickard Demo**
- Portal de clientes
- Aplicación interna
- Nueva web corporativa

**Mi espacio**
- Proyecto personal

Cambiar de Workspace cambia el contexto desde el que se accede a los proyectos.

Los límites relacionados con el número de proyectos dependen del plan del propietario del Workspace y se aplican individualmente a cada Workspace.

Estos límites se documentan en `docs/plans.md`.

---

### Configuración de los proyectos

La configuración se abre desde el icono de engranaje en el encabezado de un proyecto y está disponible para sus responsables autorizados, incluido el propietario del Workspace.

La vista unificada contiene **Datos generales** (nombre), **Acceso de clientes** (empresa asociada y habilitación de acceso externo), **Visibilidad para clientes** (descripción, asignación, fecha límite, prioridad, etiquetas y comentarios) y **Zona de peligro** (eliminar proyecto mediante la confirmación existente).

Los ajustes son propios del proyecto, no dependen de cuál sea su tablero activo y pueden modificarse incluso antes de crear el primer tablero. Los cambios se validan en Laravel. La selección de empresa solo muestra clientes del mismo Workspace y el acceso externo requiere que el módulo Clientes esté habilitado, una empresa asociada y permisos de usuario adecuados.

- `GET /api/projects/{project}/settings`: lee configuración y empresas disponibles, restringido a responsables autorizados.
- `PATCH /api/projects/{project}`: modifica el nombre validado (1–120 caracteres tras recorte), la asociación y el acceso de clientes, o los campos de visibilidad existentes.
- `DELETE /api/projects/{project}`: conserva la confirmación explícita del nombre antes de eliminarlo.

No es necesaria ninguna migración: se reutilizan los campos actuales de `projects`.

---


### Identidad visual de la demo Altaris

La demo usa el Workspace **Altaris** (antes Tickard Demo) y los clientes **Aster Labs** y **Norte Digital**. Sus logos originales están versionados en la carpeta raíz `docs/`:

- `docs/Altaris_logo.png`
- `docs/AsterLabs_logo.png`
- `docs/NorteDigital_logo.png`
- `docs/Nebula_logo.png` — logo del proyecto Nébula Mobile

`DatabaseSeeder` ejecuta `DemoBrandAssetsSeeder` al final: copia los archivos al disco público de Laravel y asigna `image_path` al Workspace y a los dos clientes, sin crear identidades duplicadas. En instalaciones con la demo ya poblada, no hace falta reiniciar la base de datos. Tras actualizar el repositorio:

```bash
cd backend
php artisan migrate
php artisan storage:link
php artisan db:seed --class=DemoBrandAssetsSeeder
```

El paso `storage:link` solo es necesario si no existe ya el enlace a `public/storage`. La seeder de branding es **repetible**, reutiliza el Workspace de Ana y actualiza las imágenes de los clientes existentes, así como el logo de **Nébula Mobile**, sin recrear el proyecto. El proyecto dispone de `projects.image_path` y el logo se refleja en la barra lateral, el dashboard del Workspace y la cabecera del proyecto. No relanza Nébula Mobile ni modifica tareas, comentarios o proyectos. El frontend toma las imágenes de `/storage/...` en el selector del Workspace, la cabecera de Altaris y los paneles de clientes.

---

### Resumen del tablero

La pestaña **Resumen** de cada tablero presenta únicamente datos reales del tablero seleccionado, sin mezclar las Cards de otros tableros del proyecto. El backend sirve un endpoint resumido `GET /api/boards/{board}/dashboard` sin hidratar los módulos completos de las tarjetas.

- Seis indicadores: total de tareas activas, por hacer, en progreso, en revisión, completadas y vencidas.
- Progreso por tareas completadas, distribución por los cinco estados reales (incluido Backlog), prioridades y fechas de planificación.
- Contadores de tareas sin fecha, con fecha y bloqueadas por una dependencia pendiente.
- Tareas con plazo e hitos, actividad reciente, miembros con asignaciones, etiquetas más usadas y adjuntos recientes.
- Los listados de Cards y archivos abren la Card original; los accesos Tablero/Gantt cambian la vista actual.
- Las cuentas cliente no reciben tareas internas, sus actividades ni sus adjuntos; los comentarios internos se omiten y los agregados de dependencias privadas no se publican.
- Las filas quedan acotadas al alto disponible del contenido del tablero y se adaptan a la pantalla mediante scroll interno.

### Vista general del Workspace

El dashboard principal sigue la referencia de Tickard Demo: identidad y métricas en cabecera; proyectos recientes, tareas pendientes, actividad, equipos y departamentos en el área central; miembros, clientes y anuncios en el panel derecho. Cada bloque consume datos reales del backend y respeta el Workspace activo.

El endpoint existente `GET /api/workspaces/{workspace}/overview` incorpora `dashboard` con cifras de Cards no archivadas y completadas, hasta 6 proyectos recientes, 7 tareas pendientes, 6 eventos recientes, y muestras acotadas de miembros, equipos, departamentos y clientes. Se filtran los proyectos accesibles por el usuario: miembros normales solo ven sus Cards asignadas y clientes solo sus Cards públicas asignadas en proyectos externos habilitados. No se devuelven textos de comentarios ni actividades internas; las cuentas sin permisos administrativos no reciben listados de personal ni empresas.

La tarjeta **Miembros del Workspace** se alinea con las métricas y limita sus avatares al espacio disponible; incluye acceso a las invitaciones. Las tarjetas de proyectos recientes muestran nombre y **descripción general** junto al icono, barra de progreso de tareas completadas, número de tareas, avatares de miembros y la **última fecha de vencimiento** entre las Cards visibles (no un estado propio de proyecto). «Nuevo proyecto» abre un modal de creación con nombre y descripción; la edición de la descripción también está disponible en Configuración del proyecto. Los botones de clientes y miembros conducen a los formularios existentes con sus permisos.

Las actividades muestran la misma foto de cuenta que en el resto de Tickard. Si un usuario no ha subido ninguna, se emplea el mismo identificador estable de usuario para el avatar de reserva, evitando fotos distintas según la vista.

**Distribución de altura acotada:** las métricas quedan inmediatamente encima de «Proyectos recientes», en el área central. La columna derecha de Miembros, Clientes y Anuncios ocupa toda la altura restante del dashboard. La página respeta la altura del viewport: el contenido central se desplaza dentro de su región y los listados largos del lateral tienen su propio scroll. En pantallas pequeñas, las secciones se apilan sin crear scroll general.

**Breadcrumb navegable:** los niveles anteriores de la ruta permiten regresar a Inicio, la vista del Workspace y el resumen del proyecto; «Proyectos» abre el listado de proyectos del Workspace.

**Gantt de tableros pequeños:** la adaptación del rango temporal a la geometría de dependencias queda desactivada en tableros sin dependencias y pasa a ser monotónica cuando sí las hay, evitando oscilaciones de tamaño. Si el componente de Gantt falla, aparece un panel de recuperación en lugar de desmontar el resto de la aplicación.

El botón **Configuración** abre los ajustes existentes del propietario (nombre, cumpleaños, Clientes y eliminación). Así los formularios no ocupan espacio en la vista principal. **Anuncios del Workspace** presenta un estado vacío porque aún no existe un modelo de anuncios; no se simulan publicaciones. Se conserva el loading y el scroll interno.


Al pulsar el nombre del Workspace en el menú lateral se abre su **vista general**. Incluye métricas calculadas en el backend exclusivamente para el Workspace activo: proyectos, miembros, equipos, departamentos y empresas cliente cuando está habilitado el módulo Clientes.

- Owner y administradores: pueden consultar las métricas de organización y acceder desde la vista a las secciones de Personal.
- Miembros sin privilegios de administración: ven únicamente los proyectos a los que están asignados, sin el directorio ni recuentos internos.
- Cuentas cliente: ven únicamente el número de proyectos externos realmente accesibles; no reciben recuentos de personal, equipos, departamentos o clientes.
- Propietario: puede además cambiar el nombre, controlar los cumpleaños de calendario, habilitar/deshabilitar el módulo Clientes y eliminar el Workspace mediante confirmación de su nombre, excepto si es su único Workspace propio.

La interfaz tiene loading compartido con Gantt, mensajes de error y confirmación y scroll dentro de la sección sin desplazar la navegación global.

`GET /api/workspaces/{workspace}/overview` exige pertenencia al Workspace; filtra cifras y opciones según el rol. El renombrado utiliza el endpoint `PATCH /api/workspaces/{workspace}` ya existente, recortando espacios y rechazando nombres vacíos. Los controles de cumpleaños y clientes reutilizan sus rutas de configuración; la eliminación reutiliza `DELETE /api/workspaces/{workspace}`. No requiere migraciones.

---

## 10. Workspace activo

Aunque una cuenta pueda pertenecer a múltiples Workspaces, el usuario trabaja dentro de un contexto de Workspace determinado.

La interfaz deberá permitir seleccionar el Workspace activo.

Al cambiar de Workspace deberán cambiar también los datos contextuales mostrados por Tickard, incluyendo:

- proyectos;
- tableros;
- equipos;
- departamentos;
- clientes;
- miembros;
- configuración disponible.

Esto evita mezclar información perteneciente a diferentes Workspaces.

El Workspace activo podrá persistirse para que el usuario continúe trabajando en el mismo contexto al volver a acceder a Tickard.

---

## 11. Plan efectivo del Workspace

El plan comercial pertenece al usuario propietario del Workspace.

Cada usuario puede disponer de uno de los planes de Tickard:

- Free;
- Base;
- Pro;
- Business.

Los Workspaces de los que ese usuario sea propietario heredan automáticamente las capacidades correspondientes a su plan.

Por ejemplo:

Ana dispone de plan Pro y es propietaria de:

- Mi espacio;
- Tickard Demo;
- Empresa X.

Los tres Workspaces funcionan con las capacidades correspondientes al plan Pro.

Un Workspace no convierte en usuarios Pro a sus miembros.

Por ejemplo, Luis puede disponer de plan Free y ser miembro de `Tickard Demo`, propiedad de Ana.

Dentro de `Tickard Demo`, Luis podrá utilizar las funcionalidades disponibles en ese Workspace Pro.

Sin embargo, su propio Workspace `Mi espacio` continuará utilizando las capacidades correspondientes a su plan Free.

Por tanto, deben distinguirse siempre dos conceptos:

- **plan del usuario:** plan contratado por la cuenta;
- **plan efectivo del Workspace:** corresponde al plan actual de su propietario.

Si el propietario cambia de plan, sus Workspaces propios pasan a utilizar las capacidades del nuevo plan.

Los datos existentes nunca deben eliminarse automáticamente como consecuencia de un downgrade.

Las reglas concretas de límites, upgrades y downgrades se documentan en:

`docs/plans.md`

---

## 12. Asientos y miembros del Workspace

Cada Workspace dispone de una capacidad máxima de miembros.

La cantidad de miembros incluida depende del plan efectivo del Workspace.

Los límites provisionales actuales son:

- Free: 3 miembros;
- Base: 10 miembros;
- Pro: 30 miembros;
- Business: a medida.

El propietario del Workspace cuenta como miembro y consume uno de estos asientos.

Por tanto:

- un Workspace Free permite propietario + 2 miembros adicionales;
- un Workspace Base permite propietario + 9 miembros adicionales;
- un Workspace Pro permite propietario + 29 miembros adicionales.

Este límite se aplica individualmente a cada Workspace.

Un Workspace puede ampliar su capacidad mediante la contratación de asientos adicionales.

Los asientos adicionales se adquirirán mediante packs y pertenecen únicamente al Workspace para el que fueron contratados.

El precio unitario del asiento será progresivamente menor en planes superiores:

**Free > Base > Pro**

Business podrá utilizar condiciones personalizadas.

La capacidad total de miembros de un Workspace se calcula como:

**miembros incluidos por el plan + asientos adicionales del Workspace**

## 13. Invitaciones

Una invitación concede acceso a un Workspace, pero no sustituye ni modifica la identidad de la cuenta del usuario.

Si la persona invitada ya dispone de una cuenta de Tickard, deberá utilizar su cuenta existente para incorporarse al Workspace.

Si todavía no dispone de una cuenta, deberá registrarse normalmente y posteriormente incorporarse al Workspace correspondiente.

Antes de incorporar definitivamente a un nuevo miembro deberá comprobarse que el Workspace dispone de capacidad suficiente.

Si todos los asientos disponibles están ocupados, la incorporación deberá quedar bloqueada hasta que:

- se libere un asiento;
- se contraten asientos adicionales;
- o aumente la capacidad disponible mediante un cambio de plan.

Una invitación nunca debe:

- establecer la contraseña de una cuenta existente;
- cambiar la contraseña de una cuenta existente;
- modificar las credenciales de una cuenta existente;
- crear una identidad alternativa para una persona que ya dispone de cuenta.

La cuenta y la pertenencia al Workspace son conceptos independientes.

El funcionamiento detallado del proceso de invitación y aceptación se definirá posteriormente.

---

## 14. Demo de desarrollo

La información de demostración utilizada durante el desarrollo seguirá el mismo modelo de Workspaces que utilizará el producto real.

La estructura prevista para la demo es:

### Ana

Su Workspace inicial `Mi espacio` se renombra a:

**Tickard Demo**

Ana es la propietaria de `Tickard Demo`.

No se crea un segundo Workspace para la demo.

Durante el desarrollo, Ana podrá utilizar un plan superior para facilitar las pruebas de funcionalidades y límites.

### Luis, Marta y Elena

Cada uno mantiene su propio Workspace inicial:

**Mi espacio**

Además, pertenecen como miembros a:

**Tickard Demo**

### Datos compartidos de la demo

Los datos compartidos actuales pertenecen a `Altaris`, incluyendo:

- Norte Digital;
- departamentos;
- equipos;
- clientes;
- proyecto `Portal de clientes`;
- tablero `Entrega marzo`;
- tarjetas y demás información relacionada.

De esta forma, la demo representa un Workspace colaborativo real y no un caso especial dentro de la aplicación.

---

## 15. Principios del modelo de Workspaces

El diseño de Workspaces debe respetar los siguientes principios.

### Una cuenta, múltiples contextos

Una persona utiliza una única cuenta aunque participe en múltiples organizaciones o espacios de trabajo.

### Separación de datos

Los datos pertenecientes a diferentes Workspaces no deben mezclarse.

### El Workspace inicial es normal

`Mi espacio` no representa un tipo especial de Workspace.

Puede evolucionar y utilizarse de la misma forma que cualquier otro.

### Las invitaciones añaden pertenencia

Invitar a una persona añade acceso a un Workspace.

No crea una identidad alternativa ni sustituye las credenciales de la persona.

### Los Workspaces compartidos no consumen propiedad

Pertenecer a Workspaces ajenos no consume el límite de Workspaces propios del usuario.

### El plan pertenece al propietario

El plan comercial pertenece al usuario.

Los Workspaces que posee utilizan las capacidades correspondientes a su plan.

### Las capacidades dependen del Workspace activo

Una persona puede disponer de diferentes capacidades dependiendo del Workspace en el que esté trabajando, ya que cada Workspace utiliza el plan de su propietario.

### Los miembros consumen capacidad del Workspace

Cada miembro incorporado ocupa capacidad dentro del Workspace correspondiente.

### Los asientos pertenecen al Workspace

La capacidad adicional contratada mediante asientos pertenece únicamente al Workspace para el que fue adquirida.

---

## 16. Decisiones pendientes

Los siguientes aspectos del sistema de Workspaces todavía deben definirse con mayor detalle:

- roles adicionales a nivel de Workspace;
- permisos concretos de cada rol;
- gestión y transferencia de la propiedad;
- incorporación y eliminación de miembros;
- abandono voluntario de un Workspace;
- funcionamiento detallado de las invitaciones;
- tratamiento específico de clientes e invitados externos;
- eliminación de Workspaces;
- comportamiento cuando un propietario quiera eliminar su cuenta;
- configuración detallada del Workspace;
- precio de los asientos adicionales;
- posibles paquetes de asientos;
- modalidad de facturación de los asientos adicionales;
- comportamiento de los asientos adicionales después de un downgrade;
- transferencia o cancelación de asientos adicionales;
- gestión de pagos y facturación.

Los límites de los planes Free, Base, Pro y Business se documentan por separado en `docs/plans.md`.

Estas decisiones pendientes no deben asumirse durante el desarrollo hasta que sean definidas explícitamente.