# Tickard — Planes

Este documento recoge las decisiones de producto relacionadas con los planes, sus límites y el comportamiento de Tickard cuando dichos límites cambian.

Los precios y otras características comerciales todavía no están definidos.

---

## 1. Propiedad del plan

El plan comercial pertenece a la cuenta de usuario.

Cada usuario dispone de un único plan personal:

- Free;
- Base;
- Pro;
- Business.

Los Workspaces de los que ese usuario sea propietario utilizan ese plan como su **plan efectivo**.

Por ejemplo:

Ana dispone de plan Pro y posee tres Workspaces.

Los tres utilizan las capacidades correspondientes al plan Pro.

Si Luis, cuyo plan personal es Free, pertenece como miembro a uno de esos Workspaces, podrá utilizar allí las capacidades Pro disponibles.

Esto no convierte a Luis en usuario Pro.

Los Workspaces propiedad de Luis continúan utilizando su plan Free.

Pertenecer a Workspaces ajenos tampoco consume el límite de Workspaces propios del usuario.

Por tanto, deben distinguirse:

- **plan personal:** plan contratado por el usuario;
- **plan efectivo del Workspace:** plan del propietario de ese Workspace;
- **capacidad adicional del Workspace:** recursos contratados específicamente para ese Workspace, como asientos adicionales.

---

## 2. Planes

### Free

- Máximo de **1 Workspace propio**.
- Máximo de **3 proyectos por Workspace**.
- Almacenamiento: **200 MB por Workspace**.
- Incluye una cantidad limitada de miembros por Workspace.
- Puede ampliar la capacidad de miembros mediante asientos adicionales cuando esta funcionalidad esté disponible.
- Puede pertenecer como miembro a otros Workspaces.

Los Workspaces a los que el usuario pertenece como miembro no consumen su límite de Workspaces propios.

---

### Base

- Máximo de **5 Workspaces propios**.
- Máximo de **10 proyectos por Workspace**.
- Almacenamiento: **2 GB por Workspace**.
- Incluye una cantidad de miembros por Workspace superior a Free.
- Puede contratar asientos adicionales para Workspaces concretos.
- Puede pertenecer como miembro a otros Workspaces.

El límite de Workspaces evita que la creación de nuevos espacios pueda utilizarse simplemente como mecanismo para eludir el límite de proyectos.

---

### Pro

- **Workspaces propios ilimitados**.
- Máximo de **50 proyectos por Workspace**.
- Almacenamiento: **20 GB totales por cuenta**, repartidos de forma equitativa entre los Workspaces propios existentes.
- Incluye una cantidad de miembros por Workspace superior a Base.
- Puede contratar asientos adicionales para Workspaces concretos.
- Puede pertenecer como miembro a otros Workspaces.

Pro no dispone de proyectos ilimitados.

El límite actual establecido es de 50 proyectos por Workspace.

---

### Business

Business está orientado a organizaciones cuyas necesidades no encajen correctamente en los planes estándar.

Sus límites y configuración podrán definirse a medida según las necesidades de cada organización.

Esto podrá incluir:

- número de Workspaces propios;
- número de proyectos por Workspace;
- miembros incluidos;
- asientos adicionales;
- almacenamiento;
- límites de archivos;
- automatizaciones;
- otras capacidades empresariales.

Las características comerciales concretas de Business todavía no están definidas.

---

## 3. Workspaces propios y Workspaces compartidos

El límite de Workspaces se aplica únicamente a aquellos de los que el usuario es propietario.

Pertenecer a un Workspace creado por otro usuario no consume este límite.

Por ejemplo, un usuario Free podría tener:

- `Mi espacio` — propietario.
- `Tickard Demo` — miembro.
- `Empresa X` — miembro.
- `Proyecto externo` — miembro.

En este caso únicamente utiliza:

**1 / 1 Workspace propio**

Los demás Workspaces no afectan a su límite porque pertenecen a otros usuarios.

Las capacidades disponibles dentro de cada Workspace dependerán del plan de su propietario.

---

## 4. Límite de proyectos

El límite de proyectos se aplica individualmente a cada Workspace.

Los límites actuales son:

| Plan del propietario | Proyectos por Workspace |
|---|---:|
| Free | 3 |
| Base | 10 |
| Pro | 50 |
| Business | A medida |

El límite cuenta los **proyectos existentes**, independientemente de que estén activos o archivados.

Por tanto:

