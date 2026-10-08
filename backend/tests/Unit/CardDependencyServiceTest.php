<?php

namespace Tests\Unit;

use App\Models\Board;
use App\Models\Card;
use App\Models\CardChecklistItem;
use App\Models\CardDependency;
use App\Models\ClientCompany;
use App\Models\Column;
use App\Models\Project;
use App\Models\User;
use App\Models\Workspace;
use App\Support\CardDependencyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CardDependencyServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_apply_shifts_planned_checklist_dates_without_touching_execution_dates(): void
    {
        [$predecessor, $successor] = $this->createCards(
            '2026-10-07',
            '2026-10-17',
            '2026-10-10',
            '2026-10-20',
        );
        $completedAt = '2026-10-11 14:30:00';

        $item = CardChecklistItem::create([
            'card_id' => $successor->id,
            'body' => 'Completar',
            'is_done' => true,
            'due_date' => '2026-10-12',
            'completed_at' => $completedAt,
            'position' => 1,
        ]);
        $nullDueItem = CardChecklistItem::create([
            'card_id' => $successor->id,
            'body' => 'Sin fecha',
            'due_date' => null,
            'position' => 2,
        ]);
        $successor->update([
            'started_at' => '2026-10-09 09:00:00',
            'completed_at' => '2026-10-19 17:00:00',
        ]);

        $dependency = CardDependency::create([
            'predecessor_card_id' => $predecessor->id,
            'successor_card_id' => $successor->id,
            'type' => 'fs',
        ]);

        app(CardDependencyService::class)->apply($dependency->fresh(['predecessor', 'successor']));

        $successor->refresh();
        $item->refresh();
        $nullDueItem->refresh();

        $this->assertSame('2026-10-17', $successor->start_date->toDateString());
        $this->assertSame('2026-10-27', $successor->due_date->toDateString());
        $this->assertSame('2026-10-19', $item->due_date->toDateString());
        $this->assertSame($completedAt, $item->completed_at->format('Y-m-d H:i:s'));
        $this->assertNull($nullDueItem->due_date);
        $this->assertSame('2026-10-09 09:00:00', $successor->started_at->format('Y-m-d H:i:s'));
        $this->assertSame('2026-10-19 17:00:00', $successor->completed_at->format('Y-m-d H:i:s'));
    }

    public function test_apply_supports_negative_planning_deltas(): void
    {
        [$predecessor, $successor] = $this->createCards(
            '2026-10-10',
            '2026-10-17',
            '2026-10-20',
            '2026-10-30',
        );
        $item = CardChecklistItem::create([
            'card_id' => $successor->id,
            'body' => 'Completar',
            'due_date' => '2026-10-25',
            'position' => 1,
        ]);
        $dependency = CardDependency::create([
            'predecessor_card_id' => $predecessor->id,
            'successor_card_id' => $successor->id,
            'type' => 'ss',
        ]);

        app(CardDependencyService::class)->apply($dependency->fresh(['predecessor', 'successor']));

        $item->refresh();

        $this->assertSame('2026-10-10', $successor->fresh()->start_date->toDateString());
        $this->assertSame('2026-10-15', $item->due_date->toDateString());
    }

    /** @return array{0: Card, 1: Card} */
    private function createCards(
        string $predecessorStart,
        string $predecessorDue,
        string $successorStart,
        string $successorDue,
    ): array {
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Test', 'owner_id' => $user->id]);
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Test']);
        $project = Project::create([
            'workspace_id' => $workspace->id,
            'client_company_id' => $client->id,
            'name' => 'Test',
        ]);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Test']);
        $column = Column::create([
            'board_id' => $board->id,
            'name' => 'Por hacer',
            'workflow_state' => 'pending',
        ]);

        return [
            Card::create([
                'board_id' => $board->id,
                'column_id' => $column->id,
                'title' => 'Predecesora',
                'start_date' => $predecessorStart,
                'due_date' => $predecessorDue,
            ]),
            Card::create([
                'board_id' => $board->id,
                'column_id' => $column->id,
                'title' => 'Sucesora',
                'start_date' => $successorStart,
                'due_date' => $successorDue,
            ]),
        ];
    }
}
