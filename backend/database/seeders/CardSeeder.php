<?php

namespace Database\Seeders;

use App\Models\Card;
use App\Models\Column;
use App\Models\Label;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Seeder;

class CardSeeder extends Seeder
{
    public function run(): void
    {
        $ana = User::where('email', 'ana@gestor.test')->firstOrFail();
        $luis = User::where('email', 'luis@gestor.test')->firstOrFail();
        $marta = User::where('email', 'marta@gestor.test')->firstOrFail();
        $board = $ana->workspaces()->where('name', 'Tickard Demo')->firstOrFail()->projects()->where('name', 'Portal de clientes')->firstOrFail()->boards()->where('name', 'Entrega marzo')->firstOrFail();
        $columns = $board->columns()->get()->keyBy('name');
        $labels = Label::where('project_id', $board->project_id)->get()->keyBy('name');
        $this->card($columns->firstWhere('is_backlog', true), 'Revisar textos legales', 'media', false, '2026-10-18', [$marta], [$labels['Diseño']]);
        $this->card($columns['Por hacer'], 'Formulario de alta de usuarios', 'alta', true, '2026-10-02', [$ana], [$labels['Frontend']]);
        $this->card($columns['En progreso'], 'Tablero de pedidos del portal', 'alta', false, '2026-10-04', [$ana, $luis], [$labels['Frontend']], 'Lista de pedidos del portal con estado, importe y acceso al detalle.');
        $this->card($columns['En progreso'], 'Maquetar el correo de invitación', 'media', true, '2026-10-03', [$marta], [$labels['Diseño']]);
        $this->card($columns['En revisión'], 'Corregir el filtro de facturas', 'media', false, '2026-10-01', [$luis], [$labels['Backend']]);
        $this->card($columns['Completado'], 'Definir permisos del cliente', 'baja', true, '2026-09-28', [$ana], []);
        $design = Team::where('workspace_id', $board->project->workspace_id)->where('name', 'Diseño')->firstOrFail();
        Card::where('title', 'Maquetar el correo de invitación')->firstOrFail()->teams()->sync([$design->id]);
    }

    private function card(Column $column, string $title, string $priority, bool $internal, string $due, array $people, array $labels, ?string $description = null): void
    {
        $card = $column->cards()->create(['board_id' => $column->board_id, 'title' => $title, 'description' => $description, 'priority' => $priority, 'is_internal' => $internal, 'start_date' => $due, 'due_date' => $due, 'started_at' => $column->is_backlog ? null : now(), 'position' => $column->cards()->count(), 'created_by' => $people[0]->id]);
        $card->assignees()->sync(collect($people)->pluck('id'));
        $card->labels()->sync(collect($labels)->pluck('id'));
        $card->activities()->create(['user_id' => $card->created_by, 'type' => 'created', 'meta' => ['title' => $title]]);
    }
}
