<?php

namespace Database\Seeders;

use App\Models\Board;
use App\Models\Card;
use App\Models\CardAttachment;
use App\Models\CardDependency;
use App\Models\CardModule;
use App\Models\ClientCompany;
use App\Models\Comment;
use App\Models\CommentReaction;
use App\Models\Project;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Support\CardDependencyService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Nébula Mobile
 * -------------
 * Dataset permanente de demostración y estrés de Tickard.
 *
 * Objetivos:
 * - ~190 Cards repartidas en 12 Boards y varios años.
 * - progreso REAL calculado desde checklist items (done / total).
 * - semántica workflow coherente con Tickard.
 * - módulos, checklists, comentarios, hilos, reacciones y adjuntos.
 * - usuarios, equipos, etiquetas y asignaciones variadas.
 * - dependencias FS / SS / FF / SF creadas mediante CardDependencyService.
 * - dependencias entre Boards del mismo Project.
 * - datos reproducibles mediante updateOrCreate().
 *
 * IMPORTANTE:
 * - Esta seeder NO está añadida a DatabaseSeeder de forma intencionada.
 * - Revisarla y validarla antes de activarla.
 */
class NebulaMobileDemoSeeder extends Seeder
{
    private const PROJECT = 'Nébula Mobile';
    private const WORKSPACE = 'Tickard Demo';

    /** @var array<string, User> */
    private array $people = [];

    /** @var array<string, Team> */
    private array $teams = [];

    /** @var array<string, Card> */
    private array $cards = [];

    private int $globalCardIndex = 0;

    public function run(): void
    {
        DB::transaction(function (): void {
            $this->preparePeople();

            $owner = $this->people['ana'];

            $workspace = Workspace::updateOrCreate(
                ['name' => self::WORKSPACE],
                [
                    'owner_id' => $owner->id,
                    'extra_seats' => 25,
                ],
            );

            $this->prepareWorkspaceMembers($workspace);
            $this->prepareTeams($workspace);

            $client = ClientCompany::updateOrCreate(
                [
                    'workspace_id' => $workspace->id,
                    'name' => 'Aster Labs',
                ],
                [],
            );

            $project = Project::updateOrCreate(
                [
                    'workspace_id' => $workspace->id,
                    'name' => self::PROJECT,
                ],
                [
                    'client_company_id' => $client->id,
                    'show_description' => true,
                    'show_assignee' => true,
                    'show_due_date' => true,
                    'show_priority' => true,
                    'show_labels' => true,
                    'show_comments' => true,
                ],
            );

            $this->prepareProjectMembers($project);
            $this->prepareLabels($project);
            $this->removeLegacyDemoBoards($project);

            foreach ($this->plan() as $boardPosition => $phase) {
                $board = $this->prepareBoard($project, $phase['name'], $boardPosition);

                foreach ($phase['groups'] as $groupPosition => $group) {
                    $category = $board->categories()->updateOrCreate(
                        ['name' => $group['name']],
                        ['position' => $groupPosition],
                    );

                    foreach ($group['tasks'] as $taskPosition => $task) {
                        $this->seedCard(
                            $project,
                            $board,
                            $category->id,
                            $phase['index'],
                            $group['name'],
                            $task,
                            $taskPosition,
                        );
                    }
                }
            }

            $this->seedDependencies(app(CardDependencyService::class));
        });
    }

