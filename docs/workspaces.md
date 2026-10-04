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
- plan.

Una misma cuenta de usuario puede pertenecer a varios Workspaces.

El usuario trabaja siempre dentro de un Workspace activo y puede cambiar entre aquellos a los que tenga acceso.

El plan pertenece al Workspace y no a la cuenta de usuario. Por tanto, una misma persona puede disponer de diferentes capacidades dependiendo del Workspace en el que esté trabajando.

Ejemplo:

- Mi espacio — Free
- Invbit — Base
- Empresa X — Pro

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

- tendrá plan Free;
- el usuario que lo crea será su propietario;
- el usuario tendrá el rol de propietario dentro de ese Workspace;
- podrá comenzar a utilizar Tickard inmediatamente;
- podrá crear proyectos, tableros y tarjetas dentro de los límites del plan Free.

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

Los límites relacionados con el número de proyectos dependen del plan del Workspace y se documentan en `docs/plans.md`.

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

La implementación concreta del selector y la persistencia del Workspace activo se definirá durante su desarrollo.

---

## 11. Plan del Workspace

Cada Workspace dispone de su propio plan.

El plan no pertenece globalmente a la cuenta del usuario.

Esto permite que una misma persona pueda participar simultáneamente en Workspaces con diferentes capacidades.

Por ejemplo:

- Mi espacio — Free;
- Tickard Demo — Base;
- Empresa X — Pro.

Al cambiar de Workspace, las capacidades disponibles dependerán del plan del Workspace activo.

Los límites y reglas de los planes se documentan en:

`docs/plans.md`

---

## 12. Invitaciones

Una invitación concede acceso a un Workspace, pero no sustituye ni modifica la identidad de la cuenta del usuario.

Si la persona invitada ya dispone de una cuenta de Tickard, deberá utilizar su cuenta existente para incorporarse al Workspace.

Si todavía no dispone de una cuenta, deberá registrarse normalmente y posteriormente incorporarse al Workspace correspondiente.

Una invitación nunca debe:

- establecer la contraseña de una cuenta existente;
- cambiar la contraseña de una cuenta existente;
- modificar las credenciales de una cuenta existente;
- crear una identidad alternativa para una persona que ya dispone de cuenta.

La cuenta y la pertenencia al Workspace son conceptos independientes.

El funcionamiento detallado del proceso de invitación y aceptación se definirá posteriormente.

---

## 13. Demo de desarrollo

La información de demostración utilizada durante el desarrollo seguirá el mismo modelo de Workspaces que utilizará el producto real.

La estructura prevista para la demo es:

### Ana

Su Workspace inicial `Mi espacio` se renombra a:

**Tickard Demo**

Ana es la propietaria de `Tickard Demo`.

No se crea un segundo Workspace para la demo.

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

## 14. Principios del modelo de Workspaces

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

### El plan depende del Workspace

Las capacidades disponibles pueden ser diferentes en cada Workspace al que pertenece una misma cuenta.

---

## 15. Decisiones pendientes

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
- facturación y gestión de miembros o asientos.

Los límites de los planes Free, Base, Pro y Business se documentan por separado en `docs/plans.md`.

Estas decisiones pendientes no deben asumirse durante el desarrollo hasta que sean definidas explícitamente.