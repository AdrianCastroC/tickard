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

    public function test_apply_uses_the_latest_constraint_from_all_incoming_dependencies(): void
    {
        [$first, $successor] = $this->createCards('2026-10-01', '2026-10-10', '2026-10-01', '2026-10-11');
        $second = $this->createCard($successor, 'Segundo', '2026-10-18', '2026-10-28');
        $third = $this->createCard($successor, 'Tercero', '2026-10-10', '2026-10-20');
        $fourth = $this->createCard($successor, 'Cuarto', '2026-10-19', '2026-10-29');
        $item = CardChecklistItem::create([
            'card_id' => $successor->id,
            'body' => 'Fecha interna',
            'due_date' => '2026-10-05',
            'position' => 1,
        ]);
        $dependencies = [
            ['predecessor' => $first, 'type' => 'fs'],
            ['predecessor' => $second, 'type' => 'ss'],
            ['predecessor' => $third, 'type' => 'ff'],
            ['predecessor' => $fourth, 'type' => 'sf'],
        ];

        foreach (array_reverse($dependencies) as $entry) {
            $dependency = CardDependency::create([
                'predecessor_card_id' => $entry['predecessor']->id,
                'successor_card_id' => $successor->id,
                'type' => $entry['type'],
            ]);
        }

        app(CardDependencyService::class)->apply($dependency->fresh(['predecessor', 'successor']));

        $successor->refresh();
        $item->refresh();

        $this->assertSame('2026-10-18', $successor->start_date->toDateString());
        $this->assertSame('2026-10-28', $successor->due_date->toDateString());
        $this->assertSame('2026-10-22', $item->due_date->toDateString());
    }

    public function test_apply_has_the_same_fan_in_result_when_fs_dependencies_are_created_in_order(): void
    {
        [$first, $successor] = $this->createCards('2026-10-01', '2026-10-10', '2026-10-01', '2026-10-11');
        $second = $this->createCard($successor, 'Segundo', '2026-10-08', '2026-10-18');
        CardDependency::create([
            'predecessor_card_id' => $first->id,
            'successor_card_id' => $successor->id,
            'type' => 'fs',
        ]);
        $dependency = CardDependency::create([
            'predecessor_card_id' => $second->id,
            'successor_card_id' => $successor->id,
            'type' => 'fs',
        ]);

        app(CardDependencyService::class)->apply($dependency->fresh(['predecessor', 'successor']));

        $this->assertSame('2026-10-18', $successor->fresh()->start_date->toDateString());
    }

    public function test_propagate_recalculates_fan_in_before_downstream_cards(): void
    {
        [$first, $successor] = $this->createCards('2026-10-01', '2026-10-10', '2026-10-01', '2026-10-11');
        $second = $this->createCard($successor, 'Segundo', '2026-10-08', '2026-10-18');
        $downstream = $this->createCard($successor, 'Posterior', '2026-10-11', '2026-10-21');
        CardDependency::create([
            'predecessor_card_id' => $first->id,
            'successor_card_id' => $successor->id,
            'type' => 'fs',
        ]);
        CardDependency::create([
            'predecessor_card_id' => $second->id,
            'successor_card_id' => $successor->id,
            'type' => 'ss',
        ]);
        CardDependency::create([
            'predecessor_card_id' => $successor->id,
            'successor_card_id' => $downstream->id,
            'type' => 'fs',
        ]);

        app(CardDependencyService::class)->propagate($first->fresh());

        $successor->refresh();
        $downstream->refresh();

        $this->assertSame('2026-10-10', $successor->start_date->toDateString());
        $this->assertSame('2026-10-20', $successor->due_date->toDateString());
        $this->assertSame('2026-10-20', $downstream->start_date->toDateString());
        $this->assertSame('2026-10-30', $downstream->due_date->toDateString());
    }

    public function test_recalculate_without_incoming_dependencies_does_not_move_card(): void
    {
        [, $successor] = $this->createCards('2026-10-01', '2026-10-10', '2026-10-11', '2026-10-21');

        app(CardDependencyService::class)->recalculate($successor);

        $successor->refresh();

        $this->assertSame('2026-10-11', $successor->start_date->toDateString());
        $this->assertSame('2026-10-21', $successor->due_date->toDateString());
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

    private function createCard(Card $template, string $title, string $startDate, string $dueDate): Card
    {
        return Card::create([
            'board_id' => $template->board_id,
            'column_id' => $template->column_id,
            'title' => $title,
            'start_date' => $startDate,
            'due_date' => $dueDate,
        ]);
    }
}
