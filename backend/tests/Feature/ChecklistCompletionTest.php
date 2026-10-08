<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\CardChecklistItem;
use App\Models\CardModule;
use App\Models\ClientCompany;
use App\Models\Column;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class ChecklistCompletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_checklist_completion_timestamp_follows_state_transitions_and_is_read_only(): void
    {
        [$user, $item] = $this->createChecklistItem();

        $this->actingAs($user)->patchJson("/api/checklist/{$item->id}", [
            'is_done' => true,
        ])->assertOk()->assertJsonPath('completed_at', fn ($value) => $value !== null);

        $completedAt = $item->fresh()->completed_at;
        $this->assertNotNull($completedAt);

        $this->actingAs($user)->patchJson("/api/checklist/{$item->id}", [
            'is_done' => true,
            'completed_at' => '2000-01-01T00:00:00Z',
        ])->assertOk()->assertJsonPath('completed_at', $completedAt->toIso8601String());

        $this->actingAs($user)->patchJson("/api/checklist/{$item->id}", [
            'is_done' => false,
        ])->assertOk()->assertJsonPath('completed_at', null);

        Carbon::setTestNow(Carbon::parse('2026-10-08 10:01:00'));

        $this->actingAs($user)->patchJson("/api/checklist/{$item->id}", [
            'is_done' => true,
        ])->assertOk();

        $recompletedAt = $item->fresh()->completed_at;
        $this->assertNotNull($recompletedAt);
        $this->assertNotSame($completedAt->toIso8601String(), $recompletedAt->toIso8601String());

        $this->actingAs($user)->patchJson("/api/checklist/{$item->id}", [
            'body' => 'Texto actualizado',
            'due_date' => '2099-01-01',
        ])->assertOk()->assertJsonPath('completed_at', $recompletedAt->toIso8601String());

        $this->assertSame($recompletedAt->toIso8601String(), $item->fresh()->completed_at->toIso8601String());
    }

    /** @return array{0: User, 1: CardChecklistItem} */
    private function createChecklistItem(): array
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Test', 'owner_id' => $user->id]);
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Test']);
        $project = Project::create([
            'workspace_id' => $workspace->id,
            'client_company_id' => $client->id,
            'name' => 'Test',
        ]);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $user->id, 'role' => 'editor']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Test']);
        $column = Column::create([
            'board_id' => $board->id,
            'name' => 'Por hacer',
            'workflow_state' => 'pending',
        ]);
        $card = Card::create([
            'board_id' => $board->id,
            'column_id' => $column->id,
            'title' => 'Test',
            'due_date' => '2099-01-02',
        ]);
        $module = CardModule::create([
            'card_id' => $card->id,
            'type' => CardModule::TYPE_CHECKLIST,
            'title' => 'Checklist',
        ]);
        $item = CardChecklistItem::create([
            'card_id' => $card->id,
            'card_module_id' => $module->id,
            'body' => 'Pendiente',
            'position' => 1,
        ]);

        Carbon::setTestNow(Carbon::parse('2026-10-08 10:00:00'));

        return [$user, $item];
    }
}