- un proyecto activo cuenta;
- un proyecto archivado también cuenta;
- archivar un proyecto no libera una plaza.

### Ejemplo

Un Workspace cuyo propietario utiliza Free contiene:

- Proyecto A — activo.
- Proyecto B — activo.
- Proyecto C — archivado.

El consumo continúa siendo:

**3 / 3 proyectos**

Archivar el Proyecto C no permite crear un Proyecto D.

Para reducir realmente el número de proyectos existentes será necesario eliminar proyectos definitivamente.

La política concreta de papelera, período de recuperación y eliminación definitiva todavía está pendiente de definir.

---

## 5. Límite de miembros y asientos

Cada Workspace dispone de una capacidad máxima de miembros.

La capacidad incluida depende del plan de su propietario.

Los límites provisionales actuales son:

| Plan del propietario | Miembros incluidos por Workspace |
|---|---:|
| Free | 3 |
| Base | 10 |
| Pro | 30 |
| Business | A medida |

El propietario del Workspace cuenta como miembro y consume uno de los asientos incluidos.

Por tanto:

- Free permite al propietario y hasta 2 miembros adicionales;
- Base permite al propietario y hasta 9 miembros adicionales;
- Pro permite al propietario y hasta 29 miembros adicionales.

El límite se aplica individualmente a cada Workspace.

Por ejemplo, un usuario Pro propietario de tres Workspaces dispone de hasta 30 miembros incluidos en cada uno de ellos.

Un miembro ocupa capacidad únicamente dentro de cada Workspace al que pertenece.

La capacidad de un Workspace podrá ampliarse mediante la contratación de asientos adicionales.

Los asientos adicionales se comercializarán mediante packs.

El precio unitario de cada asiento adicional dependerá del plan del propietario:

- en Free será el más alto;
- en Base será inferior al de Free;
- en Pro será inferior al de Base;
- Business podrá utilizar condiciones personalizadas.

Los tamaños concretos de los packs y sus precios todavía no están definidos.

Los asientos adicionales:

- pertenecen al Workspace para el que fueron adquiridos;
- no aumentan el plan personal del propietario;
- no convierten en usuarios de pago a sus miembros;
- no se transfieren automáticamente a otros Workspaces;
- permiten incorporar miembros adicionales al Workspace.

La capacidad total se calcula como:

**miembros incluidos por el plan + asientos adicionales**

Por ejemplo:

Un Workspace Pro dispone de:

- 30 miembros incluidos;
- 10 asientos adicionales.

Su capacidad total será:

**40 miembros**

Cuando todos los asientos estén ocupados, Tickard deberá impedir la incorporación de nuevos miembros.

Para incorporar a otra persona será necesario:

- eliminar a un miembro existente;
- contratar uno o más packs de asientos adicionales;
- o cambiar a un plan que proporcione una capacidad superior.

Eliminar un miembro libera un asiento.

Los usuarios que pertenezcan a Workspaces ajenos no consumen ningún asiento de sus propios Workspaces.

## 6. Archivado de proyectos

El archivado está pensado principalmente para conservar proyectos como histórico o para consulta.

Archivar un proyecto:

- conserva sus datos;
- no elimina el proyecto;
- no reduce el consumo del límite del plan;
- permite mantener organizado el Workspace;
- no puede utilizarse como mecanismo para eludir los límites del plan.

Los detalles exactos sobre las operaciones permitidas dentro de un proyecto archivado se definirán posteriormente.

---

## 7. Cambio a un plan inferior

Un cambio a un plan inferior nunca debe provocar la eliminación automática de información.

Como el plan pertenece al usuario propietario, un downgrade afecta a los Workspaces de los que ese usuario sea propietario.

Cada Workspace deberá comprobar individualmente si supera los nuevos límites.

Por ejemplo:

Ana dispone de Pro.

Uno de sus Workspaces contiene **30 proyectos**.

Ana cambia posteriormente a Base, cuyo límite es de **10 proyectos por Workspace**.

Tickard conservará los 30 proyectos.

El Workspace quedaría temporalmente en una situación como:

**30 / 10 proyectos**

Mientras el número total de proyectos supere el límite del nuevo plan:

- no se podrán crear nuevos proyectos;
- los proyectos existentes no se eliminarán automáticamente;
- los proyectos conservados podrán consultarse;
- el usuario podrá eliminar proyectos para reducir el total;
- el usuario podrá volver a contratar un plan con mayor capacidad.

