<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\CardChecklistItem;
use App\Models\CardDependency;
use App\Models\CardModule;
use App\Models\ClientCompany;
use App\Models\Column;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Support\CardDependencyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CardBacklogTest extends TestCase
{
    use RefreshDatabase;

    public function test_move_with_dependencies_returns_preview_without_changes(): void
    {
        [$user, $card, $other, $backlog] = $this->createGraph();
        app(CardDependencyService::class)->create($card, $other);
        $revision = $card->board->fresh()->revision;

        $this->actingAs($user)
            ->postJson("/api/cards/{$card->id}/move", ['column_id' => $backlog->id, 'position' => 2])
            ->assertStatus(409)
            ->assertJsonPath('code', 'backlog_dependencies')
            ->assertJsonPath('resolution.root_card_id', $card->id)
            ->assertJsonPath('resolution.summary.cards', 2);

        $this->assertSame('pending', $card->fresh()->column->workflow_state);
        $this->assertDatabaseCount('card_dependencies', 1);
        $this->assertSame($revision, $card->board->fresh()->revision);
    }

    public function test_confirmed_move_removes_dependencies_and_clears_only_card_planning(): void
    {
        [$user, $card, $other, $backlog] = $this->createGraph();
        $dependency = app(CardDependencyService::class)->create($card, $other);

        $this->actingAs($user)
            ->postJson("/api/cards/{$card->id}/move", [
                'column_id' => $backlog->id,
                'position' => 2,
                'backlog_resolution' => ['selected_card_ids' => [$card->id, $other->id]],
            ])
            ->assertNoContent();

        $this->assertSame('backlog', $card->fresh()->column->workflow_state);
        $this->assertNull($card->fresh()->start_date);
        $this->assertNull($card->fresh()->due_date);
        $this->assertNull($other->fresh()->start_date);
        $this->assertDatabaseMissing('card_dependencies', ['id' => $dependency->id]);
    }

    public function test_card_without_dependencies_can_move_directly_to_backlog(): void
    {
        [$user, $card, , $backlog] = $this->createGraph();

        $this->actingAs($user)
            ->postJson("/api/cards/{$card->id}/move", ['column_id' => $backlog->id, 'position' => 2])
            ->assertNoContent();

        $this->assertSame('backlog', $card->fresh()->column->workflow_state);
    }

    public function test_backlog_resolution_requires_a_non_empty_selected_card_ids_array(): void
    {
        [$user, $card, , $backlog] = $this->createGraph();
        $url = "/api/cards/{$card->id}/move";
        $base = ['column_id' => $backlog->id, 'position' => 0];

        foreach ([
            ['backlog_resolution' => []],
            ['backlog_resolution' => ['selected_card_ids' => 'hola']],
            ['backlog_resolution' => ['selected_card_ids' => [$card->id, $card->id]]],
            ['backlog_resolution' => ['selected_card_ids' => [$card->id], 'destinations' => 'invalid']],
            ['backlog_resolution' => ['selected_card_ids' => [$card->id], 'destinations' => [['board_id' => $card->board_id]]]],
        ] as $invalid) {
            $this->actingAs($user)->postJson($url, array_merge($base, $invalid))->assertStatus(422);
        }

        $this->assertSame('pending', $card->fresh()->column->workflow_state);
        $this->assertDatabaseCount('card_dependencies', 0);
    }

    public function test_confirmed_move_preserves_execution_history_checklist_history_and_positions(): void
    {
        [$user, $card, $other, $backlog] = $this->createGraph();
        $board = $card->board;
        foreach (['X', 'Y', 'Z'] as $index => $title) {
            Card::create([
                'board_id' => $board->id,
                'column_id' => $backlog->id,
                'title' => $title,
                'position' => $index,
            ]);
        }
        $startedAt = '2026-10-01 09:00:00';
        $completedAt = '2026-10-02 17:00:00';
        $card->update([
            'started_at' => $startedAt,
            'completed_at' => $completedAt,
        ]);
        $module = CardModule::create(['card_id' => $card->id, 'type' => CardModule::TYPE_CHECKLIST, 'title' => 'Checklist']);
        $item = CardChecklistItem::create([
            'card_id' => $card->id,
            'card_module_id' => $module->id,
            'body' => 'Histórico',
            'is_done' => true,
            'due_date' => '2026-10-05',
            'completed_at' => '2026-10-04 12:00:00',
            'position' => 0,
        ]);
        app(CardDependencyService::class)->create($card, $other);

        $this->actingAs($user)->postJson("/api/cards/{$card->id}/move", [
            'column_id' => $backlog->id,
            'position' => 1,
            'backlog_resolution' => ['selected_card_ids' => [$card->id]],
        ])->assertNoContent();

        $card->refresh();
        $item->refresh();
        $backlogCards = $backlog->cards()->whereNull('archived_at')->orderBy('position')->get();
        $this->assertSame(['X', 'A', 'Y', 'Z'], $backlogCards->pluck('title')->all());
        $this->assertNull($card->start_date);
        $this->assertNull($card->due_date);
        $this->assertNull($card->completed_at);
        $this->assertSame($startedAt, $card->started_at->format('Y-m-d H:i:s'));
        $this->assertSame('2026-10-05', $item->due_date->toDateString());
        $this->assertSame('2026-10-04 12:00:00', $item->completed_at->format('Y-m-d H:i:s'));
    }

    /** @return array{0: User, 1: Card, 2: Card, 3: Column} */
    private function createGraph(): array
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Backlog', 'owner_id' => $user->id]);
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Backlog']);
        $project = Project::create(['workspace_id' => $workspace->id, 'client_company_id' => $client->id, 'name' => 'Backlog']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $user->id, 'role' => 'editor']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Board']);
        $backlog = $board->columns()->create(['name' => 'Backlog', 'workflow_state' => 'backlog', 'position' => 0]);
        $pending = $board->columns()->create(['name' => 'Pendiente', 'workflow_state' => 'pending', 'position' => 1]);

        return [
            $user,
            Card::create(['board_id' => $board->id, 'column_id' => $pending->id, 'title' => 'A', 'start_date' => '2026-10-01', 'due_date' => '2026-10-10']),
            Card::create(['board_id' => $board->id, 'column_id' => $pending->id, 'title' => 'B', 'start_date' => '2026-10-10', 'due_date' => '2026-10-20']),
            $backlog,
        ];
    }
}
