<?php

namespace Database\Seeders;

use App\Models\Board;
use App\Models\Card;
use App\Models\CardAttachment;
use App\Models\CardDependency;
use App\Models\CardModule;
use App\Models\ClientCompany;
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
use RuntimeException;

/**
 * Demo completa y determinista de Nébula Mobile.
 *
 * Premisas:
 * - Sustituye a GanttDemoSeeder; no contiene compatibilidad con ella.
 * - El Project Nébula Mobile debe borrarse antes de relanzar esta seeder.
 * - Workspace/usuarios/equipos compartidos se reutilizan; el Project se crea desde cero.
 * - 192 Cards, 24 miembros del Project, 8 equipos y 6 Cards archivadas.
 * - Todas las Cards tienen descripción y al menos un checklist.
 * - El progreso se deriva exclusivamente de todos los ítems de todos los checklists.
 * - review/done => checklist 100 %.
 * - backlog => sin start_date/due_date.
 * - planning y ejecución real son independientes.
 * - Incluye FS/SS/FF/SF, cadenas, fan-in, fan-out y dependencias cross-board.
 */
class NebulaMobileDemoSeeder extends Seeder
{
    private const PROJECT = 'Nébula Mobile';
    private const WORKSPACE = 'Tickard Demo';
    private const CLIENT = 'Aster Labs';
    private const DEMO_DATE = '2026-10-08';

    private const EXPECTED_BOARDS = 12;
    private const EXPECTED_CARDS = 192;
    private const EXPECTED_PROJECT_USERS = 24;
    private const EXPECTED_TEAMS = 8;

    private const ARCHIVED_TITLES = [
        'Explorar autenticación por SMS',
        'Prototipo de navegación radial',
        'Spike de base de datos local alternativa',
        'Piloto de CDN alternativo',
        'Prueba de programa de referidos legacy',
        'POC de recomendaciones por reglas',
    ];

    private const UNCATEGORIZED_TITLES = [
        'Documentar decisiones de arquitectura',
        'Preparar retrospectiva de lanzamiento',
        'Crear sandbox para integradores',
    ];

    private const BACKLOG_TITLES = [
        'Añadir modo de consulta sin conexión',
        'Analizar telemetría de beta',
        'Analizar embudo de activación',
        'Herramientas para community managers',
        'Automatizar campañas de reactivación',
        'Preparar resumen anual de viajes',
        'Abrir marketplace de integraciones',
        'Preparar dataset para experimentación',
        'Actualizar analítica del nuevo flujo',
        'Evaluar experiencias de realidad aumentada',
    ];

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
            $workspace = Workspace::query()
                ->where('owner_id', $owner->id)
                ->where('name', self::WORKSPACE)
                ->firstOrFail();

            $this->prepareWorkspaceMembers($workspace);
            $this->prepareTeams($workspace);

            if (Project::query()
                ->where('workspace_id', $workspace->id)
                ->where('name', self::PROJECT)
                ->exists()) {
                throw new RuntimeException(
                    'Nébula Mobile ya existe. Borra el Project antes de volver a ejecutar NebulaMobileDemoSeeder.'
                );
            }

            $client = ClientCompany::updateOrCreate(
                ['workspace_id' => $workspace->id, 'name' => self::CLIENT],
                []
            );

            $this->people['paula']->update(['client_company_id' => $client->id]);

            $project = Project::create([
                'workspace_id' => $workspace->id,
                'client_company_id' => $client->id,
                'name' => self::PROJECT,
                'show_description' => true,
                'show_assignee' => true,
                'show_due_date' => true,
                'show_priority' => true,
                'show_labels' => true,
                'show_comments' => true,
            ]);

            $this->prepareProjectMembers($project);
            $this->prepareLabels($project);

            Storage::disk('public')->deleteDirectory('demo/nebula-mobile');

            foreach ($this->plan() as $boardPosition => $phase) {
                $board = $project->boards()->create([
                    'name' => $phase['name'],
                    'position' => $boardPosition,
                    'revision' => 0,
                ]);
                $board->createDefaultColumns();
                $this->applyColumnColors($board);

                $phaseTaskIndex = 0;

                foreach ($phase['categories'] as $categoryPosition => $group) {
                    $category = $board->categories()->create([
                        'name' => $group['name'],
                        'position' => $categoryPosition,
                    ]);

                    foreach ($group['tasks'] as $taskIndex => $title) {
                        $task = $this->buildTask(
                            $phase['start'],
                            $boardPosition,
                            $categoryPosition,
                            $taskIndex,
                            $phaseTaskIndex,
                            $title,
                        );

                        $this->seedCard(
                            $project,
                            $board,
                            in_array($title, self::UNCATEGORIZED_TITLES, true) ? null : $category->id,
                            $task,
                            $phaseTaskIndex,
                        );

                        $phaseTaskIndex++;
                    }
                }
            }

