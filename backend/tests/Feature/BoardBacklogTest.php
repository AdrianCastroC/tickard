<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\ClientCompany;
use App\Models\Column;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoardBacklogTest extends TestCase
{
    use RefreshDatabase;

    public function test_last_backlog_cannot_change_state_or_be_deleted(): void
    {
        [$user, $board, $backlog, $pending] = $this->createBoard();
        $revision = (int) $board->revision;

        $this->actingAs($user)
            ->patchJson("/api/columns/{$backlog->id}", ['workflow_state' => 'pending'])
            ->assertStatus(422);
        $this->actingAs($user)
            ->deleteJson("/api/columns/{$backlog->id}")
            ->assertStatus(422);

        $this->assertSame('backlog', $backlog->fresh()->workflow_state);
        $this->assertDatabaseHas('columns', ['id' => $backlog->id]);
        $this->assertSame($revision, $board->fresh()->revision);
        $this->assertSame('pending', $pending->fresh()->workflow_state);
    }

    public function test_one_of_two_backlogs_can_change_state_and_be_deleted(): void
    {
        [$user, $board, $backlog] = $this->createBoard();
        $secondBacklog = $board->columns()->create([
            'name' => 'Ideas',
            'workflow_state' => 'backlog',
            'position' => 2,
        ]);
        $thirdBacklog = $board->columns()->create([
            'name' => 'Parking',
            'workflow_state' => 'backlog',
            'position' => 3,
        ]);

        $this->actingAs($user)
            ->patchJson("/api/columns/{$backlog->id}", ['workflow_state' => 'pending'])
            ->assertOk();
        $this->assertSame('backlog', $secondBacklog->fresh()->workflow_state);

        $this->actingAs($user)
            ->deleteJson("/api/columns/{$thirdBacklog->id}")
            ->assertNoContent();
    }

    public function test_pending_column_can_become_an_additional_backlog(): void
    {
        [$user, , , $pending] = $this->createBoard();

        $this->actingAs($user)
            ->patchJson("/api/columns/{$pending->id}", ['workflow_state' => 'backlog'])
            ->assertOk();

        $this->assertSame(2, $pending->board->columns()->where('workflow_state', 'backlog')->count());
    }

    /** @return array{0: User, 1: Board, 2: Column, 3: Column} */
    private function createBoard(): array
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Backlog test', 'owner_id' => $user->id]);
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Backlog test']);
        $project = Project::create([
            'workspace_id' => $workspace->id,
            'client_company_id' => $client->id,
            'name' => 'Backlog test',
        ]);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $user->id, 'role' => 'responsable']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Board']);
        $backlog = $board->columns()->create([
            'name' => 'Backlog',
            'workflow_state' => 'backlog',
            'position' => 0,
        ]);
        $pending = $board->columns()->create([
            'name' => 'Pendiente',
            'workflow_state' => 'pending',
            'position' => 1,
        ]);

        return [$user, $board, $backlog, $pending];
    }
}
