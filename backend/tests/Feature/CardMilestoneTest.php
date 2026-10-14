<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\CardChecklistItem;
use App\Models\CardModule;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CardMilestoneTest extends TestCase
{
    use RefreshDatabase;

    private function setupBoard(): array
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Test', 'owner_id' => $user->id]);
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Client']);
        $project = Project::create(['workspace_id' => $workspace->id, 'client_company_id' => $client->id, 'name' => 'Project']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $user->id, 'role' => 'editor']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Board']);
        $board->createDefaultColumns();

        return [$user, $board, $board->columns->keyBy('workflow_state')];
    }

    public function test_creation_places_milestone_in_progress(): void
    {
        [$user, $board, $columns] = $this->setupBoard();
        $response = $this->actingAs($user)->postJson("/api/boards/{$board->id}/cards", [
            'column_id' => $columns['backlog']->id, 'title' => 'Release', 'is_milestone' => true,
            'due_date' => '2026-12-15',
        ])->assertCreated();

        $card = Card::findOrFail($response->json('id'));
        $this->assertTrue($card->is_milestone);
        $this->assertTrue($card->milestone_auto_complete);
        $this->assertSame($columns['in_progress']->id, $card->column_id);
        $this->assertSame('2026-12-15', $card->start_date->toDateString());
        $this->assertSame('2026-12-15', $card->due_date->toDateString());
        $this->assertNotNull($card->started_at);
        $this->actingAs($user)->getJson("/api/boards/{$board->id}?gantt=1")->assertOk()
            ->assertJsonPath('columns.2.cards.0.is_milestone', true);
    }

    public function test_conversion_and_validation(): void
    {
        [$user, $board, $columns] = $this->setupBoard();
        $card = Card::create(['board_id' => $board->id, 'column_id' => $columns['backlog']->id, 'title' => 'Test']);
        $this->actingAs($user)->patchJson("/api/cards/{$card->id}", ['is_milestone' => true])
            ->assertUnprocessable()->assertJsonValidationErrors('due_date');
        $this->actingAs($user)->patchJson("/api/cards/{$card->id}", [
            'is_milestone' => true, 'milestone_auto_complete' => false, 'due_date' => '2026-11-10',
        ])->assertNoContent();
        $this->assertTrue($card->fresh()->is_milestone);
        $this->assertFalse($card->fresh()->milestone_auto_complete);
        $this->assertSame($columns['in_progress']->id, $card->fresh()->column_id);
        $this->actingAs($user)->postJson("/api/cards/{$card->id}/move", [
            'column_id' => $columns['backlog']->id, 'position' => 0,
        ])->assertUnprocessable();
        $this->actingAs($user)->patchJson("/api/cards/{$card->id}", ['is_milestone' => false])->assertNoContent();
        $this->assertFalse($card->fresh()->is_milestone);
    }

    public function test_milestone_without_requirements_stays_in_progress(): void
    {
        [$user, $board, $columns] = $this->setupBoard();
        $response = $this->actingAs($user)->postJson("/api/boards/{$board->id}/cards", [
            'column_id' => $columns['pending']->id,
            'title' => 'Hito sin requisitos',
            'is_milestone' => true,
            'due_date' => '2027-01-15',
        ])->assertCreated();
        $milestone = Card::findOrFail($response->json('id'));

        $this->actingAs($user)->patchJson("/api/cards/{$milestone->id}", [
            'milestone_auto_complete' => true,
        ])->assertNoContent();

        $this->assertSame('in_progress', $milestone->fresh()->column->workflow_state);
        $this->assertNull($milestone->fresh()->completed_at);
    }

    public function test_all_checklists_are_required_for_auto_completion(): void
    {
        [$user, $board, $columns] = $this->setupBoard();
        $milestone = Card::create([
            'board_id' => $board->id,
            'column_id' => $columns['in_progress']->id,
            'title' => 'Beta',
            'is_milestone' => true,
            'milestone_auto_complete' => true,
            'start_date' => '2027-01-15',
            'due_date' => '2027-01-15',
        ]);
        $firstModule = CardModule::create([
            'card_id' => $milestone->id, 'type' => 'checklist', 'title' => 'QA', 'position' => 0,
        ]);
        $secondModule = CardModule::create([
            'card_id' => $milestone->id, 'type' => 'checklist', 'title' => 'Entrega', 'position' => 1,
        ]);
        $first = CardChecklistItem::create([
            'card_id' => $milestone->id, 'card_module_id' => $firstModule->id,
            'body' => 'Pruebas', 'position' => 0,
        ]);
        $second = CardChecklistItem::create([
            'card_id' => $milestone->id, 'card_module_id' => $secondModule->id,
            'body' => 'Documentación', 'position' => 0,
        ]);

        $this->actingAs($user)->patchJson("/api/checklist/{$first->id}", ['is_done' => true])
            ->assertOk();
        $this->assertSame($columns['in_progress']->id, $milestone->fresh()->column_id);

        $this->actingAs($user)->patchJson("/api/checklist/{$second->id}", ['is_done' => true])
            ->assertOk();
        $this->assertSame($columns['done']->id, $milestone->fresh()->column_id);
        $this->assertNotNull($milestone->fresh()->completed_at);
        $this->assertSame('2027-01-15', $milestone->fresh()->due_date->toDateString());
        $this->assertDatabaseHas('activities', [
            'card_id' => $milestone->id, 'type' => 'moved',
        ]);

        // Un requisito reabierto no deshace automáticamente una entrega ya alcanzada.
        $this->actingAs($user)->patchJson("/api/checklist/{$second->id}", ['is_done' => false])
            ->assertOk();
        $this->assertSame($columns['done']->id, $milestone->fresh()->column_id);
    }

    public function test_cross_board_dependencies_and_checklists_must_both_be_done(): void
    {
        [$user, $board, $columns] = $this->setupBoard();
        $secondBoard = Board::create(['project_id' => $board->project_id, 'name' => 'Backend']);
        $secondBoard->createDefaultColumns();
        $otherColumns = $secondBoard->columns->keyBy('workflow_state');

        $predecessor = Card::create([
            'board_id' => $secondBoard->id,
            'column_id' => $otherColumns['in_progress']->id,
            'title' => 'API completada',
            'start_date' => '2026-11-10',
            'due_date' => '2026-11-30',
        ]);
        $milestone = Card::create([
            'board_id' => $board->id,
            'column_id' => $columns['in_progress']->id,
            'title' => 'Lanzamiento',
            'is_milestone' => true,
            'milestone_auto_complete' => true,
            'start_date' => '2026-12-15',
            'due_date' => '2026-12-15',
        ]);
        $module = CardModule::create([
            'card_id' => $milestone->id, 'type' => 'checklist', 'title' => 'Publicación', 'position' => 0,
        ]);
        $item = CardChecklistItem::create([
            'card_id' => $milestone->id, 'card_module_id' => $module->id,
            'body' => 'Aprobación', 'position' => 0,
        ]);

        $this->actingAs($user)->postJson("/api/cards/{$predecessor->id}/dependencies", [
            'successor_card_id' => $milestone->id, 'type' => 'fs',
        ])->assertCreated();

        $this->actingAs($user)->postJson("/api/cards/{$predecessor->id}/move", [
            'column_id' => $otherColumns['done']->id, 'position' => 0,
        ])->assertNoContent();
        $this->assertSame($columns['in_progress']->id, $milestone->fresh()->column_id);

        $this->actingAs($user)->patchJson("/api/checklist/{$item->id}", ['is_done' => true])
            ->assertOk();
        $this->assertSame($columns['done']->id, $milestone->fresh()->column_id);
        $this->assertSame('2026-12-15', $milestone->fresh()->due_date->toDateString());

        // Reabrir una dependencia no deshace automáticamente el hito.
        $this->actingAs($user)->postJson("/api/cards/{$predecessor->id}/move", [
            'column_id' => $otherColumns['in_progress']->id, 'position' => 0,
        ])->assertNoContent();
        $this->assertSame($columns['done']->id, $milestone->fresh()->column_id);
    }

    public function test_manual_mode_waits_for_approval_and_enabling_auto_rechecks(): void
    {
        [$user, $board, $columns] = $this->setupBoard();
        $milestone = Card::create([
            'board_id' => $board->id,
            'column_id' => $columns['in_progress']->id,
            'title' => 'Entrega manual',
            'is_milestone' => true,
            'milestone_auto_complete' => false,
            'start_date' => '2026-12-20',
            'due_date' => '2026-12-20',
        ]);
        $module = CardModule::create([
            'card_id' => $milestone->id, 'type' => 'checklist', 'title' => 'Aprobación', 'position' => 0,
        ]);
        $item = CardChecklistItem::create([
            'card_id' => $milestone->id, 'card_module_id' => $module->id, 'body' => 'Aprobar', 'position' => 0,
        ]);

        $this->actingAs($user)->patchJson("/api/checklist/{$item->id}", ['is_done' => true])
            ->assertOk();
        $this->assertSame($columns['in_progress']->id, $milestone->fresh()->column_id);

        $this->actingAs($user)->patchJson("/api/cards/{$milestone->id}", [
            'milestone_auto_complete' => true,
        ])->assertNoContent();
        $this->assertSame($columns['done']->id, $milestone->fresh()->column_id);
    }

    public function test_completing_a_milestone_can_complete_another_milestone(): void
    {
        [$user, $board, $columns] = $this->setupBoard();
        $first = Card::create([
            'board_id' => $board->id, 'column_id' => $columns['in_progress']->id,
            'title' => 'Beta', 'is_milestone' => true,
            'start_date' => '2026-12-01', 'due_date' => '2026-12-01',
        ]);
        $second = Card::create([
            'board_id' => $board->id, 'column_id' => $columns['in_progress']->id,
            'title' => 'Release', 'is_milestone' => true,
            'start_date' => '2026-12-05', 'due_date' => '2026-12-05',
        ]);
        $module = CardModule::create([
            'card_id' => $first->id, 'type' => 'checklist', 'title' => 'Beta', 'position' => 0,
        ]);
        $item = CardChecklistItem::create([
            'card_id' => $first->id, 'card_module_id' => $module->id,
            'body' => 'Beta validada', 'position' => 0,
        ]);
        $this->actingAs($user)->postJson("/api/cards/{$first->id}/dependencies", [
            'successor_card_id' => $second->id, 'type' => 'fs',
        ])->assertCreated();

        $this->actingAs($user)->patchJson("/api/checklist/{$item->id}", ['is_done' => true])
            ->assertOk();

        $this->assertSame($columns['done']->id, $first->fresh()->column_id);
        $this->assertSame($columns['done']->id, $second->fresh()->column_id);
    }

    public function test_review_is_not_done_and_deleting_a_blocker_rechecks_the_milestone(): void
    {
        [$user, $board, $columns] = $this->setupBoard();
        $ready = Card::create([
            'board_id' => $board->id, 'column_id' => $columns['in_progress']->id,
            'title' => 'Frontend', 'start_date' => '2026-11-01', 'due_date' => '2026-11-10',
        ]);
        $review = Card::create([
            'board_id' => $board->id, 'column_id' => $columns['in_progress']->id,
            'title' => 'QA', 'start_date' => '2026-11-01', 'due_date' => '2026-11-15',
        ]);
        $milestone = Card::create([
            'board_id' => $board->id, 'column_id' => $columns['in_progress']->id,
            'title' => 'Beta', 'is_milestone' => true,
            'start_date' => '2026-12-01', 'due_date' => '2026-12-01',
        ]);
        $this->actingAs($user)->postJson("/api/cards/{$ready->id}/dependencies", [
            'successor_card_id' => $milestone->id, 'type' => 'fs',
        ])->assertCreated();
        $blocked = $this->actingAs($user)->postJson("/api/cards/{$review->id}/dependencies", [
            'successor_card_id' => $milestone->id, 'type' => 'fs',
        ])->assertCreated()->json();

        $this->actingAs($user)->postJson("/api/cards/{$ready->id}/move", [
            'column_id' => $columns['done']->id, 'position' => 0,
        ])->assertNoContent();
        $this->actingAs($user)->postJson("/api/cards/{$review->id}/move", [
            'column_id' => $columns['review']->id, 'position' => 0,
        ])->assertNoContent();

        $this->assertNotNull($review->fresh()->completed_at);
        $this->assertSame($columns['in_progress']->id, $milestone->fresh()->column_id);

        $this->actingAs($user)->deleteJson("/api/card-dependencies/{$blocked['id']}")
            ->assertNoContent();
        $this->assertSame($columns['done']->id, $milestone->fresh()->column_id);
    }
}
