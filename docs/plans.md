# Tickard — Planes

Este documento recoge las decisiones de producto relacionadas con los planes, sus límites y el comportamiento de Tickard cuando dichos límites cambian.

Los precios y otras características comerciales todavía no están definidos.

---

## 1. Planes

### Free

- Máximo de **1 Workspace propio**.
- Máximo de **3 proyectos por Workspace**.
- Puede invitar a otros usuarios a sus Workspaces.
- Puede pertenecer como miembro a otros Workspaces.

Los Workspaces a los que el usuario pertenece como miembro no consumen su límite de Workspaces propios.

---

### Base

- Máximo de **5 Workspaces propios**.
- Máximo de **10 proyectos por Workspace**.
- Puede invitar a otros usuarios a sus Workspaces.
- Puede pertenecer como miembro a otros Workspaces.

El límite de Workspaces evita que la creación de nuevos espacios pueda utilizarse simplemente como mecanismo para eludir el límite de proyectos.

---

### Pro

- **Workspaces propios ilimitados**.
- Máximo de **50 proyectos por Workspace**.
- Puede invitar a otros usuarios a sus Workspaces.
- Puede pertenecer como miembro a otros Workspaces.

Pro no dispone de proyectos ilimitados. El límite actual establecido es de 50 proyectos por Workspace.

---

### Business

Business está orientado a organizaciones cuyas necesidades no encajen correctamente en los planes estándar.

Sus límites y configuración se definirán **a medida** según las necesidades de cada organización.

Las características concretas de Business todavía no están definidas.

---

## 2. Workspaces propios y Workspaces compartidos

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

---

## 3. Límite de proyectos

El límite de proyectos se aplica individualmente a cada Workspace.

Los límites actuales son:

| Plan | Proyectos por Workspace |
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

Un Workspace Free contiene:

- Proyecto A — activo.
- Proyecto B — activo.
- Proyecto C — archivado.

El consumo continúa siendo:

**3 / 3 proyectos**

Archivar el Proyecto C no permite crear un Proyecto D.

Para reducir realmente el número de proyectos existentes será necesario eliminar proyectos definitivamente.

La política concreta de papelera, período de recuperación y eliminación definitiva todavía está pendiente de definir.

---

## 4. Archivado de proyectos

El archivado está pensado principalmente para conservar proyectos como histórico o para consulta.

Archivar un proyecto:

- conserva sus datos;
- no elimina el proyecto;
- no reduce el consumo del límite del plan;
- permite mantener organizado el Workspace;
- no puede utilizarse como mecanismo para eludir los límites del plan.

Los detalles exactos sobre las operaciones permitidas dentro de un proyecto archivado se definirán posteriormente.

---

## 5. Cambio a un plan inferior

Un cambio a un plan inferior nunca debe provocar la eliminación automática de información.

Por ejemplo:

Un Workspace utiliza Pro y contiene **30 proyectos**.

El Workspace cambia posteriormente a Base, cuyo límite es de **10 proyectos**.

Tickard conservará los 30 proyectos, pero solamente podrán permanecer **10 proyectos operativos**.

Los restantes pasarán a estado archivado o de consulta.

El Workspace quedaría temporalmente en una situación como:

**30 / 10 proyectos**

Mientras el número total de proyectos supere el límite del plan:

- no se podrán crear nuevos proyectos;
- los proyectos existentes no se eliminarán automáticamente;
- los proyectos conservados podrán consultarse;
- el usuario podrá eliminar proyectos para reducir el total;
- el usuario podrá volver a contratar un plan con mayor capacidad.

De esta forma, un downgrade nunca provoca pérdida automática de información.

---

## 6. Selección de proyectos durante un downgrade

Cuando un cambio de plan obligue a reducir el número de proyectos operativos, Tickard debe intentar conservar aquellos que resulten más importantes para el usuario.

Siempre que sea posible, antes de aplicar el cambio el usuario podrá seleccionar manualmente qué proyectos desea mantener operativos.

La prioridad será:

1. **Selección manual del usuario.**
2. **Proyectos marcados como importantes.**
3. **Actividad reciente.**

Si el usuario realiza una selección manual, esta tendrá prioridad sobre cualquier decisión automática.

Si el usuario no realiza ninguna selección, Tickard seleccionará automáticamente los proyectos que permanecerán operativos.

Primero tendrán prioridad los proyectos marcados como importantes.

Entre proyectos con la misma prioridad se utilizará la actividad reciente.

### Ejemplo

Un Workspace Pro tiene 30 proyectos y cambia a Base.

Base permite 10 proyectos operativos.

Si existen:

- 4 proyectos importantes;
- 26 proyectos normales;

Tickard conservará primero los 4 proyectos importantes.

Las 6 plazas restantes se asignarán a los proyectos con actividad más reciente.

Los otros 20 proyectos quedarán archivados.

---

## 7. Proyectos importantes

Los proyectos podrán disponer de una marca de **Importante**.

Esta característica tendrá utilidad general dentro de Tickard, permitiendo al usuario destacar proyectos relevantes.

Además, se utilizará como criterio de prioridad cuando sea necesario seleccionar automáticamente qué proyectos permanecen operativos después de un downgrade.

Marcar un proyecto como importante no modifica los límites del plan.

Si existen más proyectos importantes que plazas disponibles, se utilizará la actividad reciente como criterio de desempate.

El nombre técnico y la implementación de esta propiedad todavía no están definidos.

---

## 8. Actividad reciente

La actividad reciente podrá utilizarse para determinar qué proyectos tienen mayor prioridad cuando Tickard tenga que realizar una selección automática.

El criterio exacto para considerar que un proyecto ha tenido actividad todavía está pendiente de definir.

Podría estar relacionado en el futuro con acciones como:

- acceso al proyecto;
- modificación de tarjetas;
- creación de contenido;
- actividad de los miembros.

Estas posibilidades no constituyen todavía una decisión de implementación.

---

## 9. Principios de los límites

Los límites de los planes deben seguir los siguientes principios:

### No perder información

Un downgrade nunca debe eliminar automáticamente proyectos o información del usuario.

### No permitir eludir límites mediante archivado

Los proyectos archivados continúan consumiendo una plaza.

### Los invitados no consumen Workspaces propios

Participar en Workspaces ajenos no reduce la capacidad del usuario para crear los suyos.

### Los límites se aplican por Workspace

El límite de proyectos corresponde individualmente a cada Workspace.

### Business permanece flexible

Business no tendrá necesariamente los mismos límites que los planes estándar y podrá configurarse según las necesidades de cada organización.

---

## 10. Decisiones pendientes

Las siguientes cuestiones todavía no están definidas y no deben asumirse hasta que se tome una decisión explícita:

- precios de los planes;
- facturación mensual o anual;
- período de prueba;
- límites de miembros;
- límites de almacenamiento;
- límites de archivos;
- funcionalidades adicionales exclusivas de Base;
- funcionalidades adicionales exclusivas de Pro;
- características concretas de Business;
- política de papelera;
- tiempo de conservación antes de una eliminación definitiva;
- período de gracia durante un downgrade;
- gestión de pagos;
- facturación por miembros o seats;
- comportamiento comercial de upgrades y downgrades;
- definición técnica de proyecto importante;
- definición técnica de actividad reciente;
- operaciones exactas permitidas sobre proyectos archivados.

Estas decisiones deberán documentarse cuando se definan y no deben inferirse durante la implementación.