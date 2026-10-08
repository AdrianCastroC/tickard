<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\CardDependency;
use App\Models\ClientCompany;
use App\Models\Column;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Support\CardDependencyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CardDependenciesTest extends TestCase
{
    use RefreshDatabase;

    public function test_cross_board_dependency_can_be_created_updated_and_deleted(): void
    {
        [$user, $firstCard, $secondCard] = $this->createProjectCards();
        $firstBoardRevision = $firstCard->board->revision;
        $secondBoardRevision = $secondCard->board->revision;

        $response = $this->actingAs($user)->postJson("/api/cards/{$firstCard->id}/dependencies", [
            'successor_card_id' => $secondCard->id,
            'type' => 'fs',
        ]);

        $response->assertCreated()
            ->assertJsonPath('predecessor_card_id', $firstCard->id)
            ->assertJsonPath('successor_card_id', $secondCard->id)
            ->assertJsonPath('type', 'fs');

        $dependency = CardDependency::firstOrFail();
        $this->assertNotSame($firstCard->board_id, $secondCard->board_id);
        $this->assertSame($firstBoardRevision + 1, $firstCard->board->fresh()->revision);
        $this->assertSame($secondBoardRevision + 1, $secondCard->board->fresh()->revision);

        $firstBoardRevision = $firstCard->board->fresh()->revision;
        $secondBoardRevision = $secondCard->board->fresh()->revision;
        $this->actingAs($user)
            ->patchJson("/api/card-dependencies/{$dependency->id}", ['type' => 'ss'])
            ->assertOk()
            ->assertJsonPath('type', 'ss');
        $this->assertSame($firstBoardRevision + 1, $firstCard->board->fresh()->revision);
        $this->assertSame($secondBoardRevision + 1, $secondCard->board->fresh()->revision);

        $firstBoardRevision = $firstCard->board->fresh()->revision;
        $secondBoardRevision = $secondCard->board->fresh()->revision;
        $this->actingAs($user)
            ->deleteJson("/api/card-dependencies/{$dependency->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('card_dependencies', ['id' => $dependency->id]);
        $this->assertSame($firstBoardRevision + 1, $firstCard->board->fresh()->revision);
        $this->assertSame($secondBoardRevision + 1, $secondCard->board->fresh()->revision);
    }

    public function test_api_rejects_a_successor_from_another_project(): void
    {
        [$user, $firstCard] = $this->createProjectCards();
        [, , $externalCard] = $this->createProjectCards('External');

        $this->actingAs($user)
            ->postJson("/api/cards/{$firstCard->id}/dependencies", [
                'successor_card_id' => $externalCard->id,
                'type' => 'fs',
            ])
            ->assertNotFound();

        $this->assertDatabaseCount('card_dependencies', 0);
    }

    public function test_service_rejects_a_successor_from_another_project(): void
    {
        [, $firstCard] = $this->createProjectCards();
        [, , $externalCard] = $this->createProjectCards('External');

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        app(CardDependencyService::class)->create($firstCard, $externalCard);
    }

    public function test_cycle_detection_works_across_boards(): void
    {
        [, $firstCard, $secondCard] = $this->createProjectCards();
        $thirdCard = Card::create([
            'board_id' => $firstCard->board_id,
            'column_id' => $firstCard->column_id,
            'title' => 'C',
            'start_date' => '2026-10-20',
            'due_date' => '2026-10-30',
        ]);
        $service = app(CardDependencyService::class);

        $service->create($firstCard, $secondCard);
        $service->create($secondCard, $thirdCard);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $service->create($thirdCard, $firstCard);
    }

    public function test_update_card_propagates_revisions_once_across_a_board_chain(): void
    {
        [$user, $firstCard, $secondCard] = $this->createProjectCards();
        $thirdBoard = Board::create(['project_id' => $firstCard->board->project_id, 'name' => 'Board 3']);
        $thirdColumn = Column::create(['board_id' => $thirdBoard->id, 'name' => 'Por hacer', 'workflow_state' => 'pending']);
        $thirdCard = Card::create([
            'board_id' => $thirdBoard->id,
            'column_id' => $thirdColumn->id,
            'title' => 'C',
            'start_date' => '2026-10-20',
            'due_date' => '2026-10-30',
        ]);
        $service = app(CardDependencyService::class);
        $service->create($firstCard, $secondCard);
        $service->create($secondCard, $thirdCard);
        $revisions = [
            $firstCard->board_id => $firstCard->board->fresh()->revision,
            $secondCard->board_id => $secondCard->board->fresh()->revision,
            $thirdCard->board_id => $thirdCard->board->fresh()->revision,
        ];

        $this->actingAs($user)->patchJson("/api/cards/{$firstCard->id}", [
            'start_date' => '2026-10-05',
            'due_date' => '2026-10-15',
        ])->assertNoContent();

        $this->assertSame('2026-10-15', $secondCard->fresh()->start_date->toDateString());
        $this->assertSame('2026-10-25', $thirdCard->fresh()->start_date->toDateString());
        $this->assertSame($revisions[$firstCard->board_id] + 1, $firstCard->board->fresh()->revision);
        $this->assertSame($revisions[$secondCard->board_id] + 1, $secondCard->board->fresh()->revision);
        $this->assertSame($revisions[$thirdCard->board_id] + 1, $thirdCard->board->fresh()->revision);
    }

    public function test_update_card_deduplicates_revision_when_two_cards_on_one_board_change(): void
    {
        [$user, $firstCard, $secondCard] = $this->createProjectCards();
        $secondBoardRevision = $secondCard->board->fresh()->revision;
        $thirdCard = Card::create([
            'board_id' => $secondCard->board_id,
            'column_id' => $secondCard->column_id,
            'title' => 'C',
            'start_date' => '2026-10-10',
            'due_date' => '2026-10-20',
        ]);
        $service = app(CardDependencyService::class);
        $service->create($firstCard, $secondCard);
        $service->create($firstCard, $thirdCard);

        $this->actingAs($user)->patchJson("/api/cards/{$firstCard->id}", [
            'start_date' => '2026-10-05',
            'due_date' => '2026-10-15',
        ])->assertNoContent();

        $this->assertSame('2026-10-15', $secondCard->fresh()->start_date->toDateString());
        $this->assertSame('2026-10-15', $thirdCard->fresh()->start_date->toDateString());
        $this->assertSame($secondBoardRevision + 1, $secondCard->board->fresh()->revision);
    }

    public function test_update_card_does_not_touch_descendant_board_when_planning_does_not_change(): void
    {
        [$user, $firstCard, $secondCard] = $this->createProjectCards();
        app(CardDependencyService::class)->create($firstCard, $secondCard);
        $firstBoardRevision = $firstCard->board->fresh()->revision;
        $secondBoardRevision = $secondCard->board->fresh()->revision;

        $this->actingAs($user)->patchJson("/api/cards/{$firstCard->id}", [
            'start_date' => '2026-10-01',
            'due_date' => '2026-10-10',
        ])->assertNoContent();

        $this->assertSame($firstBoardRevision + 1, $firstCard->board->fresh()->revision);
        $this->assertSame($secondBoardRevision, $secondCard->board->fresh()->revision);
    }

    /** @return array{0: User, 1: Card, 2: Card} */
    private function createProjectCards(string $projectName = 'Project'): array
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => $projectName, 'owner_id' => $user->id]);
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => $projectName]);
        $project = Project::create([
            'workspace_id' => $workspace->id,
            'client_company_id' => $client->id,
            'name' => $projectName,
        ]);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $user->id, 'role' => 'editor']);
        $firstBoard = Board::create(['project_id' => $project->id, 'name' => 'Board 1']);
        $secondBoard = Board::create(['project_id' => $project->id, 'name' => 'Board 2']);
        $firstColumn = Column::create(['board_id' => $firstBoard->id, 'name' => 'Por hacer', 'workflow_state' => 'pending']);
        $secondColumn = Column::create(['board_id' => $secondBoard->id, 'name' => 'Por hacer', 'workflow_state' => 'pending']);

        return [
            $user,
            Card::create([
                'board_id' => $firstBoard->id,
                'column_id' => $firstColumn->id,
                'title' => 'A',
                'start_date' => '2026-10-01',
                'due_date' => '2026-10-10',
            ]),
            Card::create([
                'board_id' => $secondBoard->id,
                'column_id' => $secondColumn->id,
                'title' => 'B',
                'start_date' => '2026-10-10',
                'due_date' => '2026-10-20',
            ]),
        ];
    }
}
