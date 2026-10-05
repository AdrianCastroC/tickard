<?php

namespace Database\Seeders;

use App\Models\Board;
use App\Models\Card;
use App\Models\ClientCompany;
use App\Models\Department;
use App\Models\Project;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            $ana = User::create([
                'name' => 'Ana Ruiz',
                'email' => 'ana@gestor.test',
                'password' => 'password',
                'is_admin' => true,
                'plan' => User::PLAN_PRO,
            ]);

            $luis = User::create([
                'name' => 'Luis Pérez',
                'email' => 'luis@gestor.test',
                'password' => 'password',
                'plan' => User::PLAN_BASE,
            ]);

            $marta = User::create([
                'name' => 'Marta Gil',
                'email' => 'marta@gestor.test',
                'password' => 'password',
                'plan' => User::PLAN_FREE,
            ]);

            $elena = User::create([
                'name' => 'Elena Soto',
                'email' => 'elena@gestor.test',
                'password' => 'password',
                'plan' => User::PLAN_FREE,
            ]);

            $anaWorkspace = Workspace::createInitialFor($ana);
            $luisWorkspace = Workspace::createInitialFor($luis);
            $martaWorkspace = Workspace::createInitialFor($marta);
            $elenaWorkspace = Workspace::createInitialFor($elena);

            $anaWorkspace->update([
                'name' => 'Tickard Demo',
            ]);

            foreach ([$luis, $marta, $elena] as $member) {
                $anaWorkspace->memberships()->create([
                    'user_id' => $member->id,
                    'role' => 'member',
                ]);
            }

            $client = ClientCompany::create([
                'workspace_id' => $anaWorkspace->id,
                'name' => 'Norte Digital',
            ]);

            $elena->update([
                'client_company_id' => $client->id,
            ]);

            $project = Project::create([
                'workspace_id' => $anaWorkspace->id,
                'name' => 'Portal de clientes',
                'client_company_id' => $client->id,
            ]);

            foreach ([
                [$ana, 'responsable'],
                [$luis, 'editor'],
                [$marta, 'lector'],
                [$elena, 'cliente'],
            ] as [$user, $role]) {
                $project->members()->create([
                    'user_id' => $user->id,
                    'role' => $role,
                ]);
            }

            $frontend = $project->labels()->create([
                'name' => 'Frontend',
                'tone' => 'bosque',
            ]);

            $backend = $project->labels()->create([
                'name' => 'Backend',
                'tone' => 'bambu',
            ]);

            $diseno = $project->labels()->create([
                'name' => 'Diseño',
                'tone' => 'ciruela',
            ]);

            $board = $project->boards()->create([
                'name' => 'Entrega marzo',
                'position' => 0,
            ]);

            $columns = [];

            foreach (Board::defaultColumnNames() as $position => $name) {
                $columns[$name] = $board->columns()->create([
                    'name' => $name,
                    'position' => $position,
                ]);
            }

            $this->card(
                $columns['Backlog'],
                'Revisar textos legales',
                'media',
                false,
                '2026-10-18',
                [$marta],
                [$diseno]
            );

            $this->card(
                $columns['Por hacer'],
                'Formulario de alta de usuarios',
                'alta',
                true,
                '2026-10-02',
                [$ana],
                [$frontend]
            );

            $this->card(
                $columns['En progreso'],
                'Tablero de pedidos del portal',
                'alta',
                false,
                '2026-10-04',
                [$ana, $luis],
                [$frontend],
                'Lista de pedidos del portal con estado, importe y acceso al detalle.'
            );

            $this->card(
                $columns['En progreso'],
                'Maquetar el correo de invitación',
                'media',
                true,
                '2026-10-03',
                [$marta],
                [$diseno]
            );

            $this->card(
                $columns['En revisión'],
                'Corregir el filtro de facturas',
                'media',
                false,
                '2026-10-01',
                [$luis],
                [$backend]
            );

            $this->card(
                $columns['Completado'],
                'Definir permisos del cliente',
                'baja',
                true,
                '2026-09-28',
                [$ana],
                []
            );

            $desarrollo = Department::create([
                'workspace_id' => $anaWorkspace->id,
                'name' => 'Desarrollo',
            ]);

            $desarrollo->members()->sync([
                $ana->id,
                $luis->id,
            ]);

            $producto = Team::create([
                'workspace_id' => $anaWorkspace->id,
                'name' => 'Producto',
            ]);

            $producto->members()->sync([
                $ana->id,
                $luis->id,
            ]);

            $disenoTeam = Team::create([
                'workspace_id' => $anaWorkspace->id,
                'name' => 'Diseño',
            ]);

            $disenoTeam->members()->sync([
                $marta->id,
            ]);

            Card::where('title', 'Maquetar el correo de invitación')
                ->first()
                ?->teams()
                ->sync([$disenoTeam->id]);
        });
    }

    private function card($column, string $title, string $priority, bool $internal, string $due, array $people, array $labels, ?string $description = null): void
    {
        $card = $column->cards()->create([
            'board_id' => $column->board_id,
            'title' => $title,
            'description' => $description,
            'priority' => $priority,
            'is_internal' => $internal,
            'due_date' => $due,
            'position' => $column->cards()->count(),
            'created_by' => ($people[0] ?? User::query()->orderBy('id')->first())->id,
        ]);
        $card->assignees()->sync(collect($people)->pluck('id'));
        $card->labels()->sync(collect($labels)->pluck('id'));
        $card->activities()->create([
            'user_id' => $card->created_by,
            'type' => 'created',
            'meta' => ['title' => $title],
        ]);
    }
}