Si otros Workspaces propiedad de Ana no superan el límite Base, podrán continuar funcionando normalmente.

De esta forma, un downgrade nunca provoca pérdida automática de información.

---

## 8. Selección de proyectos durante un downgrade

Cuando un cambio de plan obligue a reducir el número de proyectos operativos dentro de un Workspace, Tickard debe intentar conservar aquellos que resulten más importantes para el usuario.

Siempre que sea posible, antes de aplicar las restricciones el usuario podrá seleccionar manualmente qué proyectos desea mantener operativos.

La prioridad será:

1. **Selección manual del usuario.**
2. **Proyectos marcados como importantes.**
3. **Actividad reciente.**

Si el usuario realiza una selección manual, esta tendrá prioridad sobre cualquier decisión automática.

Si el usuario no realiza ninguna selección, Tickard seleccionará automáticamente los proyectos que permanecerán operativos.

Primero tendrán prioridad los proyectos marcados como importantes.

Entre proyectos con la misma prioridad se utilizará la actividad reciente.

### Ejemplo

Un Workspace dispone de 30 proyectos mientras su propietario utiliza Pro.

El propietario cambia a Base.

Base permite 10 proyectos operativos por Workspace.

Si existen:

- 4 proyectos importantes;
- 26 proyectos normales;

Tickard conservará primero los 4 proyectos importantes.

Las 6 plazas restantes se asignarán a los proyectos con actividad más reciente.

Los otros 20 proyectos quedarán archivados o limitados a consulta según la política que se defina.

---

## 9. Proyectos importantes

Los proyectos podrán disponer de una marca de **Importante**.

Esta característica tendrá utilidad general dentro de Tickard, permitiendo al usuario destacar proyectos relevantes.

Además, se utilizará como criterio de prioridad cuando sea necesario seleccionar automáticamente qué proyectos permanecen operativos después de un downgrade.

Marcar un proyecto como importante no modifica los límites del plan.

Si existen más proyectos importantes que plazas disponibles, se utilizará la actividad reciente como criterio de desempate.

El nombre técnico y la implementación de esta propiedad todavía no están definidos.

---

## 10. Actividad reciente

La actividad reciente podrá utilizarse para determinar qué proyectos tienen mayor prioridad cuando Tickard tenga que realizar una selección automática.

El criterio exacto para considerar que un proyecto ha tenido actividad todavía está pendiente de definir.

Podría estar relacionado en el futuro con acciones como:

- acceso al proyecto;
- modificación de tarjetas;
- creación de contenido;
- actividad de los miembros.

Estas posibilidades no constituyen todavía una decisión de implementación.

---

## 11. Asientos adicionales y cambios de plan

Los asientos adicionales pertenecen al Workspace y no al plan personal del usuario.

Por tanto, un mismo propietario puede tener:

- un Workspace sin asientos adicionales;
- otro Workspace con 5 asientos adicionales;
- otro Workspace con 20 asientos adicionales.

Los asientos adicionales no se comparten entre ellos.

Cuando el propietario cambia de plan, cambia también la cantidad de miembros incluidos de todos sus Workspaces.

Los asientos adicionales contratados siguen perteneciendo al Workspace correspondiente.

El comportamiento comercial exacto de estos asientos durante upgrades y downgrades todavía debe definirse.

En cualquier caso, un downgrade no debe provocar la eliminación automática de miembros.

Si después de un downgrade un Workspace supera su nueva capacidad de miembros, deberá entrar temporalmente en una situación de exceso de capacidad.

Por ejemplo:

**28 / 20 miembros**

Mientras exista exceso de capacidad:

- los miembros existentes no se eliminarán automáticamente;
- no podrán incorporarse nuevos miembros;
- podrá liberarse capacidad eliminando miembros;
- podrán contratarse asientos adicionales;
- podrá recuperarse un plan con mayor capacidad.

Las restricciones adicionales que puedan aplicarse a un Workspace en exceso de capacidad todavía están pendientes de definir.

---

## 12. Principios de los límites

Los límites de los planes deben seguir los siguientes principios.

### No perder información

Un downgrade nunca debe eliminar automáticamente proyectos, miembros o información del usuario.

### No permitir eludir límites mediante archivado

Los proyectos archivados continúan consumiendo una plaza.

### Los invitados no consumen Workspaces propios

Participar en Workspaces ajenos no reduce la capacidad del usuario para crear los suyos.

### El plan pertenece al propietario

