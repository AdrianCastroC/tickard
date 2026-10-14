<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\CardChecklistItem;
use App\Models\CardDependency;
use App\Models\CardModule;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MilestoneDependencyChecklistTest extends TestCase
{
    use RefreshDatabase;

    private function setupProject(): array
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Demo', 'owner_id' => $user->id]);
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Cliente']);
        $project = Project::create(['workspace_id' => $workspace->id, 'client_company_id' => $client->id, 'name' => 'Proyecto']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $user->id, 'role' => 'editor']);

        $board = Board::create(['project_id' => $project->id, 'name' => 'Frontend']);
        $board->createDefaultColumns();
        $otherBoard = Board::create(['project_id' => $project->id, 'name' => 'Backend']);
        $otherBoard->createDefaultColumns();

        return [$user, $board, $board->columns->keyBy('workflow_state'), $otherBoard,
            $otherBoard->columns->keyBy('workflow_state')];
    }

    private function milestoneFromBoard(array $payload, int $cardId): array
    {
        foreach ($payload['columns'] as $column) {
            foreach ($column['cards'] as $card) {
                if ($card['id'] === $cardId) {
                    return $card;
                }
            }
        }

        $this->fail('El hito no aparece en la respuesta del tablero.');
    }

    public function test_dependency_checklist_reflects_review_done_and_cross_board_progress(): void
    {
        [$user, $board, $columns, $otherBoard, $otherColumns] = $this->setupProject();
        $doneCard = Card::create([
            'board_id' => $board->id,
            'column_id' => $columns['done']->id,
            'created_by' => $user->id,
            'title' => 'Diseño final',
            'start_date' => '2027-01-01',
            'due_date' => '2027-01-08',
        ]);
        $reviewCard = Card::create([
            'board_id' => $otherBoard->id,
            'column_id' => $otherColumns['review']->id,
            'created_by' => $user->id,
            'title' => 'API pendiente de aprobar',
            'start_date' => '2027-01-01',
            'due_date' => '2027-01-10',
            'completed_at' => now(),
        ]);
        $milestone = Card::create([
            'board_id' => $board->id,
            'column_id' => $columns['in_progress']->id,
            'created_by' => $user->id,
            'title' => 'Beta',
            'is_milestone' => true,
            'milestone_auto_complete' => false,
            'start_date' => '2027-01-15',
            'due_date' => '2027-01-15',
        ]);
        CardDependency::create([
            'predecessor_card_id' => $doneCard->id,
            'successor_card_id' => $milestone->id,
            'type' => 'fs',
        ]);
        CardDependency::create([
            'predecessor_card_id' => $reviewCard->id,
            'successor_card_id' => $milestone->id,
            'type' => 'ff',
        ]);
        $module = CardModule::create([
            'card_id' => $milestone->id, 'type' => 'checklist',
            'title' => 'Control', 'position' => 0,
        ]);
        CardChecklistItem::create([
            'card_id' => $milestone->id, 'card_module_id' => $module->id,
            'body' => 'Confirmar entrega', 'position' => 0, 'is_done' => true,
        ]);

        $response = $this->actingAs($user)->getJson("/api/boards/{$board->id}")->assertOk();
        $data = $this->milestoneFromBoard($response->json(), $milestone->id);
        $this->assertSame(['done', 'review'], array_column($data['dependencies']['predecessors'], 'workflow_state'));
        $this->assertSame([true, false], array_column($data['dependencies']['predecessors'], 'is_done'));
        $this->assertSame('Backend', $data['dependencies']['predecessors'][1]['board_name']);
        $this->assertSame(['done' => 2, 'total' => 3, 'percent' => 67], $data['progress']);
        $this->assertFalse($data['milestone_requirements']['ready']);

        $this->actingAs($user)->postJson("/api/cards/{$reviewCard->id}/move", [
            'column_id' => $otherColumns['done']->id,
            'position' => 0,
        ])->assertNoContent();

        $response = $this->actingAs($user)->getJson("/api/boards/{$board->id}")->assertOk();
        $updated = $this->milestoneFromBoard($response->json(), $milestone->id);
        $this->assertSame([true, true], array_column($updated['dependencies']['predecessors'], 'is_done'));
        $this->assertSame(['done' => 3, 'total' => 3, 'percent' => 100], $updated['progress']);
        $this->assertTrue($updated['milestone_requirements']['ready']);
        $this->assertSame($columns['in_progress']->id, $milestone->fresh()->column_id);
        $this->assertDatabaseCount('card_checklist_items', 1);
    }

    public function test_removing_dependency_changes_derived_progress_without_deleting_manual_items(): void
    {
        [$user, $board, $columns] = $this->setupProject();
        $predecessor = Card::create([
            'board_id' => $board->id, 'column_id' => $columns['pending']->id,
            'created_by' => $user->id, 'title' => 'Entrega pendiente',
        ]);
        $milestone = Card::create([
            'board_id' => $board->id, 'column_id' => $columns['in_progress']->id,
            'created_by' => $user->id, 'title' => 'Hito',
            'is_milestone' => true, 'milestone_auto_complete' => false,
            'start_date' => '2027-03-20', 'due_date' => '2027-03-20',
        ]);
        $dependency = CardDependency::create([
            'predecessor_card_id' => $predecessor->id,
            'successor_card_id' => $milestone->id, 'type' => 'fs',
        ]);
        $first = $this->actingAs($user)->getJson("/api/boards/{$board->id}")->assertOk();
        $this->assertSame(['done' => 0, 'total' => 1, 'percent' => 0],
            $this->milestoneFromBoard($first->json(), $milestone->id)['progress']);

        $this->actingAs($user)->deleteJson("/api/card-dependencies/{$dependency->id}")->assertNoContent();
        $next = $this->actingAs($user)->getJson("/api/boards/{$board->id}")->assertOk();
        $card = $this->milestoneFromBoard($next->json(), $milestone->id);
        $this->assertSame([], $card['dependencies']['predecessors']);
        $this->assertSame(['done' => 0, 'total' => 0, 'percent' => 0], $card['progress']);
        $this->assertSame($columns['in_progress']->id, $milestone->fresh()->column_id);
    }
}