    private function preparePeople(): void
    {
        $definitions = [
            'ana' => ['Ana Ruiz', 'ana@gestor.test'],
            'luis' => ['Luis Pérez', 'luis@gestor.test'],
            'marta' => ['Marta Gil', 'marta@gestor.test'],
            'elena' => ['Elena Soto', 'elena@gestor.test'],
            'diego' => ['Diego Castro', 'diego.nebula@gestor.test'],
            'sofia' => ['Sofía Vidal', 'sofia.nebula@gestor.test'],
            'pablo' => ['Pablo Méndez', 'pablo.nebula@gestor.test'],
            'irene' => ['Irene Lago', 'irene.nebula@gestor.test'],
            'noa' => ['Noa Fernández', 'noa.nebula@gestor.test'],
            'hugo' => ['Hugo Varela', 'hugo.nebula@gestor.test'],
            'lara' => ['Lara Iglesias', 'lara.nebula@gestor.test'],
            'bruno' => ['Bruno Silva', 'bruno.nebula@gestor.test'],
            'clara' => ['Clara Ríos', 'clara.nebula@gestor.test'],
            'marcos' => ['Marcos Rey', 'marcos.nebula@gestor.test'],
            'vera' => ['Vera López', 'vera.nebula@gestor.test'],
        ];

        foreach ($definitions as $key => [$name, $email]) {
            $this->people[$key] = User::updateOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'password' => 'password',
                    'plan' => User::PLAN_BASE,
                ],
            );
        }
    }

    private function prepareWorkspaceMembers(Workspace $workspace): void
    {
        foreach ($this->people as $key => $person) {
            $workspace->memberships()->updateOrCreate(
                ['user_id' => $person->id],
                ['role' => $key === 'ana' ? 'owner' : 'member'],
            );
        }
    }

    private function prepareTeams(Workspace $workspace): void
    {
        $definitions = [
            'Producto' => ['ana', 'elena', 'clara'],
            'Diseño' => ['marta', 'sofia'],
            'Frontend' => ['ana', 'diego', 'noa'],
            'Backend' => ['luis', 'pablo', 'marcos'],
            'QA' => ['irene', 'lara'],
            'DevOps' => ['hugo', 'bruno'],
            'Datos' => ['vera', 'pablo'],
            'Marketing' => ['clara', 'elena'],
            'Seguridad' => ['marcos', 'irene'],
            'Integraciones' => ['pablo', 'diego', 'vera'],
        ];

        foreach ($definitions as $name => $keys) {
            $team = Team::updateOrCreate(
                [
                    'workspace_id' => $workspace->id,
                    'name' => $name,
                ],
                [],
            );

            $team->members()->sync(
                array_map(fn (string $key) => $this->people[$key]->id, $keys),
            );

            $this->teams[$name] = $team;
        }
    }

    private function prepareProjectMembers(Project $project): void
    {
        foreach ($this->people as $key => $person) {
            $role = match ($key) {
                'ana' => 'responsable',
                'elena' => 'cliente',
                default => 'editor',
            };

            $project->members()->updateOrCreate(
                ['user_id' => $person->id],
                ['role' => $role],
            );
        }
    }

    private function prepareLabels(Project $project): void
    {
        $labels = [
            'Producto' => 'niebla',
            'Diseño' => 'ciruela',
            'Frontend' => 'bosque',
            'Backend' => 'bambu',
            'QA' => 'arena',
            'DevOps' => 'tinta',
            'Seguridad' => 'ciruela',
            'Datos' => 'bambu',
            'Marketing' => 'arena',
            'Móvil' => 'bosque',
            'Integraciones' => 'niebla',
            'Rendimiento' => 'tinta',
            'Accesibilidad' => 'ciruela',
            'Premium' => 'arena',
        ];

        foreach ($labels as $name => $tone) {
            $project->labels()->updateOrCreate(
                ['name' => $name],
                ['tone' => $tone],
            );
        }
    }

    /**
     * Evita que sobrevivan Boards exclusivos del antiguo GanttDemoSeeder
     * cuando esta seeder se prueba sobre una BD donde ya existía Nébula Mobile.
     */
    private function removeLegacyDemoBoards(Project $project): void
    {
        $legacy = [
            '01 · Descubrimiento y UX',
            '03 · Beta y estabilización',
            '04 · Lanzamiento',
        ];

        $project->boards()
            ->whereIn('name', $legacy)
            ->get()
            ->each(fn (Board $board) => $board->delete());
    }

    private function prepareBoard(Project $project, string $name, int $position): Board
    {
        $board = $project->boards()->updateOrCreate(
            ['name' => $name],
            ['position' => $position],
        );

        if ($board->columns()->count() === 0) {
            $board->createDefaultColumns();
        }

        $colors = [
            'Backlog' => '#8B98A5',
            'Por hacer' => '#4C8BF5',
            'En progreso' => '#F39C4A',
            'En revisión' => '#9B6BE8',
            'Completado' => '#38A37A',
        ];

        foreach ($board->columns as $column) {
            $column->update([
                'color' => $colors[$column->name] ?? $column->color,
            ]);
        }

        return $board->fresh(['columns', 'categories']);
    }

    /**
     * 12 Boards x 2 categorías x 8 Cards = 192 Cards.
     *
     * Las fechas son absolutas para que el Gantt sea reproducible.
     */
    private function plan(): array
    {
        $definitions = [
            ['01 · Descubrimiento y estrategia', '2026-08-31', [
                'Investigación' => [
                    'Definir visión y objetivos de Nébula',
                    'Entrevistar usuarios frecuentes',
                    'Analizar competidores y oportunidades',
                    'Definir personas y escenarios de uso',
                    'Priorizar alcance del MVP',
                    'Definir métricas de éxito',
                    'Preparar roadmap inicial',
                    'Validar hipótesis con Aster Labs',
                ],
                'Arquitectura' => [
                    'Seleccionar stack móvil y API',
                    'Diseñar arquitectura de servicios',
                    'Definir modelo de datos inicial',
                    'Diseñar estrategia de autenticación',
                    'Definir política de permisos',
                    'Planificar observabilidad técnica',
                    'Documentar decisiones de arquitectura',
                    'Preparar estrategia de entornos',
                ],
            ]],
            ['02 · Experiencia y diseño', '2026-09-21', [
                'UX' => [
                    'Mapear flujos de registro y acceso',
                    'Diseñar navegación principal',
                    'Prototipar itinerarios colaborativos',
                    'Diseñar flujo de gastos compartidos',
                    'Definir estados vacíos y errores',
                    'Validar accesibilidad y contraste',
                    'Realizar pruebas de usabilidad',
                    'Ajustar prototipo tras feedback',
                ],
                'Sistema visual' => [
                    'Definir tokens y tipografía',
                    'Construir biblioteca de componentes',
                    'Preparar iconografía e ilustraciones',
                    'Diseñar variantes responsive',
                    'Documentar formularios y validaciones',
                    'Definir motion y microinteracciones',
                    'Preparar handoff para desarrollo',
                    'Auditar consistencia visual',
                ],
            ]],
            ['03 · Desarrollo MVP', '2026-10-05', [
                'Cuenta y acceso' => [
                    'Implementar registro e inicio de sesión',
                    'Recuperación y cambio de contraseña',
                    'Perfil avatar y preferencias',
                    'Permisos y sesiones multidispositivo',
                    'Onboarding de nuevos usuarios',
                    'Cierre remoto de sesiones',
                    'Gestión de consentimiento y privacidad',
                    'Historial básico de accesos',
                ],
                'Viajes y gastos' => [
                    'Crear y editar viaje',
                    'Invitar participantes al viaje',
                    'Gestionar roles de participantes',
                    'Itinerario colaborativo',
                    'Calendario y actividades del viaje',
                    'Registrar gastos y justificantes',
                    'Calcular balances entre participantes',
                    'Exportar resumen de gastos',
                ],
            ]],
            ['04 · QA beta y estabilización', '2027-01-04', [
                'Calidad' => [
                    'Preparar estrategia de pruebas',
                    'Automatizar pruebas de autenticación',
                    'Ejecutar pruebas E2E de viajes',
                    'Validar balances y cálculos de gastos',
                    'Revisar accesibilidad móvil',
                    'Pruebas exploratorias de la beta',
                    'Preparar matriz de regresión',
                    'Cerrar defectos críticos de beta',
                ],
                'Rendimiento y seguridad' => [
                    'Optimizar arranque y navegación',
                    'Reducir consultas y tiempos de API',
                    'Ejecutar auditoría de seguridad',
                    'Pruebas de carga concurrente',
                    'Revisar almacenamiento seguro local',
                    'Auditar permisos de dispositivos',
                    'Definir presupuestos de rendimiento',
                    'Ensayar recuperación ante fallos',
                ],
            ]],
            ['05 · Lanzamiento 1.0', '2027-03-01', [
                'Infraestructura' => [
                    'Preparar entornos de producción',
                    'Configurar monitorización y alertas',
                    'Automatizar despliegues y rollback',
                    'Validar copias de seguridad',
                    'Configurar CDN para adjuntos',
                    'Preparar panel de salud del servicio',
                    'Definir guardias de lanzamiento',
                    'Ejecutar simulacro de caída',
                ],
                'Publicación' => [
                    'Preparar ficha de Google Play',
                    'Preparar ficha de App Store',
                    'Validar release candidate',
                    'Publicar Nébula Mobile 1.0',
                    'Monitorizar primera semana',
                    'Responder reseñas iniciales',
                    'Analizar embudo de activación',
                    'Preparar retrospectiva de lanzamiento',
                ],
            ]],
            ['06 · Evolución 1.1 y comunidad', '2027-05-03', [
                'Experiencia' => [
                    'Analizar feedback del lanzamiento',
                    'Mejorar búsqueda y filtros de viajes',
                    'Añadir plantillas de itinerarios',
                    'Implementar modo sin conexión básico',
                    'Optimizar sincronización en segundo plano',
                    'Añadir favoritos y guardados',
                    'Mejorar gestión de documentos',
                    'Rediseñar panel de actividad',
                ],
                'Comunidad' => [
                    'Perfiles públicos y privacidad',
                    'Compartir itinerarios públicos',
                    'Valoraciones y recomendaciones',
                    'Moderación y denuncias',
                    'Seguir a otros viajeros',
                    'Colecciones colaborativas',
                    'Sistema de reputación básico',
                    'Herramientas para community managers',
                ],
            ]],
            ['07 · Expansión internacional', '2027-09-06', [
                'Localización' => [
                    'Preparar internacionalización de interfaz',
                    'Traducir contenido a inglés',
                    'Traducir contenido a portugués',
                    'Adaptar fechas zonas horarias y formatos',
                    'Gestionar divisas internacionales',
                    'Validar flujos multilingües',
                    'Localizar emails transaccionales',
                    'Preparar guía de traducción continua',
                ],
                'Crecimiento' => [
                    'Diseñar campañas de adquisición',
                    'Crear programa de invitaciones',
                    'Analizar cohortes de retención',
                    'Experimentar con onboarding A B',
                    'Diseñar landing pages regionales',
                    'Automatizar campañas de reactivación',
                    'Crear panel de growth',
                    'Medir atribución multicanal',
                ],
            ]],
            ['08 · Plataforma premium', '2028-01-10', [
                'Suscripciones' => [
                    'Definir catálogo de planes premium',
                    'Diseñar experiencia de suscripción',
                    'Integrar pasarela de pagos',
                    'Gestionar renovaciones y cancelaciones',
                    'Emitir facturas y gestionar impuestos',
                    'Auditar seguridad de pagos',
                    'Implementar periodos de prueba',
                    'Gestionar recuperación de pagos',
                ],
                'Funcionalidades avanzadas' => [
                    'Planificador avanzado de rutas',
                    'Presupuestos y alertas inteligentes',
                    'Exportación avanzada de itinerarios',
                    'Panel de estadísticas personales',
                    'Mapas sin conexión premium',
                    'Automatizaciones de viaje',
                    'Biblioteca premium de plantillas',
                    'Resumen anual de viajes',
                ],
            ]],
            ['09 · Integraciones y ecosistema', '2028-06-03', [
                'Integraciones' => [
                    'Integrar calendarios externos',
                    'Integrar mapas y geolocalización',
                    'Sincronizar reservas y confirmaciones',
                    'Publicar API para integradores',
                    'Desarrollar webhooks y reintentos',
                    'Integrar proveedor meteorológico',
                    'Conectar importación de correo',
                    'Crear sandbox para integradores',
                ],
                'Partners' => [
                    'Definir programa de socios',
                    'Crear portal para colaboradores',
                    'Construir panel de métricas B2B',
                    'Realizar piloto con agencias',
                    'Diseñar onboarding de partners',
                    'Preparar contratos y permisos',
                    'Automatizar reporting de partners',
                    'Abrir marketplace de integraciones',
                ],
            ]],
            ['10 · Escalabilidad y datos', '2028-10-01', [
                'Infraestructura' => [
                    'Separar procesos asíncronos y colas',
                    'Optimizar almacenamiento de adjuntos',
                    'Diseñar escalado horizontal de API',
                    'Implementar caché y observabilidad',
                    'Ensayar recuperación ante desastres',
                    'Particionar trabajos de sincronización',
                    'Reducir coste por usuario activo',
                    'Preparar pruebas de capacidad 10x',
                ],
                'Analítica' => [
                    'Consolidar eventos de producto',
                    'Construir modelos de métricas',
                    'Crear panel de KPIs ejecutivos',
                    'Validar privacidad y retención de datos',
                    'Implementar calidad de datos',
                    'Crear diccionario de métricas',
                    'Automatizar detección de anomalías',
                    'Preparar dataset para experimentación',
                ],
            ]],
            ['11 · Rediseño Nébula 2.0', '2029-02-05', [
                'Investigación y diseño' => [
                    'Investigar necesidades de usuarios veteranos',
                    'Redefinir arquitectura de información',
                    'Diseñar nuevo sistema visual 2.0',
                    'Probar prototipos de navegación',
                    'Rediseñar experiencia de viajes',
                    'Validar nuevo patrón de colaboración',
                    'Preparar migración de componentes',
                    'Cerrar especificación UX 2.0',
                ],
                'Implementación' => [
                    'Migrar navegación a la versión 2.0',
                    'Refactorizar módulos móviles',
                    'Compatibilizar API y clientes antiguos',
                    'Ejecutar regresión funcional completa',
                    'Migrar sistema de temas',
                    'Actualizar analítica del nuevo flujo',
                    'Preparar migración progresiva',
                    'Publicar Nébula Mobile 2.0',
                ],
            ]],
            ['12 · Operación y roadmap 2030', '2029-08-05', [
                'Operación' => [
                    'Monitorizar estabilidad post 2.0',
                    'Optimizar costes de infraestructura',
                    'Revisar cumplimiento y seguridad anual',
                    'Auditar satisfacción y soporte',
                    'Revisar acuerdos de nivel de servicio',
                    'Actualizar runbooks operativos',
                    'Planificar capacidad anual',
                    'Cerrar deuda técnica prioritaria',
                ],
                'Futuro' => [
                    'Investigar asistente inteligente de viajes',
                    'Definir roadmap de producto 2030',
                    'Preparar presupuesto y capacidad 2030',
                    'Evaluar integraciones futuras',
                    'Explorar recomendaciones predictivas',
                    'Evaluar experiencias de realidad aumentada',
                    'Investigar colaboración empresarial',
                    'Preparar visión Nébula 3.0',
                ],
            ]],
        ];

        $result = [];

        foreach ($definitions as $phaseIndex => [$name, $phaseStart, $groups]) {
            $result[] = [
                'index' => $phaseIndex,
                'name' => $name,
                'groups' => $this->buildGroups($phaseIndex, $phaseStart, $groups),
            ];
        }

        return $result;
    }

    private function buildGroups(int $phaseIndex, string $phaseStart, array $groups): array
    {
        $result = [];

        foreach (array_values($groups) as $groupIndex => $titles) {
            $groupName = array_keys($groups)[$groupIndex];
            $groupStart = CarbonImmutable::parse($phaseStart)->addDays($groupIndex * 28);
            $tasks = [];

            foreach ($titles as $taskIndex => $title) {
                $state = $this->stateFor($phaseIndex, $taskIndex, $groupIndex);
                $duration = [5, 8, 13, 21, 10, 16, 7, 24][($taskIndex + $phaseIndex) % 8];
                $start = $state === 'backlog'
                    ? null
                    : $groupStart->addDays($taskIndex * 9);
                $end = $start?->addDays($duration - 1);

                $total = [3, 5, 7, 8, 10, 12, 15, 20][($taskIndex + $groupIndex + $phaseIndex) % 8];
                $done = $this->doneCountFor($state, $total, $taskIndex, $phaseIndex);

                $owner = $this->ownerFor($title, $taskIndex, $phaseIndex);
                $label = $this->labelFor($title, $owner);

                $tasks[] = [
                    'title' => $title,
                    'state' => $state,
                    'start' => $start?->toDateString(),
                    'end' => $end?->toDateString(),
                    'checklist_total' => $total,
                    'checklist_done' => $done,
                    'owner' => $owner,
                    'label' => $label,
                    'group' => $groupName,
                ];
            }

            $result[] = [
                'name' => $groupName,
                'tasks' => $tasks,
            ];
        }

        return $result;
    }

    private function stateFor(int $phaseIndex, int $taskIndex, int $groupIndex): string
    {
        if ($phaseIndex === 0) {
            return $taskIndex <= 5 ? 'done' : 'review';
        }

        if ($phaseIndex === 1) {
            return match (true) {
                $taskIndex <= 2 => 'done',
                $taskIndex <= 4 => 'review',
                default => 'in_progress',
            };
        }

        if ($phaseIndex === 2) {
            return match (true) {
                $taskIndex <= 2 => 'in_progress',
                $taskIndex <= 6 => 'pending',
                default => 'backlog',
            };
        }

        if ($phaseIndex === 3 && $groupIndex === 0) {
            return $taskIndex <= 1 ? 'in_progress' : ($taskIndex === 7 ? 'backlog' : 'pending');
        }

        // Fases futuras: planificadas, dejando una Card de backlog por categoría.
        return $taskIndex === 7 ? 'backlog' : 'pending';
    }

    private function doneCountFor(string $state, int $total, int $taskIndex, int $phaseIndex): int
    {
        if (in_array($state, ['review', 'done'], true)) {
            return $total;
        }

        if (in_array($state, ['pending', 'backlog'], true)) {
            return 0;
        }

        // Progreso real, deliberadamente irregular.
        $fractions = [0.17, 0.28, 0.41, 0.53, 0.66, 0.74, 0.82, 0.91];
        $fraction = $fractions[($taskIndex + $phaseIndex) % count($fractions)];

        return max(1, min($total - 1, (int) floor($total * $fraction)));
    }

    private function ownerFor(string $title, int $taskIndex, int $phaseIndex): string
    {
        $titleLower = mb_strtolower($title);

        $rules = [
            'seguridad' => 'marcos',
            'auditar' => 'irene',
            'pruebas' => 'lara',
            'qa' => 'irene',
            'diseñ' => 'marta',
            'visual' => 'sofia',
            'api' => 'luis',
            'datos' => 'vera',
            'métric' => 'vera',
            'infraestructura' => 'hugo',
            'desplieg' => 'bruno',
            'monitor' => 'hugo',
            'marketing' => 'clara',
            'campaña' => 'clara',
            'partner' => 'elena',
            'pago' => 'pablo',
            'frontend' => 'diego',
            'móvil' => 'noa',
        ];

        foreach ($rules as $needle => $owner) {
            if (str_contains($titleLower, $needle)) {
                return $owner;
            }
        }

        $rotation = [
            'ana', 'luis', 'marta', 'diego', 'pablo', 'noa',
            'irene', 'sofia', 'hugo', 'clara', 'marcos', 'vera',
        ];

        return $rotation[($taskIndex + $phaseIndex) % count($rotation)];
    }

    private function labelFor(string $title, string $owner): string
    {
        $titleLower = mb_strtolower($title);

        return match (true) {
            str_contains($titleLower, 'seguridad'),
            str_contains($titleLower, 'privacidad'),
            str_contains($titleLower, 'permiso') => 'Seguridad',

            str_contains($titleLower, 'prueba'),
            str_contains($titleLower, 'regresión'),
            str_contains($titleLower, 'defecto') => 'QA',

            str_contains($titleLower, 'infraestructura'),
            str_contains($titleLower, 'desplieg'),
            str_contains($titleLower, 'monitor'),
            str_contains($titleLower, 'capacidad'),
            str_contains($titleLower, 'caída') => 'DevOps',

            str_contains($titleLower, 'diseñ'),
            str_contains($titleLower, 'ux'),
            str_contains($titleLower, 'visual'),
            str_contains($titleLower, 'prototipo') => 'Diseño',

            str_contains($titleLower, 'métric'),
            str_contains($titleLower, 'datos'),
            str_contains($titleLower, 'analítica'),
            str_contains($titleLower, 'cohort') => 'Datos',

            str_contains($titleLower, 'campaña'),
            str_contains($titleLower, 'landing'),
            str_contains($titleLower, 'adquisición'),
            str_contains($titleLower, 'reseña') => 'Marketing',

            str_contains($titleLower, 'api'),
            str_contains($titleLower, 'backend'),
            str_contains($titleLower, 'modelo'),
            str_contains($titleLower, 'autenticación'),
            str_contains($titleLower, 'sincroniz') => 'Backend',

            $owner === 'diego' || $owner === 'noa' => 'Frontend',
            default => 'Producto',
        };
    }

    private function seedCard(
        Project $project,
        Board $board,
        int $categoryId,
        int $phaseIndex,
        string $groupName,
        array $task,
        int $position,
    ): void {
        $this->globalCardIndex++;

        $columnName = match ($task['state']) {
            'backlog' => 'Backlog',
            'pending' => 'Por hacer',
            'in_progress' => 'En progreso',
            'review' => 'En revisión',
            'done' => 'Completado',
        };

        $column = $board->columns()->where('name', $columnName)->firstOrFail();
        $creator = $this->people[$task['owner']];

        $description = $this->descriptionFor(
            $task['title'],
            $board->name,
            $groupName,
            $this->globalCardIndex,
        );

        $startedAt = null;
        $completedAt = null;

        if (in_array($task['state'], ['in_progress', 'review', 'done'], true) && $task['start']) {
            $startedAt = $task['start'].' 09:00:00';
        }

        if (in_array($task['state'], ['review', 'done'], true) && $task['end']) {
            $completedAt = $task['end'].' 18:00:00';
        }

        $card = $board->cards()->updateOrCreate(
            ['title' => $task['title']],
            [
                'column_id' => $column->id,
                'category_id' => $categoryId,
                'description' => $description,
                'start_date' => $task['state'] === 'backlog' ? null : $task['start'],
                'due_date' => $task['state'] === 'backlog' ? null : $task['end'],
                'started_at' => $startedAt,
                'completed_at' => $completedAt,
                'priority' => $this->priorityFor($task['title'], $position, $phaseIndex),
                'color' => $this->colorFor($task['label']),
                'is_internal' => $this->globalCardIndex % 29 === 0,
                'position' => $position,
                'created_by' => $creator->id,
                'archived_at' => null,
            ],
        );

        $this->syncAssignees($card, $task, $phaseIndex, $position);
        $this->syncLabels($project, $card, $task, $phaseIndex, $position);
        $this->syncTeams($card, $task, $phaseIndex, $position);
        $this->seedModules($card, $task, $creator);
        $this->seedComments($card, $task, $creator);

        if ($this->globalCardIndex % 12 === 0) {
            $this->seedAttachments($card, $creator);
        }

        $card->activities()->updateOrCreate(
            [
                'type' => 'created',
                'user_id' => $creator->id,
            ],
            [
                'meta' => ['title' => $card->title],
            ],
        );

        $this->cards[$task['title']] = $card->fresh(['column']);
    }

    private function descriptionFor(string $title, string $board, string $group, int $index): ?string
    {
        if ($index % 23 === 0) {
            return null;
        }

        $base = "**Objetivo:** {$title}.\n\n"
            ."**Contexto:** Nébula Mobile / {$board} / {$group}.\n\n"
            ."**Alcance:** analizar requisitos, implementar la solución acordada, "
            ."validar casos normales y extremos y dejar evidencias en las checklists.\n\n"
            ."**Criterios de aceptación:** comportamiento verificable, ausencia de errores "
            ."críticos, revisión del responsable y documentación actualizada.";

        if ($index % 17 === 0) {
            $base .= "\n\n**Notas ampliadas para prueba de UI:** esta Card contiene una descripción "
                ."deliberadamente larga para validar scroll, saltos de línea, Markdown, densidad visual "
                ."y comportamiento del modal en resoluciones pequeñas. También debe permitir comprobar "
                ."que los bloques extensos no desplazan acciones importantes ni rompen el layout.";
        }

        return $base;
    }

    private function priorityFor(string $title, int $position, int $phaseIndex): string
    {
        if (str_contains($title, 'Publicar') || str_contains($title, 'críticos')) {
            return 'urgente';
        }

        return match (($position + $phaseIndex) % 4) {
            0 => 'alta',
            1 => 'media',
            2 => 'baja',
            default => 'media',
        };
    }

    private function colorFor(string $label): string
    {
        return [
            'Producto' => '#5B8DEF',
            'Diseño' => '#9B6BE8',
            'Frontend' => '#38A37A',
            'Backend' => '#4C8BF5',
            'QA' => '#D9A441',
            'DevOps' => '#596275',
            'Seguridad' => '#B06AD8',
            'Datos' => '#37A98C',
            'Marketing' => '#E15D7C',
            'Móvil' => '#16A085',
            'Integraciones' => '#7A6FF0',
            'Rendimiento' => '#3FA7A3',
        ][$label] ?? '#5B8DEF';
    }

    private function syncAssignees(Card $card, array $task, int $phaseIndex, int $position): void
    {
        $keys = [$task['owner']];

        $rotation = ['ana', 'luis', 'marta', 'diego', 'pablo', 'noa', 'irene', 'sofia', 'hugo', 'clara', 'marcos', 'vera'];

        if ($this->globalCardIndex % 4 === 0) {
            $keys[] = $rotation[($phaseIndex + $position + 2) % count($rotation)];
        }

        if ($this->globalCardIndex % 19 === 0) {
            $keys[] = $rotation[($phaseIndex + $position + 5) % count($rotation)];
            $keys[] = $rotation[($phaseIndex + $position + 8) % count($rotation)];
        }

        if ($this->globalCardIndex % 47 === 0) {
            // Caso deliberado sin responsables para probar estados vacíos.
            $card->assignees()->sync([]);
            return;
        }

        $ids = collect(array_unique($keys))
            ->map(fn (string $key) => $this->people[$key]->id)
            ->values()
            ->all();

        $card->assignees()->sync($ids);
    }

    private function syncLabels(Project $project, Card $card, array $task, int $phaseIndex, int $position): void
    {
        $names = [$task['label']];

        $secondary = ['Producto', 'Móvil', 'Integraciones', 'Rendimiento', 'Accesibilidad', 'Premium'];

        if ($this->globalCardIndex % 3 === 0) {
            $names[] = $secondary[($phaseIndex + $position) % count($secondary)];
        }

        if ($this->globalCardIndex % 14 === 0) {
            $names[] = 'QA';
        }

        $ids = $project->labels()
            ->whereIn('name', array_unique($names))
            ->pluck('id')
            ->all();

        $card->labels()->sync($ids);
    }

    private function syncTeams(Card $card, array $task, int $phaseIndex, int $position): void
    {
        $team = isset($this->teams[$task['label']])
            ? $task['label']
            : match ($task['label']) {
                'Seguridad' => 'Seguridad',
                'Integraciones' => 'Integraciones',
                default => 'Producto',
            };

        $ids = [$this->teams[$team]->id];

        if ($this->globalCardIndex % 11 === 0) {
            $extra = ['Producto', 'Diseño', 'Frontend', 'Backend', 'QA', 'DevOps', 'Datos', 'Marketing'];
            $extraName = $extra[($phaseIndex + $position) % count($extra)];
            $ids[] = $this->teams[$extraName]->id;
        }

        $card->teams()->sync(array_values(array_unique($ids)));
    }

    /**
     * Distribuye entre 3 y 20 tareas reales en 1-3 módulos.
     * El porcentaje NO se almacena: CardPresenter lo deriva de is_done.
     */
    private function seedModules(Card $card, array $task, User $owner): void
    {
        $total = (int) $task['checklist_total'];
        $done = (int) $task['checklist_done'];

        $moduleTitles = $total <= 5
            ? ['Ejecución']
            : ($total <= 12
                ? ['Análisis y preparación', 'Implementación y validación']
                : ['Análisis', 'Implementación', 'Validación y cierre']);

        $baseItems = [
            'Revisar requisitos y alcance',
            'Confirmar criterios de aceptación',
            'Identificar riesgos y dependencias',
            'Preparar diseño técnico o funcional',
            'Implementar flujo principal',
            'Cubrir estados vacíos',
            'Cubrir estados de error',
            'Validar permisos y restricciones',
            'Añadir pruebas automatizadas',
            'Ejecutar pruebas manuales',
            'Validar integración',
            'Revisar accesibilidad',
            'Revisar rendimiento',
            'Actualizar documentación',
            'Preparar evidencias',
            'Realizar revisión cruzada',
            'Resolver observaciones',
            'Validar analítica y métricas',
            'Verificar comportamiento responsive',
            'Cerrar criterios de aceptación',
        ];

        $sizes = $this->splitCount($total, count($moduleTitles));
        $globalOffset = 0;

        foreach ($moduleTitles as $modulePosition => $moduleTitle) {
            $module = $card->modules()->updateOrCreate(
                [
                    'type' => CardModule::TYPE_CHECKLIST,
                    'title' => $moduleTitle,
                ],
                ['position' => $modulePosition],
            );

            $expectedBodies = [];

            for ($i = 0; $i < $sizes[$modulePosition]; $i++) {
                $body = $baseItems[$globalOffset % count($baseItems)];
                $expectedBodies[] = $body;

                $item = $module->checklistItems()->updateOrCreate(
                    [
                        'card_id' => $card->id,
                        'body' => $body,
                    ],
                    [
                        'position' => $i,
                        'is_done' => $globalOffset < $done,
                        'due_date' => $card->due_date,
                    ],
                );

                $item->assignees()->sync([$owner->id]);
                $globalOffset++;
            }

            $module->checklistItems()
                ->whereNotIn('body', $expectedBodies)
                ->delete();
        }

        $card->modules()
            ->where('type', CardModule::TYPE_CHECKLIST)
            ->whereNotIn('title', $moduleTitles)
            ->delete();

        $nextPosition = count($moduleTitles);

        $card->modules()->updateOrCreate(
            ['type' => CardModule::TYPE_COMMENTS],
            ['title' => null, 'position' => $nextPosition],
        );

        if ($this->globalCardIndex % 12 === 0) {
            $card->modules()->updateOrCreate(
                ['type' => CardModule::TYPE_FILES],
                ['title' => null, 'position' => $nextPosition + 1],
            );
        }
    }

    private function splitCount(int $total, int $parts): array
    {
        $base = intdiv($total, $parts);
        $remainder = $total % $parts;
        $result = [];

        for ($i = 0; $i < $parts; $i++) {
            $result[] = $base + ($i < $remainder ? 1 : 0);
        }

        return $result;
    }

    private function seedComments(Card $card, array $task, User $owner): void
    {
        $rootBody = "Seguimiento de «{$task['title']}»: confirmar alcance, responsables y criterios de aceptación antes de cerrar la Card.";

        $root = $card->comments()->updateOrCreate(
            [
                'parent_id' => null,
                'body' => $rootBody,
            ],
            [
                'user_id' => $owner->id,
                'is_internal' => false,
            ],
        );

        if ($task['checklist_done'] > 0) {
            $reply = $card->comments()->updateOrCreate(
                [
                    'parent_id' => $root->id,
                    'body' => 'Avance revisado. Continuar con los elementos pendientes y registrar cualquier bloqueo relevante.',
                ],
                [
                    'user_id' => $this->people['ana']->id,
                    'is_internal' => false,
                ],
            );

            if ($this->globalCardIndex % 10 === 0) {
                $reply2 = $card->comments()->updateOrCreate(
                    [
                        'parent_id' => $reply->id,
                        'body' => 'He revisado el último cambio. Hay que validar también el caso límite antes de darlo por cerrado.',
                    ],
                    [
                        'user_id' => $this->people['irene']->id,
                        'is_internal' => false,
                    ],
                );

                $card->comments()->updateOrCreate(
                    [
                        'parent_id' => $reply2->id,
                        'body' => 'Añadida la comprobación solicitada y actualizadas las evidencias de prueba.',
                    ],
                    [
                        'user_id' => $owner->id,
                        'is_internal' => false,
                    ],
                );
            }
        }

        if ($this->globalCardIndex % 7 === 0) {
            $card->comments()->updateOrCreate(
                [
                    'parent_id' => null,
                    'body' => 'Nota interna: revisar riesgos, cobertura de pruebas y dependencias antes del cambio de estado.',
                ],
                [
                    'user_id' => $this->people['irene']->id,
                    'is_internal' => true,
                ],
            );
        }

        if ($this->globalCardIndex % 5 === 0) {
            $this->seedReactions($root);
        }
    }

    private function seedReactions(Comment $comment): void
    {
        $types = ['like', 'love', 'kiss', 'encantado'];
        $users = ['ana', 'marta', 'luis', 'sofia'];

        foreach ($users as $index => $key) {
            CommentReaction::updateOrCreate(
                [
                    'comment_id' => $comment->id,
                    'user_id' => $this->people[$key]->id,
                ],
                ['type' => $types[$index % count($types)]],
            );
        }
    }

    private function seedAttachments(Card $card, User $owner): void
    {
        $directory = 'demo/nebula/'.$card->id;
        $textPath = $directory.'/nota-tecnica.txt';

        Storage::disk('public')->put(
            $textPath,
            "Nébula Mobile\nCard: {$card->title}\nArchivo generado por NebulaMobileDemoSeeder.\n",
        );

        CardAttachment::updateOrCreate(
            [
                'card_id' => $card->id,
                'original_name' => 'nota-tecnica.txt',
            ],
            [
                'user_id' => $owner->id,
                'disk_path' => $textPath,
                'mime_type' => 'text/plain',
                'size' => Storage::disk('public')->size($textPath),
            ],
        );

        if ($this->globalCardIndex % 24 === 0) {
            $imagePath = $directory.'/mockup-demo.svg';

            Storage::disk('public')->put(
                $imagePath,
                '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">'
                .'<rect width="640" height="360" fill="#f3f4f6"/>'
                .'<rect x="80" y="60" width="480" height="240" rx="24" fill="#ffffff" stroke="#d1d5db"/>'
                .'<text x="320" y="170" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#111827">Nébula Mobile</text>'
                .'<text x="320" y="210" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#6b7280">Mockup de prueba</text>'
                .'</svg>',
            );

            CardAttachment::updateOrCreate(
                [
                    'card_id' => $card->id,
                    'original_name' => 'mockup-demo.svg',
                ],
                [
                    'user_id' => $owner->id,
                    'disk_path' => $imagePath,
                    'mime_type' => 'image/svg+xml',
                    'size' => Storage::disk('public')->size($imagePath),
                ],
            );
        }
    }

    /**
     * Dependencias creadas SIEMPRE mediante CardDependencyService.
     *
     * Se incluyen:
     * - cadenas dentro del mismo Board;
     * - fan-out (una Card bloquea varias);
     * - enlaces entre Boards del mismo Project;
     * - los cuatro tipos FS / SS / FF / SF.
     *
     * No se crean dependencias hacia/desde backlog.
     */
    private function seedDependencies(CardDependencyService $service): void
    {
        $links = [
            // Board 01
            ['Definir visión y objetivos de Nébula', 'Priorizar alcance del MVP', 'fs'],
            ['Entrevistar usuarios frecuentes', 'Definir personas y escenarios de uso', 'fs'],
            ['Priorizar alcance del MVP', 'Seleccionar stack móvil y API', 'fs'],
            ['Seleccionar stack móvil y API', 'Diseñar arquitectura de servicios', 'fs'],
            ['Diseñar arquitectura de servicios', 'Definir modelo de datos inicial', 'ss'],
            ['Diseñar arquitectura de servicios', 'Diseñar estrategia de autenticación', 'ff'],

            // Board 02
            ['Mapear flujos de registro y acceso', 'Diseñar navegación principal', 'ss'],
            ['Diseñar navegación principal', 'Prototipar itinerarios colaborativos', 'fs'],
            ['Definir tokens y tipografía', 'Construir biblioteca de componentes', 'ss'],
            ['Construir biblioteca de componentes', 'Preparar iconografía e ilustraciones', 'ff'],

            // Cross Board 01 -> 02 -> 03
            ['Definir modelo de datos inicial', 'Mapear flujos de registro y acceso', 'fs'],
            ['Diseñar estrategia de autenticación', 'Implementar registro e inicio de sesión', 'fs'],
            ['Construir biblioteca de componentes', 'Perfil avatar y preferencias', 'fs'],
            ['Prototipar itinerarios colaborativos', 'Crear y editar viaje', 'fs'],

            // Board 03
            ['Implementar registro e inicio de sesión', 'Recuperación y cambio de contraseña', 'fs'],
            ['Crear y editar viaje', 'Invitar participantes al viaje', 'ss'],
            ['Invitar participantes al viaje', 'Gestionar roles de participantes', 'fs'],
            ['Itinerario colaborativo', 'Calendario y actividades del viaje', 'ss'],
            ['Registrar gastos y justificantes', 'Calcular balances entre participantes', 'fs'],
            ['Calcular balances entre participantes', 'Exportar resumen de gastos', 'ff'],

            // Cross Board 03 -> 04
            ['Implementar registro e inicio de sesión', 'Automatizar pruebas de autenticación', 'fs'],
            ['Crear y editar viaje', 'Ejecutar pruebas E2E de viajes', 'fs'],
            ['Calcular balances entre participantes', 'Validar balances y cálculos de gastos', 'fs'],
            ['Preparar estrategia de pruebas', 'Pruebas exploratorias de la beta', 'ss'],

            // Board 04 -> 05
            ['Cerrar defectos críticos de beta', 'Validar release candidate', 'fs'],
            ['Ejecutar auditoría de seguridad', 'Preparar entornos de producción', 'fs'],
            ['Preparar entornos de producción', 'Automatizar despliegues y rollback', 'ss'],
            ['Validar release candidate', 'Publicar Nébula Mobile 1.0', 'fs'],
            ['Publicar Nébula Mobile 1.0', 'Monitorizar primera semana', 'fs'],

            // Board 06
            ['Analizar feedback del lanzamiento', 'Mejorar búsqueda y filtros de viajes', 'fs'],
            ['Perfiles públicos y privacidad', 'Compartir itinerarios públicos', 'fs'],
            ['Compartir itinerarios públicos', 'Valoraciones y recomendaciones', 'ss'],

            // Board 07
            ['Preparar internacionalización de interfaz', 'Traducir contenido a inglés', 'ss'],
            ['Traducir contenido a inglés', 'Validar flujos multilingües', 'ff'],
            ['Diseñar campañas de adquisición', 'Crear programa de invitaciones', 'ss'],

            // Board 08
            ['Definir catálogo de planes premium', 'Diseñar experiencia de suscripción', 'fs'],
            ['Diseñar experiencia de suscripción', 'Integrar pasarela de pagos', 'fs'],
            ['Integrar pasarela de pagos', 'Auditar seguridad de pagos', 'ff'],
            ['Planificador avanzado de rutas', 'Automatizaciones de viaje', 'ss'],

            // Board 09
            ['Publicar API para integradores', 'Desarrollar webhooks y reintentos', 'ss'],
            ['Definir programa de socios', 'Crear portal para colaboradores', 'fs'],
            ['Crear portal para colaboradores', 'Construir panel de métricas B2B', 'fs'],

            // Board 10
            ['Separar procesos asíncronos y colas', 'Implementar caché y observabilidad', 'ss'],
            ['Consolidar eventos de producto', 'Construir modelos de métricas', 'fs'],
            ['Construir modelos de métricas', 'Crear panel de KPIs ejecutivos', 'ff'],

            // Board 11
            ['Diseñar nuevo sistema visual 2.0', 'Migrar navegación a la versión 2.0', 'fs'],
            ['Migrar navegación a la versión 2.0', 'Ejecutar regresión funcional completa', 'ff'],
            ['Ejecutar regresión funcional completa', 'Publicar Nébula Mobile 2.0', 'fs'],

            // Board 12 y SF deliberada
            ['Publicar Nébula Mobile 2.0', 'Monitorizar estabilidad post 2.0', 'fs'],
            ['Definir roadmap de producto 2030', 'Preparar presupuesto y capacidad 2030', 'sf'],
        ];

        foreach ($links as [$before, $after, $type]) {
            $predecessor = $this->cards[$before] ?? null;
            $successor = $this->cards[$after] ?? null;

            if (! $predecessor || ! $successor) {
                continue;
            }

            if (
                $predecessor->column->workflow_state === 'backlog'
                || $successor->column->workflow_state === 'backlog'
                || ! $predecessor->start_date
                || ! $predecessor->due_date
                || ! $successor->start_date
                || ! $successor->due_date
            ) {
                continue;
            }

            $dependency = CardDependency::query()
                ->where('predecessor_card_id', $predecessor->id)
                ->where('successor_card_id', $successor->id)
                ->first();

            if (! $dependency) {
                $dependency = $service->create(
                    $predecessor->fresh(['column']),
                    $successor->fresh(['column']),
                );
            }

            // Incluso si coincide con el tipo inferido, updateType() aplica
            // la semántica temporal y propaga la cadena.
            $service->updateType($dependency, $type);
        }
    }
}