El plan comercial pertenece al usuario propietario.

Los Workspaces propios utilizan las capacidades correspondientes a ese plan.

### Los límites de recursos se aplican por Workspace

Los límites de proyectos y miembros se calculan individualmente para cada Workspace. El almacenamiento tiene **además** un límite compartido de 20 GB entre los Workspaces propios de una cuenta Pro.

### Los miembros consumen capacidad del Workspace

Cada persona incorporada a un Workspace ocupa capacidad dentro de ese Workspace.

### Los asientos adicionales son locales al Workspace

Los asientos adicionales contratados para un Workspace no pueden utilizarse automáticamente en otros Workspaces.

### Los miembros no heredan el plan personal

Trabajar dentro de un Workspace Pro permite utilizar las capacidades Pro de ese Workspace.

Esto no convierte al miembro en usuario Pro ni modifica las capacidades de sus propios Workspaces.

### Business permanece flexible

Business no tendrá necesariamente los mismos límites que los planes estándar y podrá configurarse según las necesidades de cada organización.

---

## 13. Decisiones pendientes

Las siguientes cuestiones todavía no están definidas y no deben asumirse hasta que se tome una decisión explícita:

- precios de los planes;
- facturación mensual o anual;
- período de prueba;
- precio de cada asiento adicional;
- posibles paquetes de asientos;
- facturación mensual o anual de los asientos adicionales;
- tratamiento de los asientos durante upgrades y downgrades;
- posibilidad de cancelar o reducir asientos adicionales;
- precio y condiciones de las ampliaciones de almacenamiento;
- límites de archivos adicionales al máximo actual de 10 MB por archivo;
- funcionalidades adicionales exclusivas de Base;
- funcionalidades adicionales exclusivas de Pro;
- características concretas de Business;
- política de papelera;
- tiempo de conservación antes de una eliminación definitiva;
- período de gracia durante un downgrade;
- gestión de pagos;
- comportamiento comercial de upgrades y downgrades;
- definición técnica de proyecto importante;
- definición técnica de actividad reciente;
- operaciones exactas permitidas sobre proyectos archivados;
- restricciones adicionales aplicables cuando un Workspace supere temporalmente sus límites.

Estas decisiones deberán documentarse cuando se definan y no deben inferirse durante la implementación.
---

## 14. Cuotas de almacenamiento

El almacenamiento se calcula por el **plan del propietario** del Workspace, no por el plan de sus miembros.

| Plan | Capacidad incluida por Workspace | Restricción adicional |
|---|---:|---|
| Free | 200 MB | Un Workspace propio |
| Base | 2 GB | Máximo de cinco Workspaces propios |
| Pro | **20 GB repartidos por defecto a partes iguales** | Máximo de **20 GB acumulados** en los Workspaces propios |
| Business | Configurable | Según condiciones contratadas |

- El límite individual se aplica a la suma de documentos generales y archivos adjuntos de las Cards de todos los proyectos de ese Workspace.
- Pro conserva el derecho a crear Workspaces ilimitados, pero todos ellos comparten un máximo de 20 GB entre sí. Crear un undécimo Workspace **no aumenta** la capacidad incluida de la cuenta.
- La capacidad Pro se divide automáticamente entre el número **real de Workspaces propios** del usuario: 1 = 20 GB, 2 = 10 GB cada uno, 4 = 5 GB, 10 = 2 GB, 20 = 1 GB. Al crear o borrar uno se recalcula la cuota de todos, sin borrar archivos, incluso si algún Workspace queda temporalmente por encima de su nueva capacidad.
- El consumo de Workspaces compartidos con el usuario recae sobre sus propietarios; no se descuenta de la capacidad propia del miembro.
- Cada nueva subida tiene también un máximo de 10 MB y solo admite los tipos autorizados en la sección Archivos.
- La aplicación rechaza nuevas subidas que superarían la cuota del Workspace o el máximo total Pro, sin eliminar los archivos previamente existentes. Si un Workspace ya excede su cuota tras redistribuirla, se bloquean nuevas subidas hasta recuperar espacio.
- Las ampliaciones de pago para Pro, la redistribución personalizada, las reservas de capacidad y su gestión desde Configuración del Workspace **son funcionalidades futuras**.

A efectos técnicos, se usan unidades binarias: 200 MB = 200 × 1024² bytes, 2 GB = 2 × 1024³ bytes y 20 GB = 20 × 1024³ bytes.
