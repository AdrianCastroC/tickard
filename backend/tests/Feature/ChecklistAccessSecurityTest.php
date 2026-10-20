<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\CardChecklistItem;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChecklistAccessSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_empty_checklist_patch_cannot_disclose_another_projects_item(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $outsider = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Proyecto privado']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Tablero']);
        $board->createDefaultColumns();
        $column = $board->columns()->firstOrFail();
        $card = Card::create(['board_id' => $board->id, 'column_id' => $column->id, 'title' => 'Secreto']);
        $item = CardChecklistItem::create(['card_id' => $card->id, 'body' => 'Información interna']);

        $url = "/api/checklist/{$item->id}";

        $this->actingAs($outsider)->patchJson($url, [])->assertForbidden();
        $this->patchJson($url, ['body' => 'Alteración'])->assertForbidden();
        $this->assertDatabaseHas('card_checklist_items', ['id' => $item->id, 'body' => 'Información interna']);

        $this->actingAs($owner)->patchJson($url, [])->assertUnprocessable();
        $this->patchJson($url, ['body' => 'Actualizado'])->assertOk()
            ->assertJsonPath('body', 'Actualizado');
    }

    public function test_reader_cannot_edit_checklist_but_can_read_project(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $reader = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $workspace->memberships()->create(['user_id' => $reader->id, 'role' => 'member']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Proyecto']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $reader->id, 'role' => 'lector']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Tablero']);
        $board->createDefaultColumns();
        $card = Card::create([
            'board_id' => $board->id,
            'column_id' => $board->columns()->firstOrFail()->id,
            'title' => 'Card',
        ]);
        $item = CardChecklistItem::create(['card_id' => $card->id, 'body' => 'Pendiente']);

        $this->actingAs($reader)->patchJson("/api/checklist/{$item->id}", [
            'body' => 'No autorizado',
        ])->assertForbidden();
        $this->assertDatabaseHas('card_checklist_items', ['id' => $item->id, 'body' => 'Pendiente']);
    }
}