            $this->seedDependencies(app(CardDependencyService::class));
            $this->validateDemo($project);
            $this->printSummary($project);
        });
    }

    private function preparePeople(): void
    {
        $definitions = [
            'ana' => ['Ana Ruiz', 'ana@gestor.test'],
            'luis' => ['Luis Pérez', 'luis@gestor.test'],
            'marta' => ['Marta Gil', 'marta@gestor.test'],
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
            'samuel' => ['Samuel Torres', 'samuel.nebula@gestor.test'],
            'lucia' => ['Lucía Prado', 'lucia.nebula@gestor.test'],
            'ivan' => ['Iván Costa', 'ivan.nebula@gestor.test'],
            'alba' => ['Alba Núñez', 'alba.nebula@gestor.test'],
            'sergio' => ['Sergio Paz', 'sergio.nebula@gestor.test'],
            'carla' => ['Carla Moure', 'carla.nebula@gestor.test'],
            'nico' => ['Nico Campos', 'nico.nebula@gestor.test'],
            'raquel' => ['Raquel Seoane', 'raquel.nebula@gestor.test'],
            'tomas' => ['Tomás Vidal', 'tomas.nebula@gestor.test'],
            'paula' => ['Paula Rivas', 'paula.aster@gestor.test'],
        ];

        foreach ($definitions as $key => [$name, $email]) {
            $user = User::firstOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'password' => 'password',
                    'plan' => User::PLAN_BASE,
                ],
            );

            if ($user->name !== $name) {
                $user->update(['name' => $name]);
            }

            $this->people[$key] = $user;
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

        if ($workspace->extra_seats < 25) {
            $workspace->update(['extra_seats' => 25]);
        }
    }

    private function prepareTeams(Workspace $workspace): void
    {
        $definitions = [
            'Producto' => ['ana', 'clara', 'raquel'],
            'Diseño' => ['marta', 'sofia', 'alba'],
            'Frontend' => ['diego', 'noa', 'lucia', 'ivan'],
            'Backend' => ['luis', 'pablo', 'marcos', 'samuel'],
            'QA' => ['irene', 'lara', 'carla'],
            'DevOps' => ['hugo', 'bruno', 'sergio'],
            'Datos' => ['vera', 'nico', 'tomas'],
            'Marketing' => ['clara', 'raquel', 'alba'],
        ];

        foreach ($definitions as $name => $keys) {
            $team = Team::updateOrCreate(
                ['workspace_id' => $workspace->id, 'name' => $name],
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
                'paula' => 'cliente',
                default => 'editor',
            };

            $project->members()->create([
                'user_id' => $person->id,
                'role' => $role,
            ]);
        }
    }

    private function prepareLabels(Project $project): void
    {
        $labels = [
            ['Móvil', 'bosque'],
            ['Seguridad', 'ciruela'],
            ['Rendimiento', 'tinta'],
            ['Accesibilidad', 'arena'],
            ['Premium', 'arena'],
            ['Integraciones', 'niebla'],
            ['Privacidad', 'ciruela'],
            ['Growth', 'bambu'],
            ['Analítica', 'bambu'],
            ['Deuda técnica', 'tinta'],
            ['iOS', 'niebla'],
            ['Android', 'bosque'],
            ['API', 'bambu'],
            ['UX', 'ciruela'],
            ['Release', 'arena'],
        ];

        foreach ($labels as [$name, $tone]) {
            $project->labels()->create(['name' => $name, 'tone' => $tone]);
        }
    }

    private function applyColumnColors(Board $board): void
    {
        $colors = [
            'backlog' => '#8B98A5',
            'pending' => '#4C8BF5',
            'in_progress' => '#F39C4A',
            'review' => '#9B6BE8',
            'done' => '#38A37A',
        ];

        foreach ($board->columns as $column) {
            $column->update([
                'color' => $colors[$column->workflow_state] ?? $column->color,
            ]);
        }
    }

    private function plan(): array
    {
        return [
            [
                'name' => '01 · Descubrimiento y estrategia',
                'start' => '2026-08-31',
                'categories' => [
                    ['name' => 'Investigación', 'tasks' => [
                        'Definir visión y objetivos de Nébula', 'Entrevistar usuarios frecuentes',
                        'Analizar competidores y oportunidades', 'Definir personas y escenarios de uso',
                        'Priorizar alcance del MVP', 'Definir métricas de éxito',
                        'Validar hipótesis con Aster Labs', 'Mapear riesgos de producto', 'Preparar roadmap inicial',
                    ]],
                    ['name' => 'Arquitectura', 'tasks' => [
                        'Seleccionar stack móvil y API', 'Diseñar arquitectura de servicios',
                        'Definir modelo de datos inicial', 'Diseñar estrategia de autenticación',
                        'Definir política de permisos', 'Documentar decisiones de arquitectura',
                        'Explorar autenticación por SMS',
                    ]],
                ],
            ],
            [
                'name' => '02 · Experiencia y diseño',
                'start' => '2026-09-21',
                'categories' => [
                    ['name' => 'Experiencia', 'tasks' => [
                        'Mapear flujos de registro y acceso', 'Diseñar navegación principal',
                        'Prototipar itinerarios colaborativos', 'Diseñar flujo de gastos compartidos',
                        'Definir estados vacíos y errores', 'Realizar pruebas de usabilidad',
                        'Ajustar prototipo tras feedback',
                    ]],
                    ['name' => 'Sistema visual', 'tasks' => [
                        'Definir tokens y tipografía', 'Construir biblioteca de componentes',
                        'Revisar iconografía de modales', 'Diseñar variantes responsive',
                        'Documentar formularios y validaciones', 'Definir motion y microinteracciones',
                    ]],
                    ['name' => 'Experimentos', 'tasks' => [
                        'Prototipo de navegación radial', 'Validar accesibilidad y contraste',
                        'Preparar handoff para desarrollo',
                    ]],
                ],
            ],
            [
                'name' => '03 · Desarrollo MVP',
                'start' => '2026-10-05',
                'categories' => [
                    ['name' => 'Cuenta y acceso', 'tasks' => [
                        'Implementar API de registro e inicio de sesión', 'Integrar UI de registro e inicio de sesión',
                        'Implementar recuperación de contraseña', 'Construir perfil avatar y preferencias',
                        'Implementar sesiones multidispositivo', 'Construir onboarding de nuevos usuarios',
                    ]],
                    ['name' => 'Viajes', 'tasks' => [
                        'Implementar API de viajes', 'Construir creación y edición de viaje',
                        'Implementar invitaciones y roles', 'Construir itinerario colaborativo',
                        'Implementar calendario de actividades', 'Añadir modo de consulta sin conexión',
                    ]],
                    ['name' => 'Gastos y actividad', 'tasks' => [
                        'Implementar API de gastos', 'Construir registro de gastos y justificantes',
                        'Calcular balances entre participantes', 'Spike de base de datos local alternativa',
                    ]],
                ],
            ],
            [
                'name' => '04 · QA, beta y estabilización',
                'start' => '2027-01-04',
                'categories' => [
                    ['name' => 'Calidad funcional', 'tasks' => [
                        'Preparar estrategia de pruebas', 'Automatizar pruebas de autenticación',
                        'Ejecutar pruebas E2E de viajes', 'Validar balances y cálculos de gastos',
                        'Revisar accesibilidad móvil', 'Preparar matriz de regresión',
                        'Cerrar defectos críticos de beta',
                    ]],
                    ['name' => 'Rendimiento y seguridad', 'tasks' => [
                        'Optimizar arranque y navegación', 'Reducir consultas y tiempos de API',
                        'Ejecutar auditoría de seguridad', 'Pruebas de carga concurrente',
                        'Revisar almacenamiento seguro local',
                    ]],
                    ['name' => 'Beta', 'tasks' => [
                        'Auditar permisos de dispositivos', 'Ensayar recuperación ante fallos',
                        'Coordinar beta cerrada', 'Analizar telemetría de beta',
                    ]],
                ],
            ],
            [
                'name' => '05 · Lanzamiento 1.0',
                'start' => '2027-03-01',
                'categories' => [
                    ['name' => 'Infraestructura', 'tasks' => [
                        'Preparar entornos de producción', 'Configurar monitorización y alertas',
                        'Automatizar despliegues y rollback', 'Validar copias de seguridad',
                        'Configurar CDN para adjuntos', 'Preparar panel de salud del servicio',
                        'Ejecutar simulacro de caída',
                    ]],
                    ['name' => 'Publicación', 'tasks' => [
                        'Preparar ficha de Google Play', 'Preparar ficha de App Store',
                        'Validar release candidate', 'Publicar Nébula Mobile 1.0',
                        'Monitorizar primera semana', 'Responder reseñas iniciales',
                        'Preparar retrospectiva de lanzamiento',
                    ]],
                    ['name' => 'Experimentos', 'tasks' => [
                        'Piloto de CDN alternativo', 'Analizar embudo de activación',
                    ]],
                ],
            ],
            [
                'name' => '06 · Evolución 1.1 y comunidad',
                'start' => '2027-05-03',
                'categories' => [
                    ['name' => 'Experiencia', 'tasks' => [
                        'Analizar feedback del lanzamiento', 'Mejorar búsqueda y filtros de viajes',
                        'Añadir plantillas de itinerarios', 'Implementar modo sin conexión avanzado',
                        'Optimizar sincronización en segundo plano', 'Añadir favoritos y guardados',
                        'Mejorar gestión de documentos', 'Rediseñar panel de actividad',
                    ]],
                    ['name' => 'Comunidad', 'tasks' => [
                        'Construir perfiles públicos y privacidad', 'Compartir itinerarios públicos',
                        'Añadir valoraciones y recomendaciones', 'Implementar moderación y denuncias',
                        'Permitir seguir a otros viajeros', 'Construir colecciones colaborativas',
                        'Implementar reputación básica', 'Herramientas para community managers',
                    ]],
                ],
            ],
            [
                'name' => '07 · Expansión internacional',
                'start' => '2027-09-06',
                'categories' => [
                    ['name' => 'Localización', 'tasks' => [
                        'Preparar internacionalización de interfaz', 'Traducir contenido a inglés',
                        'Traducir contenido a portugués', 'Adaptar fechas zonas horarias y formatos',
                        'Gestionar divisas internacionales', 'Validar flujos multilingües',
                        'Localizar emails transaccionales', 'Preparar guía de traducción continua',
                    ]],
                    ['name' => 'Growth', 'tasks' => [
                        'Diseñar campañas de adquisición', 'Crear programa de invitaciones',
                        'Analizar cohortes de retención', 'Experimentar con onboarding A B',
                        'Diseñar landing pages regionales', 'Automatizar campañas de reactivación',
                        'Medir atribución multicanal',
                    ]],
                    ['name' => 'Experimentos', 'tasks' => ['Prueba de programa de referidos legacy']],
                ],
            ],
            [
                'name' => '08 · Plataforma premium',
                'start' => '2028-01-10',
                'categories' => [
                    ['name' => 'Suscripciones', 'tasks' => [
                        'Definir catálogo de planes premium', 'Diseñar experiencia de suscripción',
                        'Integrar pasarela de pagos', 'Gestionar renovaciones y cancelaciones',
                        'Emitir facturas y gestionar impuestos', 'Auditar seguridad de pagos',
                        'Implementar periodos de prueba', 'Gestionar recuperación de pagos',
                    ]],
                    ['name' => 'Funcionalidades avanzadas', 'tasks' => [
                        'Construir planificador avanzado de rutas', 'Añadir presupuestos y alertas inteligentes',
                        'Implementar exportación avanzada de itinerarios', 'Construir panel de estadísticas personales',
                        'Añadir mapas sin conexión premium', 'Implementar automatizaciones de viaje',
                        'Crear biblioteca premium de plantillas', 'Preparar resumen anual de viajes',
                    ]],
                ],
            ],
            [
                'name' => '09 · Integraciones y ecosistema',
                'start' => '2028-06-03',
                'categories' => [
                    ['name' => 'Integraciones', 'tasks' => [
                        'Integrar calendarios externos', 'Integrar mapas y geolocalización',
                        'Sincronizar reservas y confirmaciones', 'Publicar API para integradores',
                        'Desarrollar webhooks y reintentos', 'Integrar proveedor meteorológico',
                        'Conectar importación de correo', 'Crear sandbox para integradores',
                    ]],
                    ['name' => 'Partners', 'tasks' => [
                        'Definir programa de socios', 'Crear portal para colaboradores',
                        'Construir panel de métricas B2B', 'Realizar piloto con agencias',
                        'Diseñar onboarding de partners', 'Preparar contratos y permisos',
                        'Automatizar reporting de partners', 'Abrir marketplace de integraciones',
                    ]],
                ],
            ],
            [
                'name' => '10 · Escalabilidad y datos',
                'start' => '2028-10-01',
                'categories' => [
                    ['name' => 'Plataforma', 'tasks' => [
                        'Separar procesos asíncronos y colas', 'Optimizar almacenamiento de adjuntos',
                        'Diseñar escalado horizontal de API', 'Implementar caché y observabilidad',
                        'Ensayar recuperación ante desastres', 'Particionar trabajos de sincronización',
                        'Reducir coste por usuario activo', 'Preparar pruebas de capacidad 10x',
                    ]],
                    ['name' => 'Analítica', 'tasks' => [
                        'Consolidar eventos de producto', 'Construir modelos de métricas',
                        'Crear panel de KPIs ejecutivos', 'Validar privacidad y retención de datos',
                        'Implementar calidad de datos', 'Crear diccionario de métricas',
                        'Automatizar detección de anomalías', 'Preparar dataset para experimentación',
                    ]],
                ],
            ],
            [
                'name' => '11 · Rediseño Nébula 2.0',
                'start' => '2029-02-05',
                'categories' => [
                    ['name' => 'Investigación y diseño', 'tasks' => [
                        'Investigar necesidades de usuarios veteranos', 'Redefinir arquitectura de información',
                        'Diseñar nuevo sistema visual 2.0', 'Probar prototipos de navegación 2.0',
                        'Rediseñar experiencia de viajes', 'Validar nuevo patrón de colaboración',
                        'Preparar migración de componentes', 'Cerrar especificación UX 2.0',
                    ]],
                    ['name' => 'Implementación', 'tasks' => [
                        'Migrar navegación a la versión 2.0', 'Refactorizar módulos móviles',
                        'Compatibilizar API y clientes antiguos', 'Ejecutar regresión funcional completa 2.0',
                        'Migrar sistema de temas', 'Actualizar analítica del nuevo flujo',
                        'Preparar migración progresiva', 'Publicar Nébula Mobile 2.0',
                    ]],
                ],
            ],
            [
                'name' => '12 · Operación y roadmap 2030',
                'start' => '2029-08-05',
                'categories' => [
                    ['name' => 'Operación', 'tasks' => [
                        'Monitorizar estabilidad post 2.0', 'Optimizar costes de infraestructura',
                        'Revisar cumplimiento y seguridad anual', 'Auditar satisfacción y soporte',
                        'Revisar acuerdos de nivel de servicio', 'Actualizar runbooks operativos',
                        'Planificar capacidad anual', 'Cerrar deuda técnica prioritaria',
                    ]],
                    ['name' => 'Futuro', 'tasks' => [
                        'Investigar asistente inteligente de viajes', 'Definir roadmap de producto 2030',
                        'Preparar presupuesto y capacidad 2030', 'Evaluar integraciones futuras',
                        'Explorar recomendaciones predictivas', 'Evaluar experiencias de realidad aumentada',
                        'Investigar colaboración empresarial',
                    ]],
                    ['name' => 'POC', 'tasks' => ['POC de recomendaciones por reglas']],
                ],
            ],
        ];
    }

    private function buildTask(
        string $phaseStart,
        int $phaseIndex,
        int $categoryIndex,
        int $taskIndex,
        int $phaseTaskIndex,
        string $title,
    ): array {
        $durationPattern = [1, 3, 5, 8, 13, 21, 34, 55];
        $duration = $durationPattern[($this->globalCardIndex + $phaseTaskIndex + $categoryIndex) % count($durationPattern)];

        $groupOffsets = [0, 18, 42, 63];
        $plannedStart = CarbonImmutable::parse($phaseStart)
            ->addDays($groupOffsets[$categoryIndex] ?? ($categoryIndex * 21))
            ->addDays($taskIndex * 8);
        $plannedEnd = $plannedStart->addDays($duration - 1);

        $state = $this->stateFor($phaseIndex, $phaseTaskIndex, $title, $plannedStart);

        if ($state === 'backlog') {
            $plannedStart = null;
            $plannedEnd = null;
        }

        $team = $this->primaryTeamForTitle($title, $phaseIndex);
        $execution = $this->executionDates($state, $plannedStart, $plannedEnd, $title, $phaseTaskIndex);

        return [
            'title' => $title,
            'state' => $state,
            'team' => $team,
            'start' => $plannedStart?->toDateString(),
            'due' => $plannedEnd?->toDateString(),
            'started_at' => $execution['started_at'],
            'completed_at' => $execution['completed_at'],
            'archived' => in_array($title, self::ARCHIVED_TITLES, true),
        ];
    }

    private function stateFor(
        int $phaseIndex,
        int $phaseTaskIndex,
        string $title,
        ?CarbonImmutable $plannedStart,
    ): string
    {
        if (in_array($title, self::BACKLOG_TITLES, true)) {
            return 'backlog';
        }

        $archivedStates = [
            'Explorar autenticación por SMS' => 'pending',
            'Prototipo de navegación radial' => 'pending',
            'Spike de base de datos local alternativa' => 'pending',
            'Piloto de CDN alternativo' => 'pending',
            'Prueba de programa de referidos legacy' => 'pending',
            'POC de recomendaciones por reglas' => 'pending',
        ];

        if (isset($archivedStates[$title])) {
            return $archivedStates[$title];
        }

        $exceptionalEarly = [
            'Revisar accesibilidad móvil',
            'Ejecutar auditoría de seguridad',
        ];

        if (
            $plannedStart?->greaterThan(CarbonImmutable::parse(self::DEMO_DATE))
            && ! in_array($title, $exceptionalEarly, true)
        ) {
            return 'pending';
        }

        return match ($phaseIndex) {
            0 => match (true) {
                $phaseTaskIndex <= 7 => 'done',
                $phaseTaskIndex <= 11 => 'review',
                $phaseTaskIndex <= 14 => 'in_progress',
                default => 'pending',
            },
            1 => match (true) {
                $phaseTaskIndex <= 3 => 'done',
                $phaseTaskIndex <= 6 => 'review',
                $phaseTaskIndex <= 11 => 'in_progress',
                default => 'pending',
            },
            2 => $phaseTaskIndex === 0 ? 'in_progress' : 'pending',
            3 => in_array($title, [
                'Revisar accesibilidad móvil',
                'Ejecutar auditoría de seguridad',
            ], true) ? 'in_progress' : 'pending',
            default => 'pending',
        };
    }

    private function executionDates(
        string $state,
        ?CarbonImmutable $plannedStart,
        ?CarbonImmutable $plannedEnd,
        string $title,
        int $phaseTaskIndex,
    ): array {
        if (in_array($state, ['pending', 'backlog'], true) || ! $plannedStart || ! $plannedEnd) {
            return ['started_at' => null, 'completed_at' => null];
        }

        $demoDate = CarbonImmutable::parse(self::DEMO_DATE)->setTime(18, 0);
        $exceptionalEarly = [
            'Revisar accesibilidad móvil' => 3,
            'Ejecutar auditoría de seguridad' => 1,
        ];

        if (isset($exceptionalEarly[$title])) {
            $started = $demoDate
                ->subDays($exceptionalEarly[$title])
                ->setTime(9, 0);
        } else {
            $offsets = [-6, -3, 0, 2, 4, 7, 10, -1];
            $started = $plannedStart
                ->addDays($offsets[$phaseTaskIndex % count($offsets)])
                ->setTime(9, 0);
        }

        if ($state === 'in_progress') {
            return ['started_at' => $started->toDateTimeString(), 'completed_at' => null];
        }

        $completeOffsets = [-5, -2, 0, 3, 6, -1];
        $completed = $plannedEnd
            ->addDays($completeOffsets[$phaseTaskIndex % count($completeOffsets)])
            ->setTime(17, 30);

        if ($completed->greaterThan($demoDate)) {
            $completed = $demoDate->subDays($phaseTaskIndex % 3)->setTime(17, 30);
        }

        if ($completed->lessThanOrEqualTo($started)) {
            $completed = $started->addDay()->setTime(17, 30);
            if ($completed->greaterThan($demoDate)) {
                $completed = $demoDate;
            }
        }

        return [
            'started_at' => $started->toDateTimeString(),
            'completed_at' => $completed->toDateTimeString(),
        ];
    }

    private function seedCard(Project $project, Board $board, ?int $categoryId, array $task, int $position): void
    {
        $this->globalCardIndex++;

        if (isset($this->cards[$task['title']])) {
            throw new RuntimeException("Título de Card duplicado en Nébula Mobile: {$task['title']}");
        }

        $column = $board->columns()->where('workflow_state', $task['state'])->firstOrFail();
        $team = $this->teams[$task['team']];
        $creatorKey = $this->teamMemberKeys($task['team'])[0];
        $creator = $this->people[$creatorKey];

        $card = $board->cards()->create([
            'column_id' => $column->id,
            'category_id' => $categoryId,
            'title' => $task['title'],
            'description' => $this->descriptionFor($task['title'], $task['team'], $task['state'], $this->globalCardIndex),
            'start_date' => $task['start'],
            'due_date' => $task['due'],
            'started_at' => $task['started_at'],
            'completed_at' => $task['completed_at'],
            'priority' => $this->priorityFor($task['title'], $this->globalCardIndex),
            'color' => $this->customColorFor($this->globalCardIndex),
            'is_internal' => $this->globalCardIndex % 31 === 0,
            'position' => $position,
            'archived_at' => $task['archived']
                ? CarbonImmutable::parse(self::DEMO_DATE)->subDays(($this->globalCardIndex % 20) + 2)
                : null,
            'created_by' => $creator->id,
        ]);

        $assigneeKeys = $this->assigneeKeysFor($task['team'], $this->globalCardIndex);
        $card->assignees()->sync(array_map(fn (string $key) => $this->people[$key]->id, $assigneeKeys));

        $teamIds = [$team->id];
        if ($this->globalCardIndex % 17 === 0) {
            $secondary = $this->secondaryTeamFor($task['team']);
            if ($secondary) {
                $teamIds[] = $this->teams[$secondary]->id;
            }
        }
        $card->teams()->sync(array_values(array_unique($teamIds)));

        $labelNames = $this->labelsFor($task['title'], $this->globalCardIndex);
        $labelIds = $project->labels()->whereIn('name', $labelNames)->pluck('id')->all();
        $card->labels()->sync($labelIds);

        $this->seedModules($card, $task['team'], $task['state'], $assigneeKeys);
        $this->seedComments($card, $task['team'], $task['state'], $creator);

        if ($this->globalCardIndex % 9 === 0) {
            $this->seedAttachments($card, $creator, $task['team']);
        }

        $card->activities()->create([
            'user_id' => $creator->id,
            'type' => 'created',
            'meta' => ['title' => $card->title, 'source' => 'nebula-demo'],
        ]);

        $this->cards[$task['title']] = $card->fresh(['column', 'board']);
    }

    private function primaryTeamForTitle(string $title, int $phaseIndex): string
    {
        $value = mb_strtolower($title);
        $rules = [
            'QA' => ['pruebas', 'regresión', 'defectos', 'beta cerrada', 'telemetría de beta', 'validar balances', 'revisar accesibilidad'],
            'DevOps' => ['entornos de producción', 'monitorización', 'despliegues', 'rollback', 'copias de seguridad', 'cdn', 'salud del servicio', 'simulacro de caída', 'colas', 'caché', 'observabilidad', 'desastres', 'capacidad 10x', 'costes de infraestructura', 'runbooks', 'capacidad anual'],
            'Datos' => ['métricas', 'cohortes', 'analítica', 'kpis', 'eventos de producto', 'calidad de datos', 'diccionario de métricas', 'anomalías', 'dataset', 'atribución'],
            'Marketing' => ['campañas', 'landing', 'reseñas', 'google play', 'app store', 'programa de invitaciones', 'referidos', 'community managers'],
            'Diseño' => ['diseñar', 'prototip', 'tokens', 'tipografía', 'iconografía', 'sistema visual', 'arquitectura de información', 'ux 2.0', 'handoff', 'motion'],
            'Backend' => ['api', 'autenticación', 'permisos', 'modelo de datos', 'webhooks', 'pagos', 'facturas', 'reservas', 'sincronización', 'clientes antiguos', 'integrador'],
            'Frontend' => ['integrar ui', 'construir perfil', 'onboarding', 'creación y edición', 'itinerario', 'calendario', 'registro de gastos', 'modo sin conexión', 'favoritos', 'panel de actividad', 'perfiles públicos', 'itinerarios públicos', 'mapas sin conexión', 'migrar navegación', 'módulos móviles', 'sistema de temas'],
        ];

        foreach ($rules as $team => $needles) {
            foreach ($needles as $needle) {
                if (str_contains($value, $needle)) {
                    return $team;
                }
            }
        }

        if ($phaseIndex <= 1 || str_contains($value, 'roadmap') || str_contains($value, 'visión') || str_contains($value, 'alcance')) {
            return 'Producto';
        }

        return match ($phaseIndex) {
            2 => 'Frontend',
            3 => 'QA',
            4 => 'DevOps',
            6 => 'Marketing',
            9 => 'Datos',
            default => 'Producto',
        };
    }

    private function descriptionFor(string $title, string $team, string $state, int $index): string
    {
        $stateContext = match ($state) {
            'backlog' => 'La iniciativa está registrada para valoración futura y todavía no forma parte de la planificación activa.',
            'pending' => 'El trabajo está planificado y pendiente de ejecución por el equipo responsable.',
            'in_progress' => 'La tarea está actualmente en ejecución y debe actualizarse a medida que se completen sus bloques internos.',
            'review' => 'La ejecución está completada y la Card está pendiente de validación final.',
            'done' => 'La tarea fue completada y validada dentro del alcance acordado.',
        };

        $description = "Objetivo: {$title}. El equipo {$team} debe resolver esta unidad de trabajo dentro del alcance de Nébula Mobile, "
            ."dejando el resultado verificable y documentando cualquier decisión que afecte a otras áreas. {$stateContext}";

        if ($index % 13 === 0) {
            $description .= ' Esta Card incluye además una descripción ampliada para probar contenido extenso en la interfaz: '
                .'se deben revisar casos normales, estados vacíos, errores previsibles, impacto en móvil, accesibilidad y compatibilidad '
                .'con los flujos existentes. Si aparece un bloqueo externo, debe quedar reflejado en comentarios y dependencias.';
        }

        return $description;
    }

    private function priorityFor(string $title, int $index): string
    {
        $lower = mb_strtolower($title);

        if (
            str_contains($lower, 'defectos críticos')
            || str_contains($lower, 'publicar nébula')
            || str_contains($lower, 'auditoría de seguridad')
            || str_contains($lower, 'recuperación ante desastres')
        ) {
            return 'urgente';
        }

        return match ($index % 10) {
            0, 1, 2 => 'alta',
            8 => 'baja',
            default => 'media',
        };
    }

    private function customColorFor(int $index): ?string
    {
        if ($index % 17 !== 0) {
            return null;
        }

        $colors = ['#5B8DEF', '#9B6BE8', '#38A37A', '#E15D7C', '#D9A441'];
        return $colors[intdiv($index, 17) % count($colors)];
    }

    private function teamMemberKeys(string $team): array
    {
        return match ($team) {
            'Producto' => ['ana', 'clara', 'raquel'],
            'Diseño' => ['marta', 'sofia', 'alba'],
            'Frontend' => ['diego', 'noa', 'lucia', 'ivan'],
            'Backend' => ['luis', 'pablo', 'marcos', 'samuel'],
            'QA' => ['irene', 'lara', 'carla'],
            'DevOps' => ['hugo', 'bruno', 'sergio'],
            'Datos' => ['vera', 'nico', 'tomas'],
            'Marketing' => ['clara', 'raquel', 'alba'],
            default => ['ana'],
        };
    }

    private function assigneeKeysFor(string $team, int $index): array
    {
        if ($index % 47 === 0) {
            return [];
        }

        $members = $this->teamMemberKeys($team);
        $count = 1;

        if ($index % 5 === 0) {
            $count = min(2, count($members));
        }
        if ($index % 29 === 0) {
            $count = min(4, count($members));
        }
        if ($index % 83 === 0) {
            $cross = array_values(array_unique(array_merge(
                $members,
                $this->teamMemberKeys($this->secondaryTeamFor($team) ?? 'Producto')
            )));
            return array_slice($cross, 0, min(6, count($cross)));
        }

        $offset = $index % count($members);
        $rotated = array_merge(array_slice($members, $offset), array_slice($members, 0, $offset));

        return array_slice($rotated, 0, $count);
    }

    private function secondaryTeamFor(string $team): ?string
    {
        return match ($team) {
            'Producto' => 'Diseño',
            'Diseño' => 'Frontend',
            'Frontend' => 'Backend',
            'Backend' => 'QA',
            'QA' => 'Backend',
            'DevOps' => 'Backend',
            'Datos' => 'Producto',
            'Marketing' => 'Producto',
            default => null,
        };
    }

    private function labelsFor(string $title, int $index): array
    {
        $lower = mb_strtolower($title);
        $labels = ['Móvil'];

        $rules = [
            'Seguridad' => ['seguridad', 'autenticación', 'permisos', 'sesiones', 'pagos'],
            'Rendimiento' => ['rendimiento', 'carga', 'arranque', 'caché', 'escalado', 'capacidad'],
            'Accesibilidad' => ['accesibilidad', 'contraste'],
            'Premium' => ['premium', 'suscripción', 'pagos', 'facturas'],
            'Integraciones' => ['integrar', 'integraciones', 'webhooks', 'reservas', 'calendarios', 'meteorológico'],
            'Privacidad' => ['privacidad', 'retención', 'consentimiento'],
            'Growth' => ['growth', 'campañas', 'cohortes', 'onboarding a b', 'landing', 'invitaciones'],
            'Analítica' => ['métricas', 'analítica', 'eventos', 'kpis', 'cohortes', 'atribución', 'telemetría'],
            'Deuda técnica' => ['refactorizar', 'deuda técnica', 'clientes antiguos', 'migración'],
            'API' => ['api', 'webhooks', 'modelo de datos'],
            'UX' => ['diseñar', 'prototip', 'navegación', 'iconografía', 'responsive', 'experiencia'],
            'Release' => ['release', 'publicar', 'google play', 'app store', 'lanzamiento'],
        ];

        foreach ($rules as $label => $needles) {
            foreach ($needles as $needle) {
                if (str_contains($lower, $needle)) {
                    $labels[] = $label;
                    break;
                }
            }
        }

        if ($index % 8 === 0) {
            $labels[] = $index % 16 === 0 ? 'iOS' : 'Android';
        }

        return array_values(array_unique($labels));
    }

    private function seedModules(Card $card, string $team, string $state, array $assigneeKeys): void
    {
        $blueprints = $this->checklistBlueprints($team);
        $moduleCount = match (true) {
            $this->globalCardIndex % 41 === 0 => 4,
            $this->globalCardIndex % 7 === 0 => 3,
            $this->globalCardIndex % 3 === 0 => 2,
            default => 1,
        };

        $selected = array_slice($blueprints, 0, $moduleCount);
        $total = array_sum(array_map(fn (array $module) => count($module['items']), $selected));
        $done = $this->doneCountForState($state, $total, $this->globalCardIndex);
        $current = 0;

        foreach ($selected as $position => $definition) {
            $module = $card->modules()->create([
                'type' => CardModule::TYPE_CHECKLIST,
                'title' => $definition['title'],
                'position' => $position,
            ]);

            foreach ($definition['items'] as $itemPosition => $body) {
                $isDone = $current < $done;
                $item = $module->checklistItems()->create([
                    'card_id' => $card->id,
                    'body' => $body,
                    'position' => $itemPosition,
                    'is_done' => $isDone,
                    'due_date' => $this->checklistDueDate($card, $current),
                    'completed_at' => $isDone
                        ? $this->checklistCompletedAt($card, $current)->toDateTimeString()
                        : null,
                ]);

                if ($assigneeKeys !== []) {
                    $assigneeKey = $assigneeKeys[$itemPosition % count($assigneeKeys)];
                    $item->assignees()->sync([$this->people[$assigneeKey]->id]);
                }

                $current++;
            }
        }

        $card->modules()->create([
            'type' => CardModule::TYPE_COMMENTS,
            'title' => null,
            'position' => count($selected),
        ]);

        if ($this->globalCardIndex % 9 === 0) {
            $card->modules()->create([
                'type' => CardModule::TYPE_FILES,
                'title' => null,
                'position' => count($selected) + 1,
            ]);
        }
    }

    private function checklistDueDate(Card $card, int $itemIndex): ?string
    {
        if (! $card->start_date || ! $card->due_date || $itemIndex % 4 === 1) {
            return null;
        }

        $plannedDays = $card->start_date->diffInDays($card->due_date);
        $offset = ($this->globalCardIndex * 3 + $itemIndex * 2) % ($plannedDays + 1);

        return $card->start_date->addDays($offset)->toDateString();
    }

    private function checklistCompletedAt(Card $card, int $itemIndex): CarbonImmutable
    {
        $startedAt = CarbonImmutable::parse($card->started_at);
        $finishedAt = $card->completed_at
            ? CarbonImmutable::parse($card->completed_at)
            : CarbonImmutable::parse(self::DEMO_DATE)->endOfDay();
        $spanSeconds = max(0, $startedAt->diffInSeconds($finishedAt));

        if ($spanSeconds === 0) {
            return $startedAt;
        }

        $percentage = 10 + (($this->globalCardIndex * 11 + $itemIndex * 17) % 81);

        return $startedAt->addSeconds((int) floor($spanSeconds * $percentage / 100));
    }

    private function checklistBlueprints(string $team): array
    {
        $genericClose = [
            'title' => 'Validación y cierre',
            'items' => ['Revisar criterios de aceptación', 'Comprobar estados límite', 'Documentar resultado', 'Resolver observaciones pendientes'],
        ];

        $sets = [
            'Producto' => [
                ['title' => 'Alcance', 'items' => ['Confirmar objetivo', 'Revisar necesidades de usuario', 'Definir criterios de aceptación', 'Identificar dependencias']],
                ['title' => 'Validación', 'items' => ['Contrastar con stakeholders', 'Revisar riesgos', 'Validar métricas', 'Cerrar decisiones abiertas']],
                ['title' => 'Documentación', 'items' => ['Actualizar especificación', 'Registrar decisiones', 'Preparar comunicación']],
                $genericClose,
            ],
            'Diseño' => [
                ['title' => 'Revisión visual', 'items' => ['Revisar jerarquía visual', 'Validar iconografía', 'Comprobar espaciados', 'Revisar tipografía']],
                ['title' => 'Interacción y estados', 'items' => ['Estado normal', 'Estado vacío', 'Estado de error', 'Estado de carga', 'Feedback de interacción']],
                ['title' => 'Responsive y accesibilidad', 'items' => ['Vista móvil', 'Vista tablet', 'Contraste', 'Navegación por teclado', 'Lectura clara de estados']],
                $genericClose,
            ],
            'Frontend' => [
                ['title' => 'Implementación UI', 'items' => ['Construir estructura', 'Integrar componentes', 'Gestionar estados', 'Gestionar errores', 'Conectar datos']],
                ['title' => 'Comportamiento', 'items' => ['Flujo principal', 'Estados vacíos', 'Validaciones', 'Carga y reintento']],
                ['title' => 'Calidad visual', 'items' => ['Responsive', 'Accesibilidad', 'Consistencia de estilos', 'Prueba en dispositivo']],
                $genericClose,
            ],
            'Backend' => [
                ['title' => 'Implementación', 'items' => ['Definir contrato', 'Implementar lógica', 'Persistir datos', 'Gestionar errores', 'Aplicar permisos']],
                ['title' => 'Seguridad y consistencia', 'items' => ['Validar entrada', 'Comprobar autorización', 'Controlar concurrencia', 'Revisar trazabilidad']],
                ['title' => 'Pruebas técnicas', 'items' => ['Tests unitarios', 'Tests de integración', 'Casos límite', 'Revisar regresiones']],
                $genericClose,
            ],
            'QA' => [
                ['title' => 'Preparación', 'items' => ['Revisar alcance', 'Preparar datos', 'Definir escenarios', 'Identificar riesgos']],
                ['title' => 'Ejecución', 'items' => ['Camino feliz', 'Errores esperados', 'Casos límite', 'Permisos', 'Dispositivos relevantes']],
                ['title' => 'Regresión', 'items' => ['Reproducir incidencias', 'Verificar correcciones', 'Ejecutar regresión relacionada', 'Registrar evidencias']],
                $genericClose,
            ],
            'DevOps' => [
                ['title' => 'Configuración', 'items' => ['Preparar configuración', 'Revisar secretos', 'Aplicar infraestructura', 'Validar permisos']],
                ['title' => 'Observabilidad', 'items' => ['Añadir métricas', 'Configurar logs', 'Definir alertas', 'Preparar dashboard']],
                ['title' => 'Operación', 'items' => ['Probar despliegue', 'Probar rollback', 'Verificar recuperación', 'Documentar runbook']],
                $genericClose,
            ],
            'Datos' => [
                ['title' => 'Instrumentación', 'items' => ['Definir eventos', 'Definir propiedades', 'Implementar captura', 'Validar privacidad']],
                ['title' => 'Modelo y calidad', 'items' => ['Preparar transformación', 'Validar integridad', 'Comprobar duplicados', 'Documentar métrica']],
                ['title' => 'Explotación', 'items' => ['Preparar consulta', 'Construir visualización', 'Validar interpretación', 'Revisar anomalías']],
                $genericClose,
            ],
            'Marketing' => [
                ['title' => 'Preparación', 'items' => ['Definir audiencia', 'Preparar mensaje', 'Revisar creatividades', 'Validar enlaces']],
                ['title' => 'Publicación', 'items' => ['Configurar campaña', 'Revisar tracking', 'Publicar', 'Verificar destino']],
                ['title' => 'Medición', 'items' => ['Revisar adquisición', 'Analizar conversión', 'Comparar cohortes', 'Registrar aprendizajes']],
                $genericClose,
            ],
        ];

        return $sets[$team] ?? $sets['Producto'];
    }

    private function doneCountForState(string $state, int $total, int $index): int
    {
        if (in_array($state, ['review', 'done'], true)) {
            return $total;
        }

        if (in_array($state, ['pending', 'backlog'], true)) {
            return 0;
        }

        $fractions = [0.18, 0.29, 0.37, 0.46, 0.58, 0.67, 0.76, 0.84, 0.91];
        $fraction = $fractions[$index % count($fractions)];

        return max(1, min($total - 1, (int) floor($total * $fraction)));
    }

    private function seedComments(Card $card, string $team, string $state, User $creator): void
    {
        if ($this->globalCardIndex % 5 === 0) {
            return;
        }

        $messages = [
            'Producto' => 'He revisado el alcance. Mantengamos esta Card centrada en el objetivo acordado y dejemos cualquier ampliación para otra tarea.',
            'Diseño' => 'He actualizado la propuesta visual y quedan por validar los estados de error y la versión móvil.',
            'Frontend' => 'La integración principal ya está encaminada. Falta comprobar el comportamiento con datos vacíos y errores de red.',
            'Backend' => 'El contrato está definido. Conviene revisar permisos y casos límite antes de dar por cerrada la implementación.',
            'QA' => 'He preparado los escenarios principales. Si aparece una regresión, la registraré con pasos reproducibles y evidencia.',
            'DevOps' => 'La configuración base está lista. Antes de cerrar debemos verificar alertas, rollback y recuperación.',
            'Datos' => 'La métrica está definida. Falta validar que la instrumentación no duplique eventos y que respete privacidad.',
            'Marketing' => 'La propuesta está preparada. Revisaremos tracking y conversión antes de considerar la acción cerrada.',
        ];

        $root = $card->comments()->create([
            'user_id' => $creator->id,
            'parent_id' => null,
            'body' => $messages[$team] ?? $messages['Producto'],
            'is_internal' => false,
        ]);

        if ($this->globalCardIndex % 3 === 0) {
            $reply = $card->comments()->create([
                'user_id' => $this->people['ana']->id,
                'parent_id' => $root->id,
                'body' => $state === 'in_progress'
                    ? 'Correcto. Si aparece algún bloqueo que afecte al planning, dejadlo reflejado también en la dependencia correspondiente.'
                    : 'Revisado. Mantengamos la trazabilidad de las decisiones importantes antes de cambiar el estado.',
                'is_internal' => false,
            ]);

            if ($this->globalCardIndex % 11 === 0) {
                $reply2 = $card->comments()->create([
                    'user_id' => $this->people['irene']->id,
                    'parent_id' => $reply->id,
                    'body' => 'Añadiré una comprobación específica para el caso límite que comentamos y adjuntaré evidencia si falla.',
                    'is_internal' => false,
                ]);

                if ($this->globalCardIndex % 22 === 0) {
                    $card->comments()->create([
                        'user_id' => $creator->id,
                        'parent_id' => $reply2->id,
                        'body' => 'Perfecto. Ya está incorporado el ajuste y queda listo para repetir la validación.',
                        'is_internal' => false,
                    ]);
                }
            }
        }

        if ($this->globalCardIndex % 9 === 0) {
            $card->comments()->create([
                'user_id' => $this->people['irene']->id,
                'parent_id' => null,
                'body' => 'Nota interna: revisar impacto en regresión y dependencias antes de comunicar el cierre fuera del equipo.',
                'is_internal' => true,
            ]);
        }

        if ($this->globalCardIndex % 6 === 0) {
            $types = ['like', 'love', 'kiss', 'encantado'];
            $reactors = ['ana', 'marta', 'luis', 'sofia'];

            foreach ($reactors as $position => $key) {
                CommentReaction::create([
                    'comment_id' => $root->id,
                    'user_id' => $this->people[$key]->id,
                    'type' => $types[$position],
                ]);
            }
        }
    }

    private function seedAttachments(Card $card, User $owner, string $team): void
    {
        $directory = 'demo/nebula-mobile/'.$card->id;
        $mdPath = $directory.'/contexto.md';

        Storage::disk('public')->put(
            $mdPath,
            "# {$card->title}\n\nEquipo: {$team}\n\nDocumento generado por NebulaMobileDemoSeeder.\n"
        );

        CardAttachment::create([
            'card_id' => $card->id,
            'user_id' => $owner->id,
            'original_name' => 'contexto.md',
            'disk_path' => $mdPath,
            'mime_type' => 'text/markdown',
            'size' => Storage::disk('public')->size($mdPath),
        ]);

        if ($this->globalCardIndex % 18 === 0) {
            $jsonPath = $directory.'/ejemplo-respuesta.json';
            Storage::disk('public')->put(
                $jsonPath,
                json_encode([
                    'card' => $card->title,
                    'status' => 'demo',
                    'items' => [1, 2, 3],
                ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
            );

            CardAttachment::create([
                'card_id' => $card->id,
                'user_id' => $owner->id,
                'original_name' => 'ejemplo-respuesta.json',
                'disk_path' => $jsonPath,
                'mime_type' => 'application/json',
                'size' => Storage::disk('public')->size($jsonPath),
            ]);
        }

        if ($this->globalCardIndex % 27 === 0) {
            $svgPath = $directory.'/mockup-nebula.svg';
            Storage::disk('public')->put(
                $svgPath,
                '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">'
                .'<rect width="640" height="360" fill="#f3f4f6"/>'
                .'<rect x="80" y="54" width="480" height="252" rx="24" fill="#ffffff" stroke="#d1d5db"/>'
                .'<text x="320" y="168" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#111827">Nébula Mobile</text>'
                .'<text x="320" y="210" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#6b7280">Mockup de prueba</text>'
                .'</svg>'
            );

            CardAttachment::create([
                'card_id' => $card->id,
                'user_id' => $owner->id,
                'original_name' => 'mockup-nebula.svg',
                'disk_path' => $svgPath,
                'mime_type' => 'image/svg+xml',
                'size' => Storage::disk('public')->size($svgPath),
            ]);
        }
    }

    private function seedDependencies(CardDependencyService $service): void
    {
        $links = [
            ['Definir visión y objetivos de Nébula', 'Definir personas y escenarios de uso', 'fs'],
            ['Entrevistar usuarios frecuentes', 'Definir personas y escenarios de uso', 'fs'],
            ['Analizar competidores y oportunidades', 'Priorizar alcance del MVP', 'fs'],
            ['Definir personas y escenarios de uso', 'Priorizar alcance del MVP', 'fs'],
            ['Priorizar alcance del MVP', 'Seleccionar stack móvil y API', 'fs'],
            ['Seleccionar stack móvil y API', 'Diseñar arquitectura de servicios', 'ss'],
            ['Diseñar arquitectura de servicios', 'Definir modelo de datos inicial', 'fs'],
            ['Diseñar arquitectura de servicios', 'Diseñar estrategia de autenticación', 'ss'],
            ['Definir modelo de datos inicial', 'Definir política de permisos', 'ff'],

            ['Mapear flujos de registro y acceso', 'Diseñar navegación principal', 'ss'],
            ['Diseñar navegación principal', 'Prototipar itinerarios colaborativos', 'fs'],
            ['Definir tokens y tipografía', 'Construir biblioteca de componentes', 'ss'],
            ['Construir biblioteca de componentes', 'Revisar iconografía de modales', 'fs'],
            ['Construir biblioteca de componentes', 'Diseñar variantes responsive', 'ff'],
            ['Realizar pruebas de usabilidad', 'Ajustar prototipo tras feedback', 'fs'],
            ['Validar accesibilidad y contraste', 'Preparar handoff para desarrollo', 'fs'],

            ['Priorizar alcance del MVP', 'Mapear flujos de registro y acceso', 'fs'],
            ['Diseñar estrategia de autenticación', 'Implementar API de registro e inicio de sesión', 'fs'],
            ['Construir biblioteca de componentes', 'Integrar UI de registro e inicio de sesión', 'fs'],
            ['Implementar API de registro e inicio de sesión', 'Integrar UI de registro e inicio de sesión', 'fs'],
            ['Implementar API de registro e inicio de sesión', 'Implementar recuperación de contraseña', 'fs'],
            ['Integrar UI de registro e inicio de sesión', 'Construir onboarding de nuevos usuarios', 'fs'],
            ['Implementar API de viajes', 'Construir creación y edición de viaje', 'fs'],
            ['Construir creación y edición de viaje', 'Implementar invitaciones y roles', 'ss'],
            ['Implementar API de viajes', 'Construir itinerario colaborativo', 'fs'],
            ['Construir itinerario colaborativo', 'Implementar calendario de actividades', 'ss'],
            ['Implementar API de gastos', 'Construir registro de gastos y justificantes', 'fs'],
            ['Construir registro de gastos y justificantes', 'Calcular balances entre participantes', 'fs'],

            ['Implementar API de registro e inicio de sesión', 'Automatizar pruebas de autenticación', 'fs'],
            ['Construir creación y edición de viaje', 'Ejecutar pruebas E2E de viajes', 'fs'],
            ['Calcular balances entre participantes', 'Validar balances y cálculos de gastos', 'fs'],
            ['Preparar estrategia de pruebas', 'Automatizar pruebas de autenticación', 'ss'],
            ['Preparar estrategia de pruebas', 'Coordinar beta cerrada', 'ss'],
            ['Ejecutar auditoría de seguridad', 'Revisar almacenamiento seguro local', 'fs'],
            ['Coordinar beta cerrada', 'Cerrar defectos críticos de beta', 'ff'],

            ['Cerrar defectos críticos de beta', 'Validar release candidate', 'fs'],
            ['Preparar entornos de producción', 'Automatizar despliegues y rollback', 'ss'],
            ['Configurar monitorización y alertas', 'Preparar panel de salud del servicio', 'ss'],
            ['Validar copias de seguridad', 'Ejecutar simulacro de caída', 'ff'],
            ['Validar release candidate', 'Publicar Nébula Mobile 1.0', 'fs'],
            ['Preparar ficha de Google Play', 'Preparar ficha de App Store', 'sf'],
            ['Publicar Nébula Mobile 1.0', 'Monitorizar primera semana', 'fs'],
            ['Publicar Nébula Mobile 1.0', 'Responder reseñas iniciales', 'ss'],
            ['Monitorizar primera semana', 'Preparar retrospectiva de lanzamiento', 'fs'],

            ['Monitorizar primera semana', 'Analizar feedback del lanzamiento', 'fs'],
            ['Analizar feedback del lanzamiento', 'Mejorar búsqueda y filtros de viajes', 'fs'],
            ['Construir perfiles públicos y privacidad', 'Compartir itinerarios públicos', 'fs'],
            ['Compartir itinerarios públicos', 'Añadir valoraciones y recomendaciones', 'ss'],
            ['Implementar moderación y denuncias', 'Implementar reputación básica', 'fs'],

            ['Preparar internacionalización de interfaz', 'Traducir contenido a inglés', 'ss'],
            ['Traducir contenido a inglés', 'Traducir contenido a portugués', 'fs'],
            ['Adaptar fechas zonas horarias y formatos', 'Gestionar divisas internacionales', 'ss'],
            ['Diseñar campañas de adquisición', 'Crear programa de invitaciones', 'ss'],
            ['Analizar cohortes de retención', 'Experimentar con onboarding A B', 'fs'],
            ['Diseñar landing pages regionales', 'Medir atribución multicanal', 'ff'],

            ['Definir catálogo de planes premium', 'Diseñar experiencia de suscripción', 'fs'],
            ['Diseñar experiencia de suscripción', 'Integrar pasarela de pagos', 'fs'],
            ['Integrar pasarela de pagos', 'Gestionar renovaciones y cancelaciones', 'fs'],
            ['Integrar pasarela de pagos', 'Auditar seguridad de pagos', 'ff'],
            ['Implementar periodos de prueba', 'Gestionar recuperación de pagos', 'fs'],
            ['Construir planificador avanzado de rutas', 'Implementar automatizaciones de viaje', 'ss'],

            ['Publicar API para integradores', 'Desarrollar webhooks y reintentos', 'ss'],
            ['Definir programa de socios', 'Crear portal para colaboradores', 'fs'],
            ['Crear portal para colaboradores', 'Construir panel de métricas B2B', 'fs'],
            ['Realizar piloto con agencias', 'Automatizar reporting de partners', 'fs'],

            ['Separar procesos asíncronos y colas', 'Implementar caché y observabilidad', 'ss'],
            ['Diseñar escalado horizontal de API', 'Preparar pruebas de capacidad 10x', 'fs'],
            ['Consolidar eventos de producto', 'Construir modelos de métricas', 'fs'],
            ['Construir modelos de métricas', 'Crear panel de KPIs ejecutivos', 'ff'],
            ['Implementar calidad de datos', 'Automatizar detección de anomalías', 'fs'],

            ['Diseñar nuevo sistema visual 2.0', 'Migrar sistema de temas', 'fs'],
            ['Probar prototipos de navegación 2.0', 'Migrar navegación a la versión 2.0', 'fs'],
            ['Migrar navegación a la versión 2.0', 'Ejecutar regresión funcional completa 2.0', 'ff'],
            ['Refactorizar módulos móviles', 'Compatibilizar API y clientes antiguos', 'ss'],
            ['Preparar migración progresiva', 'Publicar Nébula Mobile 2.0', 'fs'],

            ['Publicar Nébula Mobile 2.0', 'Monitorizar estabilidad post 2.0', 'fs'],
            ['Monitorizar estabilidad post 2.0', 'Optimizar costes de infraestructura', 'fs'],
            ['Revisar cumplimiento y seguridad anual', 'Revisar acuerdos de nivel de servicio', 'fs'],
            ['Definir roadmap de producto 2030', 'Preparar presupuesto y capacidad 2030', 'sf'],
            ['Investigar asistente inteligente de viajes', 'Explorar recomendaciones predictivas', 'ss'],
        ];

        foreach ($links as [$before, $after, $type]) {
            $predecessor = $this->cards[$before] ?? null;
            $successor = $this->cards[$after] ?? null;

            if (! $predecessor || ! $successor) {
                throw new RuntimeException("Dependencia demo referencia una Card inexistente: {$before} -> {$after}");
            }

            if ($predecessor->archived_at || $successor->archived_at) {
                throw new RuntimeException("Una Card archivada no puede participar en dependencias: {$before} -> {$after}");
            }

            if ($predecessor->board->project_id !== $successor->board->project_id) {
                throw new RuntimeException("Dependencia entre Projects distintos: {$before} -> {$after}");
            }

            $dependency = $service->create(
                $predecessor->fresh(['column']),
                $successor->fresh(['column']),
            );

            $service->updateType($dependency, $type);
        }
    }

    private function validateDemo(Project $project): void
    {
        if ($project->boards()->count() !== self::EXPECTED_BOARDS) {
            throw new RuntimeException('Nébula Mobile no tiene el número esperado de Boards.');
        }

        $cards = Card::query()
            ->whereIn('board_id', $project->boards()->pluck('id'))
            ->with(['column', 'category', 'assignees', 'teams'])
            ->get();

        if ($cards->count() !== self::EXPECTED_CARDS) {
            throw new RuntimeException('Nébula Mobile no tiene el número esperado de Cards.');
        }

        if ($project->members()->count() !== self::EXPECTED_PROJECT_USERS) {
            throw new RuntimeException('Nébula Mobile no tiene los 24 miembros esperados.');
        }

        if (count($this->teams) !== self::EXPECTED_TEAMS) {
            throw new RuntimeException('Nébula Mobile no tiene los 8 equipos esperados.');
        }

        $projectMemberIds = $project->members()->pluck('user_id')->all();
        $demoDate = CarbonImmutable::parse(self::DEMO_DATE)->endOfDay();

        foreach ($cards as $card) {
            $state = $card->column->workflow_state;
            $total = $card->checklistItems()->count();
            $done = $card->checklistItems()->where('is_done', true)->count();

            if (trim((string) $card->description) === '') {
                throw new RuntimeException("Card sin descripción: {$card->title}");
            }

            if ($total === 0) {
                throw new RuntimeException("Card sin checklist: {$card->title}");
            }

            if ($state === 'backlog' && ($card->start_date || $card->due_date)) {
                throw new RuntimeException("Backlog con planificación: {$card->title}");
            }

            if (in_array($state, ['review', 'done'], true) && $done !== $total) {
                throw new RuntimeException("Card {$state} con checklist incompleto: {$card->title}");
            }

            if ($state === 'pending' && ($done !== 0 || $card->completed_at)) {
                throw new RuntimeException("Card pending incoherente: {$card->title}");
            }

            if ($state === 'in_progress' && (! $card->started_at || $card->completed_at || $done <= 0 || $done >= $total)) {
                throw new RuntimeException("Card in_progress incoherente: {$card->title}");
            }

            if (in_array($state, ['review', 'done'], true) && (! $card->started_at || ! $card->completed_at)) {
                throw new RuntimeException("Card {$state} sin fechas reales de ejecución: {$card->title}");
            }

            if ($card->started_at && CarbonImmutable::parse($card->started_at)->greaterThan($demoDate)) {
                throw new RuntimeException("Card con started_at posterior a DEMO_DATE: {$card->title}");
            }

            if ($card->completed_at && CarbonImmutable::parse($card->completed_at)->greaterThan($demoDate)) {
                throw new RuntimeException("Card con completed_at posterior a DEMO_DATE: {$card->title}");
            }

            if (
                $card->started_at
                && $card->completed_at
                && CarbonImmutable::parse($card->completed_at)->lessThan(CarbonImmutable::parse($card->started_at))
            ) {
                throw new RuntimeException("Card con completed_at anterior a started_at: {$card->title}");
            }

            foreach ($card->checklistItems as $item) {
                if ($item->is_done && ! $item->completed_at) {
                    throw new RuntimeException("Checklist completado sin completed_at: {$card->title}");
                }

                if (! $item->is_done && $item->completed_at) {
                    throw new RuntimeException("Checklist pendiente con completed_at: {$card->title}");
                }

                if ($item->completed_at) {
                    if (CarbonImmutable::parse($item->completed_at)->greaterThan($demoDate)) {
                        throw new RuntimeException("Checklist con completed_at posterior a DEMO_DATE: {$card->title}");
                    }

                    if (
                        $card->started_at
                        && CarbonImmutable::parse($item->completed_at)->lessThan(CarbonImmutable::parse($card->started_at))
                    ) {
                        throw new RuntimeException("Checklist completado antes de la Card: {$card->title}");
                    }

                    if (
                        $card->completed_at
                        && CarbonImmutable::parse($item->completed_at)->greaterThan(CarbonImmutable::parse($card->completed_at))
                    ) {
                        throw new RuntimeException("Checklist completado después de la Card: {$card->title}");
                    }
                }

                if ($state === 'backlog' && $item->due_date) {
                    throw new RuntimeException("Checklist de backlog con planificación: {$card->title}");
                }

                if ($item->due_date) {
                    if (! $card->start_date || ! $card->due_date) {
                        throw new RuntimeException("Checklist planificado en Card sin planificación: {$card->title}");
                    }

                    if (
                        $item->due_date->lessThan($card->start_date)
                        || $item->due_date->greaterThan($card->due_date)
                    ) {
                        throw new RuntimeException("Checklist fuera de la planificación de la Card: {$card->title}");
                    }
                }
            }

            if ($card->category_id && $card->category?->board_id !== $card->board_id) {
                throw new RuntimeException("Categoría de otro Board en Card: {$card->title}");
            }

            foreach ($card->assignees as $assignee) {
                if (! in_array($assignee->id, $projectMemberIds, true)) {
                    throw new RuntimeException("Responsable fuera del Project en Card: {$card->title}");
                }
            }

            foreach ($card->teams as $team) {
                if ($team->workspace_id !== $project->workspace_id) {
                    throw new RuntimeException("Equipo de otro Workspace en Card: {$card->title}");
                }
            }
        }

        $dependencies = CardDependency::query()
            ->whereIn('predecessor_card_id', $cards->pluck('id'))
            ->with(['predecessor.board', 'successor.board', 'predecessor.column', 'successor.column'])
            ->get();

        foreach ($dependencies as $dependency) {
            if (! in_array($dependency->type, CardDependencyService::TYPES, true)) {
                throw new RuntimeException('Tipo de dependencia inválido en la demo.');
            }

            if ($dependency->predecessor_card_id === $dependency->successor_card_id) {
                throw new RuntimeException('Dependencia de una Card consigo misma.');
            }

            if (
                $dependency->predecessor->board->project_id !== $project->id
                || $dependency->successor->board->project_id !== $project->id
            ) {
                throw new RuntimeException('Dependencia fuera del Project Nébula Mobile.');
            }

            if ($dependency->predecessor->archived_at || $dependency->successor->archived_at) {
                throw new RuntimeException('Dependencia activa con Card archivada.');
            }

            if (
                $dependency->predecessor->column->workflow_state === 'backlog'
                || $dependency->successor->column->workflow_state === 'backlog'
            ) {
                throw new RuntimeException('Dependencia activa con Card de backlog.');
            }
        }

        $this->assertNoDependencyCycles($dependencies);
    }

    private function assertNoDependencyCycles($dependencies): void
    {
        $adjacency = [];
        foreach ($dependencies as $dependency) {
            $adjacency[$dependency->predecessor_card_id][] = $dependency->successor_card_id;
        }

        $visiting = [];
        $visited = [];

        $visit = function (int $id) use (&$visit, &$visiting, &$visited, $adjacency): void {
            if (isset($visiting[$id])) {
                throw new RuntimeException('La demo contiene un ciclo de dependencias.');
            }
            if (isset($visited[$id])) {
                return;
            }

            $visiting[$id] = true;
            foreach ($adjacency[$id] ?? [] as $next) {
                $visit($next);
            }
            unset($visiting[$id]);
            $visited[$id] = true;
        };

        foreach (array_keys($adjacency) as $id) {
            $visit((int) $id);
        }
    }

    private function printSummary(Project $project): void
    {
        $boardIds = $project->boards()->pluck('id');
        $cards = Card::query()->whereIn('board_id', $boardIds)->get();
        $cardIds = $cards->pluck('id');
        $dependencies = CardDependency::query()
            ->whereIn('predecessor_card_id', $cardIds)
            ->with(['predecessor', 'successor'])
            ->get();

        $crossBoard = $dependencies->filter(
            fn (CardDependency $dependency) => $dependency->predecessor->board_id !== $dependency->successor->board_id
        )->count();
        $items = $cards->load('checklistItems')->flatMap->checklistItems;
        $withDueDate = $items->filter(fn ($item) => $item->due_date !== null);
        $completed = $items->filter(fn ($item) => $item->is_done);
        $demoDate = CarbonImmutable::parse(self::DEMO_DATE)->endOfDay();
        $completedBeforeDue = $completed->filter(
            fn ($item) => $item->due_date && $item->completed_at && $item->completed_at->toDateString() < $item->due_date->toDateString()
        )->count();
        $completedSameDayDue = $completed->filter(
            fn ($item) => $item->due_date && $item->completed_at && $item->completed_at->toDateString() === $item->due_date->toDateString()
        )->count();
        $completedAfterDue = $completed->filter(
            fn ($item) => $item->due_date && $item->completed_at && $item->completed_at->toDateString() > $item->due_date->toDateString()
        )->count();

        $this->command?->info('Nébula Mobile creada y validada:');
        $this->command?->line('- Boards: '.$project->boards()->count());
        $this->command?->line('- Cards: '.$cards->count());
        $this->command?->line('- Miembros del Project: '.$project->members()->count());
        $this->command?->line('- Equipos: '.count($this->teams));
        $this->command?->line('- Archivadas: '.$cards->filter(fn (Card $card) => $card->archived_at !== null)->count());
        $this->command?->line('- Cards con adjuntos: '.CardAttachment::query()->whereIn('card_id', $cardIds)->distinct()->count('card_id'));
        $this->command?->line('- Dependencias: '.$dependencies->count());
        $this->command?->line('- Dependencias cross-board: '.$crossBoard);
        $this->command?->line('- Checklist items: '.$items->count());
        $this->command?->line('- Checklist con due_date: '.$withDueDate->count());
        $this->command?->line('- Checklist sin due_date: '.($items->count() - $withDueDate->count()));
        $this->command?->line('- Checklist completados: '.$completed->count());
        $this->command?->line('- Checklist con completed_at: '.$items->filter(fn ($item) => $item->completed_at !== null)->count());
        $this->command?->line('- Completados antes de due_date: '.$completedBeforeDue);
        $this->command?->line('- Completados el mismo día: '.$completedSameDayDue);
        $this->command?->line('- Completados después de due_date: '.$completedAfterDue);
        $this->command?->line('- Incoherencias checklist: 0');
    }
}
