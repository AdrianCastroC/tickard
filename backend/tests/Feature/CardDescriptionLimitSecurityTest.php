<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\User;
use App\Models\Workspace;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CardDescriptionLimitSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_card_creation_and_update_reject_oversized_description(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Límites']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Board']);
        $board->createDefaultColumns();
        $column = $board->columns()->firstOrFail();
        $this->actingAs($owner)->postJson("/api/boards/{$board->id}/cards", [
            'title' => 'Demasiado grande', 'column_id' => $column->id,
            'description' => str_repeat('a', 12001),
        ])->assertUnprocessable()->assertJsonValidationErrors('description');

        $created = $this->postJson("/api/boards/{$board->id}/cards", [
            'title' => 'Permitida', 'column_id' => $column->id,
            'description' => str_repeat('a', 12000),
        ])->assertCreated();
        $card = Card::findOrFail($created->json('id'));

        $this->patchJson("/api/cards/{$card->id}", [
            'description' => str_repeat('b', 12001),
        ])->assertUnprocessable()->assertJsonValidationErrors('description');
        $this->assertSame(str_repeat('a', 12000), $card->fresh()->description);
    }
}
