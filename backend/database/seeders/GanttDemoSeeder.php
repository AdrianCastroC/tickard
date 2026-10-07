<?php

namespace Database\Seeders;

use App\Models\Card;
use App\Models\ClientCompany;
use App\Models\Column;
use App\Models\Project;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Seeder;

class GanttDemoSeeder extends Seeder
{
    /**
     * Proyecto de demostración preparado específicamente para probar:
     *
     * - Gantt de Board.
     * - Futuro Gantt global de Proyecto.
     * - KPIs de tareas, progreso, fechas y equipo.
     * - Categorías.
     * - Periodos solapados.
     * - Cards sin planificación.
     * - Cards de un único día.
     * - Distintos estados y porcentajes de progreso.
     */
    public function run(): void
    {
        $ana = User::where('email', 'ana@gestor.test')->firstOrFail();
        $luis = User::where('email', 'luis@gestor.test')->firstOrFail();
        $marta = User::where('email', 'marta@gestor.test')->firstOrFail();
        $elena = User::where('email', 'elena@gestor.test')->firstOrFail();

        $workspace = $ana->workspaces()
            ->where('name', 'Tickard Demo')
            ->firstOrFail();

        /*
         * Permite ejecutar este seeder varias veces sin ir acumulando
         * copias del proyecto de pruebas.
         */
        Project::where('workspace_id', $workspace->id)
            ->where('name', 'Nébula Mobile')
            ->first()
            ?->delete();

        $client = ClientCompany::firstOrCreate(
            [
                'workspace_id' => $workspace->id,
                'name' => 'Aster Labs',
            ],
        );

        $project = Project::create([
            'workspace_id' => $workspace->id,
            'client_company_id' => $client->id,
            'name' => 'Nébula Mobile',

            'show_description' => true,
            'show_assignee' => true,
            'show_due_date' => true,
            'show_priority' => true,
            'show_labels' => true,
            'show_comments' => true,
        ]);

        /*
         * Equipo del proyecto.
         */
        foreach ([
            [$ana, 'responsable'],
            [$luis, 'editor'],
            [$marta, 'editor'],
            [$elena, 'cliente'],
        ] as [$user, $role]) {
            $project->members()->create([
                'user_id' => $user->id,
                'role' => $role,
            ]);
        }

        /*
         * Etiquetas compartidas por todos los Boards.
         */
        foreach ([
            ['Frontend', 'bosque'],
            ['Backend', 'bambu'],
            ['Diseño', 'ciruela'],
            ['QA', 'arena'],
            ['DevOps', 'tinta'],
            ['Producto', 'niebla'],
        ] as [$name, $tone]) {
            $project->labels()->create([
                'name' => $name,
                'tone' => $tone,
            ]);
        }

        $users = [
            'ana' => $ana,
            'luis' => $luis,
            'marta' => $marta,
            'elena' => $elena,
        ];

        $teams = Team::where('workspace_id', $workspace->id)
            ->get()
            ->keyBy('name');

        /*
         |--------------------------------------------------------------------------
         | BOARD 1
         |--------------------------------------------------------------------------
         |
         | Fase inicial del proyecto.
         | Principalmente fechas pasadas para comprobar el Gantt histórico.
         |
         */
        $discovery = $this->createBoard(
            $project,
            '01 · Descubrimiento y UX',
            0,
            [
                'Investigación',
                'Diseño UX/UI',
                'Arquitectura',
            ],
        );

        $this->createCard($discovery, $users, $teams, [
            'category' => 'Investigación',
            'column' => 'Completado',
            'title' => 'Definir objetivos del producto',
            'description' => 'Definir alcance, usuarios objetivo y métricas principales de Nébula.',
            'start' => '2026-08-31',
            'end' => '2026-09-03',
            'priority' => 'alta',
            'progress' => 100,
            'assignees' => ['ana'],
            'labels' => ['Producto'],
            'color' => '#5B8DEF',
        ]);

        $this->createCard($discovery, $users, $teams, [
            'category' => 'Investigación',
            'column' => 'Completado',
            'title' => 'Entrevistas con usuarios',
            'start' => '2026-09-02',
            'end' => '2026-09-08',
            'priority' => 'media',
            'progress' => 100,
            'assignees' => ['ana', 'marta'],
            'labels' => ['Producto', 'Diseño'],
            'color' => '#5B8DEF',
        ]);

        $this->createCard($discovery, $users, $teams, [
            'category' => 'Investigación',
            'column' => 'Completado',
            'title' => 'Mapa de funcionalidades del MVP',
            'start' => '2026-09-07',
            'end' => '2026-09-11',
            'priority' => 'alta',
            'progress' => 100,
            'assignees' => ['ana', 'luis'],
            'labels' => ['Producto'],
            'color' => '#5B8DEF',
        ]);

        $this->createCard($discovery, $users, $teams, [
            'category' => 'Diseño UX/UI',
            'column' => 'Completado',
            'title' => 'Wireframes de navegación',
            'start' => '2026-09-08',
            'end' => '2026-09-14',
            'priority' => 'media',
            'progress' => 100,
            'assignees' => ['marta'],
            'labels' => ['Diseño'],
            'team' => 'Diseño',
            'color' => '#9B6BE8',
        ]);

        $this->createCard($discovery, $users, $teams, [
            'category' => 'Diseño UX/UI',
            'column' => 'Completado',
            'title' => 'Sistema visual y componentes base',
            'start' => '2026-09-12',
            'end' => '2026-09-21',
            'priority' => 'alta',
            'progress' => 100,
            'assignees' => ['marta'],
            'labels' => ['Diseño', 'Frontend'],
            'team' => 'Diseño',
            'color' => '#9B6BE8',
        ]);

        $this->createCard($discovery, $users, $teams, [
            'category' => 'Arquitectura',
            'column' => 'Completado',
            'title' => 'Definir arquitectura móvil y API',
            'start' => '2026-09-10',
            'end' => '2026-09-16',
            'priority' => 'alta',
            'progress' => 100,
            'assignees' => ['ana', 'luis'],
            'labels' => ['Backend', 'Frontend'],
            'team' => 'Producto',
            'color' => '#37A98C',
        ]);

        $this->createCard($discovery, $users, $teams, [
            'category' => 'Arquitectura',
            'column' => 'Completado',
            'title' => 'Modelo inicial de datos',
            'start' => '2026-09-15',
            'end' => '2026-09-18',
            'priority' => 'media',
            'progress' => 100,
            'assignees' => ['luis'],
            'labels' => ['Backend'],
            'color' => '#37A98C',
        ]);

        /*
         |--------------------------------------------------------------------------
         | BOARD 2
         |--------------------------------------------------------------------------
         |
         | Desarrollo principal.
         | Mezcla tareas completadas, en progreso, revisión y futuras.
         |
         */
        $mvp = $this->createBoard(
            $project,
            '02 · Desarrollo MVP',
            1,
            [
                'Cuenta y acceso',
                'Viajes',
                'Gastos compartidos',
                'Notificaciones',
            ],
        );

        $this->createCard($mvp, $users, $teams, [
            'category' => 'Cuenta y acceso',
            'column' => 'Completado',
            'title' => 'Registro e inicio de sesión',
            'start' => '2026-09-21',
            'end' => '2026-09-28',
            'priority' => 'alta',
            'progress' => 100,
            'assignees' => ['luis'],
            'labels' => ['Backend', 'Frontend'],
            'color' => '#3D8BFD',
        ]);

        $this->createCard($mvp, $users, $teams, [
            'category' => 'Cuenta y acceso',
            'column' => 'Completado',
            'title' => 'Recuperación de contraseña',
            'start' => '2026-09-25',
            'end' => '2026-09-30',
            'priority' => 'media',
            'progress' => 100,
            'assignees' => ['luis'],
            'labels' => ['Backend'],
            'color' => '#3D8BFD',
        ]);

        $this->createCard($mvp, $users, $teams, [
            'category' => 'Viajes',
            'column' => 'En revisión',
            'title' => 'Crear y editar viaje',
            'start' => '2026-09-28',
            'end' => '2026-10-08',
            'priority' => 'alta',
            'progress' => 75,
            'assignees' => ['ana', 'luis'],
            'labels' => ['Frontend', 'Backend'],
            'team' => 'Producto',
            'color' => '#16A085',
        ]);

        $this->createCard($mvp, $users, $teams, [
            'category' => 'Viajes',
            'column' => 'En progreso',
            'title' => 'Invitar participantes al viaje',
            'start' => '2026-10-02',
            'end' => '2026-10-12',
            'priority' => 'alta',
            'progress' => 50,
            'assignees' => ['ana'],
            'labels' => ['Frontend', 'Backend'],
            'color' => '#16A085',
        ]);

        $this->createCard($mvp, $users, $teams, [
            'category' => 'Viajes',
            'column' => 'En progreso',
            'title' => 'Itinerario colaborativo',
            'start' => '2026-10-06',
            'end' => '2026-10-19',
            'priority' => 'alta',
            'progress' => 25,
            'assignees' => ['ana', 'marta'],
            'labels' => ['Frontend', 'Diseño'],
            'color' => '#16A085',
        ]);

        $this->createCard($mvp, $users, $teams, [
            'category' => 'Gastos compartidos',
            'column' => 'En progreso',
            'title' => 'Registrar gastos del viaje',
            'start' => '2026-10-09',
            'end' => '2026-10-20',
            'priority' => 'alta',
            'progress' => 50,
            'assignees' => ['luis'],
            'labels' => ['Backend', 'Frontend'],
            'color' => '#F39C4A',
        ]);

        $this->createCard($mvp, $users, $teams, [
            'category' => 'Gastos compartidos',
            'column' => 'Por hacer',
            'title' => 'Cálculo automático de balances',
            'start' => '2026-10-16',
            'end' => '2026-10-27',
            'priority' => 'alta',
            'progress' => 0,
            'assignees' => ['luis'],
            'labels' => ['Backend'],
            'color' => '#F39C4A',
        ]);

        $this->createCard($mvp, $users, $teams, [
            'category' => 'Gastos compartidos',
            'column' => 'Por hacer',
            'title' => 'Resumen visual de gastos',
            'start' => '2026-10-22',
            'end' => '2026-10-30',
            'priority' => 'media',
            'progress' => 0,
            'assignees' => ['marta', 'ana'],
            'labels' => ['Frontend', 'Diseño'],
            'color' => '#F39C4A',
        ]);

        $this->createCard($mvp, $users, $teams, [
            'category' => 'Notificaciones',
            'column' => 'Por hacer',
            'title' => 'Notificaciones push',
            'start' => '2026-10-20',
            'end' => '2026-10-29',
            'priority' => 'media',
            'progress' => 0,
            'assignees' => ['ana', 'luis'],
            'labels' => ['Frontend', 'Backend'],
            'color' => '#E15D7C',
        ]);

        /*
         * Caso deliberadamente sin Periodo para probar:
         * - Card visible en tabla.
         * - Sin barra en Gantt.
         */
        $this->createCard($mvp, $users, $teams, [
            'category' => 'Notificaciones',
            'column' => 'Backlog',
            'title' => 'Recordatorios inteligentes de viaje',
            'start' => null,
            'end' => null,
            'priority' => 'baja',
            'progress' => 0,
            'assignees' => ['ana'],
            'labels' => ['Producto'],
            'color' => '#E15D7C',
        ]);

        /*
         |--------------------------------------------------------------------------
         | BOARD 3
         |--------------------------------------------------------------------------
         |
         | Beta y estabilización.
         | Especialmente útil para ver solapamientos entre Boards.
         |
         */
        $beta = $this->createBoard(
            $project,
            '03 · Beta y estabilización',
            2,
            [
                'QA funcional',
                'Rendimiento',
                'Analítica',
            ],
        );

        $this->createCard($beta, $users, $teams, [
            'category' => 'QA funcional',
            'column' => 'Por hacer',
            'title' => 'Plan completo de pruebas',
            'start' => '2026-10-26',
            'end' => '2026-10-30',
            'priority' => 'alta',
            'progress' => 0,
            'assignees' => ['marta'],
            'labels' => ['QA'],
            'color' => '#D9A441',
        ]);

        $this->createCard($beta, $users, $teams, [
            'category' => 'QA funcional',
            'column' => 'Por hacer',
            'title' => 'Pruebas de autenticación y permisos',
            'start' => '2026-10-29',
            'end' => '2026-11-04',
            'priority' => 'alta',
            'progress' => 0,
            'assignees' => ['marta', 'luis'],
            'labels' => ['QA', 'Backend'],
            'color' => '#D9A441',
        ]);

        $this->createCard($beta, $users, $teams, [
            'category' => 'QA funcional',
            'column' => 'Por hacer',
            'title' => 'Pruebas E2E de creación de viajes',
            'start' => '2026-11-02',
            'end' => '2026-11-09',
            'priority' => 'alta',
            'progress' => 0,
            'assignees' => ['marta', 'ana'],
            'labels' => ['QA', 'Frontend'],
            'color' => '#D9A441',
        ]);

        $this->createCard($beta, $users, $teams, [
            'category' => 'Rendimiento',
            'column' => 'Por hacer',
            'title' => 'Optimizar carga inicial',
            'start' => '2026-11-03',
            'end' => '2026-11-10',
            'priority' => 'media',
            'progress' => 0,
            'assignees' => ['ana'],
            'labels' => ['Frontend'],
            'color' => '#3FA7A3',
        ]);

        $this->createCard($beta, $users, $teams, [
            'category' => 'Rendimiento',
            'column' => 'Por hacer',
            'title' => 'Optimizar consultas de gastos',
            'start' => '2026-11-05',
            'end' => '2026-11-12',
            'priority' => 'alta',
            'progress' => 0,
            'assignees' => ['luis'],
            'labels' => ['Backend'],
            'color' => '#3FA7A3',
        ]);

        $this->createCard($beta, $users, $teams, [
            'category' => 'Analítica',
            'column' => 'Por hacer',
            'title' => 'Eventos de analítica de producto',
            'start' => '2026-11-09',
            'end' => '2026-11-13',
            'priority' => 'baja',
            'progress' => 0,
            'assignees' => ['ana'],
            'labels' => ['Producto'],
            'color' => '#7A6FF0',
        ]);

        /*
         * Card de un único día para comprobar correctamente
         * la representación de una barra mínima.
         */
        $this->createCard($beta, $users, $teams, [
            'category' => 'Analítica',
            'column' => 'Por hacer',
            'title' => 'Revisión de métricas con producto',
            'start' => '2026-11-16',
            'end' => '2026-11-16',
            'priority' => 'media',
            'progress' => 0,
            'assignees' => ['ana', 'marta'],
            'labels' => ['Producto'],
            'color' => '#7A6FF0',
        ]);

        /*
         |--------------------------------------------------------------------------
         | BOARD 4
         |--------------------------------------------------------------------------
         |
         | Última fase.
         | Fechas suficientemente alejadas para probar zoom Mes/Trimestre.
         |
         */
        $launch = $this->createBoard(
            $project,
            '04 · Lanzamiento',
            3,
            [
                'Infraestructura',
                'Publicación',
                'Soporte',
            ],
        );

        $this->createCard($launch, $users, $teams, [
            'category' => 'Infraestructura',
            'column' => 'Por hacer',
            'title' => 'Preparar infraestructura de producción',
            'start' => '2026-11-16',
            'end' => '2026-11-24',
            'priority' => 'alta',
            'progress' => 0,
            'assignees' => ['luis'],
            'labels' => ['DevOps', 'Backend'],
            'color' => '#4C6FFF',
        ]);

        $this->createCard($launch, $users, $teams, [
            'category' => 'Infraestructura',
            'column' => 'Por hacer',
            'title' => 'Monitorización y alertas',
            'start' => '2026-11-23',
            'end' => '2026-11-30',
            'priority' => 'alta',
            'progress' => 0,
            'assignees' => ['luis'],
            'labels' => ['DevOps'],
            'color' => '#4C6FFF',
        ]);

        $this->createCard($launch, $users, $teams, [
            'category' => 'Publicación',
            'column' => 'Por hacer',
            'title' => 'Preparar ficha de Google Play',
            'start' => '2026-11-20',
            'end' => '2026-11-27',
            'priority' => 'media',
            'progress' => 0,
            'assignees' => ['marta'],
            'labels' => ['Diseño', 'Producto'],
            'color' => '#B06AD8',
        ]);

        $this->createCard($launch, $users, $teams, [
            'category' => 'Publicación',
            'column' => 'Por hacer',
            'title' => 'Preparar ficha de App Store',
            'start' => '2026-11-23',
            'end' => '2026-11-30',
            'priority' => 'media',
            'progress' => 0,
            'assignees' => ['marta'],
            'labels' => ['Diseño', 'Producto'],
            'color' => '#B06AD8',
        ]);

        $this->createCard($launch, $users, $teams, [
            'category' => 'Publicación',
            'column' => 'Por hacer',
            'title' => 'Release candidate',
            'start' => '2026-12-01',
            'end' => '2026-12-03',
            'priority' => 'urgente',
            'progress' => 0,
            'assignees' => ['ana', 'luis'],
            'labels' => ['QA', 'DevOps'],
            'color' => '#D95757',
        ]);

        $this->createCard($launch, $users, $teams, [
            'category' => 'Publicación',
            'column' => 'Por hacer',
            'title' => 'Publicación versión 1.0',
            'start' => '2026-12-04',
            'end' => '2026-12-04',
            'priority' => 'urgente',
            'progress' => 0,
            'assignees' => ['ana'],
            'labels' => ['Producto', 'DevOps'],
            'color' => '#D95757',
        ]);

        $this->createCard($launch, $users, $teams, [
            'category' => 'Soporte',
            'column' => 'Backlog',
            'title' => 'Plan de soporte post-lanzamiento',
            'start' => '2026-12-04',
            'end' => '2026-12-18',
            'priority' => 'media',
            'progress' => 0,
            'assignees' => ['ana', 'marta'],
            'labels' => ['Producto'],
            'color' => '#38A37A',
        ]);

        $this->createCard($launch, $users, $teams, [
            'category' => 'Soporte',
            'column' => 'Backlog',
            'title' => 'Mejoras candidatas para versión 1.1',
            'start' => null,
            'end' => null,
            'priority' => 'baja',
            'progress' => 0,
            'assignees' => ['ana'],
            'labels' => ['Producto'],
            'color' => '#38A37A',
        ]);
    }

