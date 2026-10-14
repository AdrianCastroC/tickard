<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
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
}
