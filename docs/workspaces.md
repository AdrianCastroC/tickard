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

Un usuario también puede pertenecer como miembro a Workspaces propiedad de otras personas.

Por ejemplo, Luis podría tener acceso a:

- Mi espacio — propietario;
- Tickard Demo — miembro;
- Empresa X — miembro.

La pertenencia a un Workspace no implica ser propietario del mismo.

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

Este límite se aplica individualmente a cada Workspace.

Por ejemplo, si el plan Pro incluye una determinada cantidad de miembros, cada Workspace propiedad de un usuario Pro dispone de esa capacidad de forma independiente.

Un Workspace puede ampliar su capacidad mediante la contratación de asientos adicionales.

Los asientos adicionales pertenecen únicamente al Workspace para el que fueron adquiridos.

No se comparten automáticamente con otros Workspaces del mismo propietario.

La capacidad total de miembros de un Workspace se calcula como:

**miembros incluidos por el plan + asientos adicionales del Workspace**

Por ejemplo:

`Tickard Demo`

- plan efectivo: Pro;
- miembros incluidos por Pro: X;
- asientos adicionales contratados: 10;
- capacidad total: X + 10.

Cuando un Workspace alcanza su capacidad máxima de miembros no podrán incorporarse nuevos miembros hasta que:

- quede libre algún asiento;
- se contraten asientos adicionales;
- o el propietario cambie a un plan con mayor capacidad.

Eliminar un miembro del Workspace libera la capacidad correspondiente a ese asiento.

Los miembros invitados utilizan las capacidades del Workspace en el que están trabajando.

Esto no modifica su plan personal ni las capacidades de los Workspaces de los que ellos mismos sean propietarios.

Por ejemplo:

Luis dispone de plan Free.

Es propietario de:

**Mi espacio**

y miembro de:

**Tickard Demo**

Si `Tickard Demo` utiliza las capacidades Pro de Ana, Luis podrá utilizar esas capacidades mientras trabaje dentro de `Tickard Demo`.

Al volver a `Mi espacio`, seguirá sujeto a las capacidades Free de su propia cuenta.

Los asientos adicionales constituyen una ampliación de capacidad del Workspace y no una mejora del plan personal de sus miembros.

---

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

Los datos compartidos actuales pertenecen a `Tickard Demo`, incluyendo:

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
- número de miembros incluidos en cada plan;
- precio de los asientos adicionales;
- posibles paquetes de asientos;
- modalidad de facturación de los asientos adicionales;
- comportamiento de los asientos adicionales después de un downgrade;
- transferencia o cancelación de asientos adicionales;
- gestión de pagos y facturación.

Los límites de los planes Free, Base, Pro y Business se documentan por separado en `docs/plans.md`.

Estas decisiones pendientes no deben asumirse durante el desarrollo hasta que sean definidas explícitamente.