    /**
     * Crea un Board completo con:
     *
     * - columnas estándar de Tickard;
     * - colores de estado;
     * - categorías.
     */
    private function createBoard(
        Project $project,
        string $name,
        int $position,
        array $categories,
    ) {
        $board = $project->boards()->create([
            'name' => $name,
            'position' => $position,
        ]);

        $board->createDefaultColumns();

        $columnColors = [
            'Backlog' => '#8B98A5',
            'Por hacer' => '#4C8BF5',
            'En progreso' => '#F39C4A',
            'En revisión' => '#9B6BE8',
            'Completado' => '#38A37A',
        ];

        foreach ($board->columns as $column) {
            $column->update([
                'color' => $columnColors[$column->name] ?? null,
            ]);
        }

        foreach ($categories as $position => $name) {
            $board->categories()->create([
                'name' => $name,
                'position' => $position,
            ]);
        }

        return $board->fresh([
            'columns',
            'categories',
        ]);
    }

    /**
     * Crea una Card realista y genera checklist para disponer
     * de porcentajes 0 / 25 / 50 / 75 / 100.
     */
    private function createCard(
        $board,
        array $users,
        $teams,
        array $data,
    ): Card {
        /** @var Column $column */
        $column = $board->columns
            ->firstWhere('name', $data['column']);

        $category = $board->categories
            ->firstWhere('name', $data['category']);

        $assignees = collect($data['assignees'])
            ->map(fn (string $key) => $users[$key]);

        $creator = $assignees->first();

        $card = $column->cards()->create([
            'board_id' => $board->id,
            'category_id' => $category?->id,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,

            'start_date' => $data['start'],
            'due_date' => $data['end'],

            'started_at' => $column->workflow_state === 'backlog'
                ? null
                : ($data['start']
                    ? $data['start'].' 09:00:00'
                    : now()),

            'priority' => $data['priority'] ?? 'media',
            'color' => $data['color'] ?? null,
            'is_internal' => $data['internal'] ?? false,
            'position' => $column->cards()->count(),
            'created_by' => $creator->id,
        ]);

        $card->assignees()->sync(
            $assignees->pluck('id'),
        );

        $labels = $board->project->labels()
            ->whereIn('name', $data['labels'] ?? [])
            ->pluck('id');

        $card->labels()->sync($labels);

        if (! empty($data['team']) && isset($teams[$data['team']])) {
            $card->teams()->sync([
                $teams[$data['team']]->id,
            ]);
        }

        $this->createProgressChecklist(
            $card,
            (int) ($data['progress'] ?? 0),
            $creator,
        );

        $card->activities()->create([
            'user_id' => $creator->id,
            'type' => 'created',
            'meta' => [
                'title' => $card->title,
            ],
        ]);

        return $card;
    }

    /**
     * CardPresenter calcula actualmente el progreso a partir
     * de los elementos de checklist.
     *
     * Creamos cuatro para obtener porcentajes previsibles:
     *
     * 0 / 25 / 50 / 75 / 100
     */
    private function createProgressChecklist(
        Card $card,
        int $progress,
        User $assignee,
    ): void {
        $progress = max(0, min(100, $progress));

        $doneItems = match (true) {
            $progress >= 100 => 4,
            $progress >= 75 => 3,
            $progress >= 50 => 2,
            $progress >= 25 => 1,
            default => 0,
        };

        $items = [
            'Análisis',
            'Implementación',
            'Pruebas',
            'Revisión',
        ];

        foreach ($items as $position => $body) {
            $item = $card->checklistItems()->create([
                'body' => $body,
                'is_done' => $position < $doneItems,
                'due_date' => $card->due_date,
                'position' => $position,
            ]);

            $item->assignees()->sync([
                $assignee->id,
            ]);
        }
    }
}
