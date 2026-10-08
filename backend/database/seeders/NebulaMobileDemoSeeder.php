<?php

namespace Database\Seeders;

use App\Models\Card;
use App\Models\CardDependency;
use App\Models\CardModule;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Nébula Mobile: entorno permanente de demostración y pruebas de Tickard.
 *
 * Es idempotente para los registros que identifica por nombre/título.
 * No elimina proyectos, tableros ni tarjetas creados manualmente.
 * Las fechas son absolutas para que el Gantt sea reproducible.
 */
class NebulaMobileDemoSeeder extends Seeder
{
    private const PROJECT = 'Nébula Mobile';

    private array $people = [];
    private array $cards = [];
    private array $teams = [];

    public function run(): void
    {
        DB::transaction(function (): void {
            $this->preparePeople();
            $ana = $this->people['ana'];
            $workspace = $ana->workspaces()->where('name', 'Tickard Demo')->firstOrFail();
            $this->prepareWorkspaceMembers($workspace);
            $this->prepareTeams($workspace);

            $client = ClientCompany::firstOrCreate([
                'workspace_id' => $workspace->id,
                'name' => 'Aster Labs',
            ]);
            $project = Project::firstOrCreate([
                'workspace_id' => $workspace->id,
                'name' => self::PROJECT,
            ], [
                'client_company_id' => $client->id,
                'show_description' => true,
                'show_assignee' => true,
                'show_due_date' => true,
                'show_priority' => true,
                'show_labels' => true,
                'show_comments' => true,
            ]);
            $project->update([
                'client_company_id' => $client->id,
                'show_description' => true,
                'show_assignee' => true,
                'show_due_date' => true,
                'show_priority' => true,
                'show_labels' => true,
                'show_comments' => true,
            ]);

            foreach ($this->people as $key => $person) {
                $project->members()->firstOrCreate(['user_id' => $person->id], [
                    'role' => $key === 'ana' ? 'responsable' : ($key === 'elena' ? 'cliente' : 'editor'),
                ]);
            }

            foreach ([
                'Producto' => 'niebla', 'Diseño' => 'ciruela', 'Frontend' => 'bosque',
                'Backend' => 'bambu', 'QA' => 'arena', 'DevOps' => 'tinta',
                'Seguridad' => 'ciruela', 'Datos' => 'bambu', 'Marketing' => 'arena',
                'Móvil' => 'bosque', 'Integraciones' => 'niebla',
            ] as $name => $tone) {
                $project->labels()->firstOrCreate(['name' => $name], ['tone' => $tone]);
            }

            foreach ($this->plan() as $boardPosition => $phase) {
                $board = $project->boards()->firstOrCreate(['name' => $phase['name']], ['position' => $boardPosition]);
                if ($board->columns()->count() === 0) {
                    $board->createDefaultColumns();
                }
                $colors = [
                    'Backlog' => '#8B98A5', 'Por hacer' => '#4C8BF5',
                    'En progreso' => '#F39C4A', 'En revisión' => '#9B6BE8',
                    'Completado' => '#38A37A',
                ];
                foreach ($board->columns as $column) {
                    if (isset($colors[$column->name]) && !$column->color) {
                        $column->update(['color' => $colors[$column->name]]);
                    }
                }
                foreach ($phase['groups'] as $groupPosition => $group) {
                    $category = $board->categories()->firstOrCreate(['name' => $group['name']], ['position' => $groupPosition]);
                    foreach ($group['tasks'] as $taskPosition => $task) {
                        $this->seedCard($project, $board, $category, $task, $taskPosition);
                    }
                }
            }
            $this->seedDependencies();
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
            $this->people[$key] = User::firstOrCreate(['email' => $email], [
                'name' => $name, 'password' => 'password', 'plan' => User::PLAN_BASE,
            ]);
        }
    }

    private function prepareWorkspaceMembers($workspace): void
    {
        foreach ($this->people as $key => $person) {
            $workspace->memberships()->firstOrCreate(['user_id' => $person->id], [
                'role' => $key === 'ana' ? 'owner' : 'member',
            ]);
        }
    }

    private function prepareTeams($workspace): void
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
        ];
        foreach ($definitions as $name => $keys) {
            $team = Team::firstOrCreate(['workspace_id' => $workspace->id, 'name' => $name]);
            $team->members()->syncWithoutDetaching(array_map(fn ($key) => $this->people[$key]->id, $keys));
            $this->teams[$name] = $team;
        }
    }

    /**
     * Cada grupo contiene tarjetas con descripciones y checklists propias.
     * Los porcentajes no se almacenan: CardPresenter los calcula a partir de is_done.
     */
    private function plan(): array
    {
        return [
            $this->phase('01 · Descubrimiento y estrategia', [
                $this->group('Investigación', '2026-08-31', [
                    ['Definir visión y objetivos de Nébula', 12, 100, 'ana', 'Producto'],
                    ['Entrevistar usuarios y validar necesidades', 16, 100, 'clara', 'Producto'],
                    ['Analizar competidores y oportunidades', 18, 100, 'elena', 'Producto'],
                    ['Definir personas y escenarios de uso', 12, 100, 'marta', 'Diseño'],
                    ['Priorizar alcance del MVP', 14, 100, 'ana', 'Producto'],
                    ['Preparar roadmap y presupuesto inicial', 20, 100, 'clara', 'Producto'],
                ]),
                $this->group('Arquitectura', '2026-09-14', [
                    ['Seleccionar stack móvil y API', 16, 100, 'luis', 'Backend'],
                    ['Diseñar arquitectura de servicios', 22, 100, 'pablo', 'Backend'],
                    ['Definir modelo de datos y migraciones', 18, 100, 'luis', 'Backend'],
                    ['Diseñar estrategia de autenticación', 15, 100, 'marcos', 'Backend'],
                    ['Documentar riesgos y decisiones técnicas', 12, 100, 'ana', 'Producto'],
                ]),
            ]),
            $this->phase('02 · Experiencia y diseño', [
                $this->group('UX', '2026-09-21', [
                    ['Mapear flujos de registro y acceso', 16, 100, 'marta', 'Diseño'],
                    ['Diseñar navegación de viajes', 22, 100, 'sofia', 'Diseño'],
                    ['Prototipar itinerarios colaborativos', 26, 100, 'marta', 'Diseño'],
                    ['Validar accesibilidad y contraste', 16, 100, 'sofia', 'Diseño'],
                    ['Realizar pruebas de usabilidad', 20, 100, 'marta', 'Diseño'],
                ]),
                $this->group('Sistema visual', '2026-10-05', [
                    ['Definir tokens y tipografía', 14, 100, 'sofia', 'Diseño'],
                    ['Construir biblioteca de componentes', 32, 100, 'marta', 'Diseño'],
                    ['Preparar iconografía e ilustraciones', 24, 100, 'sofia', 'Diseño'],
                    ['Documentar estados vacíos y errores', 18, 75, 'marta', 'Diseño'],
                ]),
            ]),
            $this->phase('03 · Desarrollo MVP', [
                $this->group('Cuenta y acceso', '2026-10-05', [
                    ['Implementar registro e inicio de sesión', 28, 100, 'luis', 'Backend'],
                    ['Recuperación y cambio de contraseña', 18, 100, 'marcos', 'Backend'],
                    ['Perfil, avatar y preferencias', 25, 75, 'diego', 'Frontend'],
                    ['Permisos y sesiones multidispositivo', 28, 75, 'pablo', 'Backend'],
                    ['Onboarding de nuevos usuarios', 22, 50, 'noa', 'Frontend'],
                ]),
                $this->group('Viajes', '2026-10-19', [
                    ['Crear y editar viaje', 35, 75, 'ana', 'Frontend'],
                    ['Invitar participantes al viaje', 32, 50, 'luis', 'Backend'],
                    ['Gestionar roles de participantes', 30, 50, 'pablo', 'Backend'],
                    ['Itinerario colaborativo', 44, 25, 'diego', 'Frontend'],
                    ['Calendario y actividades del viaje', 36, 25, 'noa', 'Frontend'],
                    ['Compartir documentos del viaje', 24, 0, 'marcos', 'Backend'],
                ]),
                $this->group('Gastos compartidos', '2026-11-02', [
                    ['Registrar gastos y justificantes', 34, 50, 'luis', 'Backend'],
                    ['Calcular balances entre participantes', 35, 25, 'pablo', 'Backend'],
                    ['Diseñar resumen visual de gastos', 26, 25, 'sofia', 'Diseño'],
                    ['Exportar gastos a CSV y PDF', 24, 0, 'diego', 'Frontend'],
                    ['Gestionar divisas y redondeos', 30, 0, 'marcos', 'Backend'],
                ]),
                $this->group('Comunicación', '2026-11-16', [
                    ['Notificaciones push y preferencias', 35, 25, 'noa', 'Frontend'],
                    ['Comentarios en actividades', 25, 0, 'diego', 'Frontend'],
                    ['Invitaciones por correo electrónico', 20, 0, 'pablo', 'Backend'],
                    ['Recordatorios inteligentes de viaje', null, 0, 'ana', 'Producto'],
                ]),
            ]),
            $this->phase('04 · QA, beta y estabilización', [
                $this->group('Calidad', '2027-01-04', [
                    ['Preparar estrategia de pruebas', 21, 0, 'irene', 'QA'],
                    ['Automatizar pruebas de autenticación', 35, 0, 'lara', 'QA'],
                    ['Ejecutar pruebas E2E de viajes', 40, 0, 'irene', 'QA'],
                    ['Validar balances y cálculos de gastos', 32, 0, 'lara', 'QA'],
                    ['Revisar accesibilidad móvil', 25, 0, 'marta', 'Diseño'],
                    ['Pruebas exploratorias de la beta', 28, 0, 'irene', 'QA'],
                ]),
                $this->group('Rendimiento y seguridad', '2027-02-01', [
                    ['Optimizar arranque y navegación', 35, 0, 'diego', 'Frontend'],
                    ['Reducir consultas y tiempos de API', 40, 0, 'luis', 'Backend'],
                    ['Ejecutar auditoría de seguridad', 30, 0, 'marcos', 'Backend'],
                    ['Pruebas de carga con usuarios concurrentes', 25, 0, 'hugo', 'DevOps'],
                    ['Corregir defectos críticos de beta', 38, 0, 'lara', 'QA'],
                ]),
            ]),
            $this->phase('05 · Lanzamiento 1.0', [
                $this->group('Infraestructura', '2027-03-01', [
                    ['Preparar entornos de producción', 28, 0, 'hugo', 'DevOps'],
                    ['Configurar monitorización y alertas', 24, 0, 'bruno', 'DevOps'],
                    ['Automatizar despliegues y rollback', 30, 0, 'hugo', 'DevOps'],
                    ['Validar copias de seguridad y restauración', 18, 0, 'bruno', 'DevOps'],
                ]),
                $this->group('Publicación', '2027-03-22', [
                    ['Preparar ficha de Google Play', 21, 0, 'clara', 'Marketing'],
                    ['Preparar ficha de App Store', 21, 0, 'sofia', 'Diseño'],
                    ['Validar release candidate', 15, 0, 'irene', 'QA'],
                    ['Publicar Nébula Mobile 1.0', 1, 0, 'ana', 'Producto'],
                    ['Monitorizar primera semana de lanzamiento', 7, 0, 'hugo', 'DevOps'],
                ]),
            ]),
            $this->phase('06 · Evolución 1.1 y comunidad', [
                $this->group('Experiencia', '2027-05-03', [
                    ['Analizar feedback del lanzamiento', 25, 0, 'clara', 'Producto'],
                    ['Mejorar búsqueda y filtros de viajes', 35, 0, 'noa', 'Frontend'],
                    ['Añadir plantillas de itinerarios', 45, 0, 'diego', 'Frontend'],
                    ['Implementar modo sin conexión básico', 55, 0, 'pablo', 'Backend'],
                    ['Optimizar sincronización en segundo plano', 40, 0, 'luis', 'Backend'],
                ]),
                $this->group('Comunidad', '2027-07-05', [
                    ['Perfiles públicos y privacidad', 45, 0, 'marcos', 'Backend'],
                    ['Compartir itinerarios públicos', 40, 0, 'noa', 'Frontend'],
                    ['Valoraciones y recomendaciones', 48, 0, 'diego', 'Frontend'],
                    ['Moderación y denuncias', 42, 0, 'lara', 'QA'],
                ]),
            ]),
            $this->phase('07 · Expansión internacional', [
                $this->group('Localización', '2027-09-06', [
                    ['Preparar internacionalización de interfaz', 50, 0, 'sofia', 'Diseño'],
                    ['Traducir contenido a inglés y portugués', 60, 0, 'clara', 'Marketing'],
                    ['Adaptar fechas, zonas horarias y formatos', 42, 0, 'pablo', 'Backend'],
                    ['Gestionar divisas internacionales', 50, 0, 'luis', 'Backend'],
                    ['Validar flujos multilingües', 35, 0, 'irene', 'QA'],
                ]),
                $this->group('Crecimiento', '2027-11-01', [
                    ['Diseñar campañas de adquisición', 45, 0, 'clara', 'Marketing'],
                    ['Crear programa de invitaciones', 40, 0, 'ana', 'Producto'],
                    ['Analizar cohortes de retención', 55, 0, 'vera', 'Datos'],
                    ['Experimentar con onboarding A/B', 45, 0, 'noa', 'Frontend'],
                ]),
            ]),
            $this->phase('08 · Plataforma premium', [
                $this->group('Suscripciones', '2028-01-10', [
                    ['Definir catálogo de planes premium', 35, 0, 'ana', 'Producto'],
                    ['Diseñar experiencia de suscripción', 45, 0, 'marta', 'Diseño'],
                    ['Integrar pasarela de pagos', 65, 0, 'luis', 'Backend'],
                    ['Gestionar renovaciones y cancelaciones', 50, 0, 'pablo', 'Backend'],
                    ['Emitir facturas y gestionar impuestos', 55, 0, 'marcos', 'Backend'],
                    ['Auditar seguridad de pagos', 40, 0, 'irene', 'QA'],
                ]),
                $this->group('Funcionalidades avanzadas', '2028-04-03', [
                    ['Planificador avanzado de rutas', 70, 0, 'diego', 'Frontend'],
                    ['Presupuestos y alertas inteligentes', 65, 0, 'vera', 'Datos'],
                    ['Exportación avanzada de itinerarios', 50, 0, 'noa', 'Frontend'],
                    ['Panel de estadísticas personales', 55, 0, 'vera', 'Datos'],
                ]),
            ]),
            $this->phase('09 · Integraciones y ecosistema', [
                $this->group('Integraciones', '2028-06-03', [
                    ['Integrar calendarios externos', 65, 0, 'pablo', 'Backend'],
                    ['Integrar mapas y geolocalización', 75, 0, 'diego', 'Frontend'],
                    ['Sincronizar reservas y confirmaciones', 70, 0, 'luis', 'Backend'],
                    ['Publicar API para integradores', 85, 0, 'marcos', 'Backend'],
                    ['Desarrollar webhooks y reintentos', 60, 0, 'pablo', 'Backend'],
                ]),
                $this->group('Partners', '2028-09-02', [
                    ['Definir programa de socios', 45, 0, 'elena', 'Marketing'],
                    ['Crear portal para colaboradores', 70, 0, 'noa', 'Frontend'],
                    ['Construir panel de métricas B2B', 65, 0, 'vera', 'Datos'],
                    ['Realizar piloto con agencias', 75, 0, 'clara', 'Marketing'],
                ]),
            ]),
            $this->phase('10 · Escalabilidad y datos', [
                $this->group('Infraestructura', '2028-10-01', [
                    ['Separar procesos asíncronos y colas', 70, 0, 'hugo', 'DevOps'],
                    ['Optimizar almacenamiento de adjuntos', 60, 0, 'bruno', 'DevOps'],
                    ['Diseñar escalado horizontal de API', 85, 0, 'luis', 'Backend'],
                    ['Implementar caché y observabilidad', 70, 0, 'hugo', 'DevOps'],
                    ['Ensayar recuperación ante desastres', 50, 0, 'bruno', 'DevOps'],
                ]),
                $this->group('Analítica', '2028-12-03', [
                    ['Consolidar eventos de producto', 60, 0, 'vera', 'Datos'],
                    ['Construir modelos de métricas', 70, 0, 'vera', 'Datos'],
                    ['Crear panel de KPIs ejecutivos', 65, 0, 'clara', 'Producto'],
                    ['Validar privacidad y retención de datos', 55, 0, 'marcos', 'Backend'],
                ]),
            ]),
            $this->phase('11 · Rediseño Nébula 2.0', [
                $this->group('Investigación y diseño', '2029-02-05', [
                    ['Investigar necesidades de usuarios veteranos', 65, 0, 'marta', 'Diseño'],
                    ['Redefinir arquitectura de información', 70, 0, 'sofia', 'Diseño'],
                    ['Diseñar nuevo sistema visual 2.0', 85, 0, 'marta', 'Diseño'],
                    ['Probar prototipos de navegación', 55, 0, 'sofia', 'Diseño'],
                ]),
                $this->group('Implementación', '2029-05-06', [
                    ['Migrar navegación a la versión 2.0', 90, 0, 'diego', 'Frontend'],
                    ['Refactorizar módulos móviles', 95, 0, 'noa', 'Frontend'],
                    ['Compatibilizar API y clientes antiguos', 80, 0, 'pablo', 'Backend'],
                    ['Ejecutar regresión funcional completa', 65, 0, 'lara', 'QA'],
                    ['Publicar Nébula Mobile 2.0', 1, 0, 'ana', 'Producto'],
                ]),
            ]),
            $this->phase('12 · Operación y roadmap 2030', [
                $this->group('Operación', '2029-08-05', [
                    ['Monitorizar estabilidad post 2.0', 60, 0, 'hugo', 'DevOps'],
                    ['Optimizar costes de infraestructura', 75, 0, 'bruno', 'DevOps'],
                    ['Revisar cumplimiento y seguridad anual', 70, 0, 'marcos', 'Backend'],
                    ['Auditar satisfacción y soporte', 65, 0, 'clara', 'Producto'],
                ]),
                $this->group('Futuro', '2029-10-07', [
                    ['Investigar asistente inteligente de viajes', 70, 0, 'vera', 'Datos'],
                    ['Definir roadmap de producto 2030', 60, 0, 'ana', 'Producto'],
                    ['Preparar presupuesto y capacidad 2030', 50, 0, 'elena', 'Producto'],
                    ['Evaluar integraciones futuras', null, 0, 'pablo', 'Backend'],
                ]),
            ]),
        ];
    }

    private function phase(string $name, array $groups): array
    {
        return compact('name', 'groups');
    }

    private function group(string $name, string $start, array $tasks): array
    {
        $result = [];
        foreach ($tasks as $index => [$title, $duration, $progress, $owner, $label]) {
            $date = \Carbon\CarbonImmutable::parse($start)->addDays($index * 9);
            $result[] = [
                'title' => $title,
                'start' => $duration === null ? null : $date->toDateString(),
                'end' => $duration === null ? null : $date->addDays($duration - 1)->toDateString(),
                'progress' => $progress,
                'owner' => $owner,
                'label' => $label,
                'group' => $name,
            ];
        }
        return ['name' => $name, 'tasks' => $result];
    }

    private function seedCard($project, $board, $category, array $task, int $position): void
    {
        $progress = $task['progress'];
        $columnName = $task['start'] === null ? 'Backlog' : match (true) {
            $progress === 100 => 'Completado',
            $progress >= 75 => 'En revisión',
            $progress > 0 => 'En progreso',
            default => 'Por hacer',
        };
        $column = $board->columns()->where('name', $columnName)->firstOrFail();
        $creator = $this->people[$task['owner']];
        $description = "**Objetivo:** {$task['title']}.\n\n".
            "**Contexto:** Nébula Mobile / {$board->name} / {$task['group']}.\n\n".
            "**Alcance:** analizar requisitos, implementar la solución acordada, validar los casos de uso y documentar el resultado.\n\n".
            "**Criterios de aceptación:** comportamiento verificable, ausencia de errores críticos, revisión del responsable y evidencias registradas en la checklist.";

        $card = $board->cards()->firstOrCreate(['title' => $task['title']], [
            'column_id' => $column->id,
            'category_id' => $category->id,
            'description' => $description,
            'start_date' => $task['start'],
            'due_date' => $task['end'],
            'started_at' => $progress > 0 && $task['start'] ? $task['start'].' 09:00:00' : null,
            'completed_at' => $progress === 100 && $task['end'] ? $task['end'].' 18:00:00' : null,
            'priority' => str_contains($task['title'], 'Publicar') ? 'urgente' : ($position % 4 === 0 ? 'alta' : 'media'),
            'position' => $position,
            'created_by' => $creator->id,
        ]);
        $card->assignees()->syncWithoutDetaching([$creator->id]);
        $labelIds = $project->labels()->whereIn('name', [$task['label']])->pluck('id')->all();
        $card->labels()->syncWithoutDetaching($labelIds);
        if (isset($this->teams[$task['label']])) {
            $card->teams()->syncWithoutDetaching([$this->teams[$task['label']]->id]);
        }
        $this->seedModules($card, $task, $creator);
        $this->seedComments($card, $task, $creator);
        $this->cards[$task['title']] = $card;
    }

    private function seedModules(Card $card, array $task, User $owner): void
    {
        $title = $task['title'];
        $modules = [
            'Análisis y preparación' => [
                "Revisar requisitos y alcance de: {$title}",
                'Identificar riesgos y dependencias técnicas',
                'Acordar criterios de aceptación con el equipo',
                'Preparar diseño técnico y estimaciones',
            ],
            'Implementación y entrega' => [
                "Desarrollar la funcionalidad: {$title}",
                'Cubrir casos límite y estados de error',
                'Añadir pruebas automatizadas relevantes',
                'Validar integración con el resto del producto',
                'Actualizar documentación funcional o técnica',
                'Realizar revisión y cerrar observaciones',
            ],
        ];
        $total = array_sum(array_map('count', $modules));
        $done = (int) round($total * $task['progress'] / 100);
        $offset = 0;
        $modulePosition = 0;
        foreach ($modules as $moduleTitle => $items) {
            $module = $card->modules()->firstOrCreate([
                'type' => CardModule::TYPE_CHECKLIST,
                'title' => $moduleTitle,
            ], ['position' => $modulePosition]);
            foreach ($items as $position => $body) {
                $item = $module->checklistItems()->firstOrCreate(['body' => $body], [
                    'card_id' => $card->id,
                    'position' => $position,
                    'is_done' => $offset < $done,
                    'due_date' => $task['end'],
                ]);
                $item->assignees()->syncWithoutDetaching([$owner->id]);
                $offset++;
            }
            $modulePosition++;
        }
        $card->modules()->firstOrCreate(['type' => CardModule::TYPE_COMMENTS], ['position' => $modulePosition]);
    }

    private function seedComments(Card $card, array $task, User $owner): void
    {
        $progress = $task['progress'];
        $body = "Inicio de seguimiento: necesitamos concretar el alcance de «{$task['title']}» y dejar constancia de los criterios de aceptación.";
        $root = $card->comments()->firstOrCreate(['body' => $body], [
            'user_id' => $owner->id, 'is_internal' => false,
        ]);
        if ($progress > 0) {
            $reviewer = $this->people['ana'];
            $reply = $progress === 100
                ? 'Validación final completada. Las comprobaciones previstas están cerradas.'
                : "Revisión de avance: {$progress}% de referencia. Pendiente cerrar los elementos restantes y comprobar integración.";
            $card->comments()->firstOrCreate(['body' => $reply, 'parent_id' => $root->id], [
                'user_id' => $reviewer->id, 'is_internal' => false,
            ]);
        }
        if ($progress >= 50) {
            $card->comments()->firstOrCreate([
                'body' => 'Nota interna de coordinación: verificar cobertura de pruebas y dependencias antes de dar por finalizada la entrega.',
            ], [
                'user_id' => $this->people['irene']->id, 'is_internal' => true,
            ]);
        }
    }

    private function seedDependencies(): void
    {
        $links = [
            ['Definir visión y objetivos de Nébula', 'Priorizar alcance del MVP', 'fs'],
            ['Entrevistar usuarios y validar necesidades', 'Definir personas y escenarios de uso', 'fs'],
            ['Priorizar alcance del MVP', 'Seleccionar stack móvil y API', 'fs'],
            ['Seleccionar stack móvil y API', 'Diseñar arquitectura de servicios', 'fs'],
            ['Diseñar arquitectura de servicios', 'Definir modelo de datos y migraciones', 'ss'],
            ['Mapear flujos de registro y acceso', 'Implementar registro e inicio de sesión', 'fs'],
            ['Diseñar navegación de viajes', 'Crear y editar viaje', 'fs'],
            ['Crear y editar viaje', 'Invitar participantes al viaje', 'ss'],
            ['Invitar participantes al viaje', 'Gestionar roles de participantes', 'fs'],
            ['Itinerario colaborativo', 'Calendario y actividades del viaje', 'ss'],
            ['Registrar gastos y justificantes', 'Calcular balances entre participantes', 'fs'],
            ['Calcular balances entre participantes', 'Validar balances y cálculos de gastos', 'fs'],
            ['Implementar registro e inicio de sesión', 'Automatizar pruebas de autenticación', 'fs'],
            ['Crear y editar viaje', 'Ejecutar pruebas E2E de viajes', 'fs'],
            ['Preparar estrategia de pruebas', 'Pruebas exploratorias de la beta', 'ss'],
            ['Preparar entornos de producción', 'Automatizar despliegues y rollback', 'ss'],
            ['Validar release candidate', 'Publicar Nébula Mobile 1.0', 'fs'],
            ['Publicar Nébula Mobile 1.0', 'Monitorizar primera semana de lanzamiento', 'fs'],
            ['Analizar feedback del lanzamiento', 'Mejorar búsqueda y filtros de viajes', 'fs'],
            ['Preparar internacionalización de interfaz', 'Traducir contenido a inglés y portugués', 'ss'],
            ['Traducir contenido a inglés y portugués', 'Validar flujos multilingües', 'ff'],
            ['Definir catálogo de planes premium', 'Diseñar experiencia de suscripción', 'fs'],
            ['Integrar pasarela de pagos', 'Auditar seguridad de pagos', 'ff'],
            ['Publicar API para integradores', 'Desarrollar webhooks y reintentos', 'ss'],
            ['Separar procesos asíncronos y colas', 'Implementar caché y observabilidad', 'ss'],
            ['Diseñar nuevo sistema visual 2.0', 'Migrar navegación a la versión 2.0', 'fs'],
            ['Migrar navegación a la versión 2.0', 'Ejecutar regresión funcional completa', 'ff'],
            ['Ejecutar regresión funcional completa', 'Publicar Nébula Mobile 2.0', 'fs'],
            ['Publicar Nébula Mobile 2.0', 'Monitorizar estabilidad post 2.0', 'fs'],
            ['Definir roadmap de producto 2030', 'Preparar presupuesto y capacidad 2030', 'sf'],
        ];
        foreach ($links as [$before, $after, $type]) {
            $a = $this->cards[$before] ?? null;
            $b = $this->cards[$after] ?? null;
            if (!$a || !$b || !$a->start_date || !$a->due_date || !$b->start_date || !$b->due_date) {
                continue;
            }
            CardDependency::firstOrCreate([
                'predecessor_card_id' => $a->id,
                'successor_card_id' => $b->id,
            ], ['type' => $type]);
        }
    }
}
