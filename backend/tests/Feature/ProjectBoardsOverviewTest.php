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

class ProjectBoardsOverviewTest extends TestCase
{
    use RefreshDatabase;

    private function setupProject(): array
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $viewer = User::factory()->create(['is_admin' => false]);
        $outsider = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::create(['name' => 'Demo', 'owner_id' => $owner->id]);
        foreach ([$owner, $viewer] as $user) {
            $workspace->memberships()->create([
                'user_id' => $user->id,
                'role' => $user->id === $owner->id ? 'owner' : 'member',
            ]);
        }
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Cliente']);
        $project = Project::create([
            'workspace_id' => $workspace->id, 'client_company_id' => $company->id, 'name' => 'Proyecto',
        ]);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $viewer->id, 'role' => 'editor']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Diseño', 'position' => 0]);
        $board->createDefaultColumns();

        return compact('owner', 'viewer', 'outsider', 'project', 'board');
    }

    public function test_aggregate_counts_and_dates_use_real_columns_and_exclude_archived_and_backlog_dates(): void
    {
        extract($this->setupProject());
        $backlog = $board->columns()->where('workflow_state', 'backlog')->firstOrFail();
        $pending = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $done = $board->columns()->where('workflow_state', 'done')->firstOrFail();
        $pending->update(['name' => 'Por validar', 'color' => '#368aca']);

        $idea = Card::create(['board_id' => $board->id, 'column_id' => $backlog->id,
            'title' => 'Ideas', 'start_date' => '2024-01-01', 'due_date' => '2024-01-15']);
        $idea->assignees()->attach($owner->id);
        Card::create(['board_id' => $board->id, 'column_id' => $pending->id,
            'title' => 'Diseñar', 'start_date' => '2026-11-01', 'due_date' => '2026-11-30']);
        Card::create(['board_id' => $board->id, 'column_id' => $done->id,
            'title' => 'Entregado', 'start_date' => '2026-10-01', 'due_date' => '2026-10-15']);
        Card::create(['board_id' => $board->id, 'column_id' => $pending->id,
            'title' => 'Archivada', 'archived_at' => now()]);

        $response = $this->actingAs($owner)
            ->getJson("/api/projects/{$project->id}/boards/overview");
        $response->assertOk()
            ->assertJsonPath('can_manage', true)
            ->assertJsonCount(1, 'boards')
            ->assertJsonPath('boards.0.total', 3)
            ->assertJsonPath('boards.0.completed', 1)
            ->assertJsonPath('boards.0.start_date', '2026-10-01')
            ->assertJsonPath('boards.0.end_date', '2026-11-30')
            ->assertJsonPath('boards.0.member_count', 1)
            ->assertJsonPath('boards.0.columns.1.name', 'Por validar')
            ->assertJsonPath('boards.0.columns.1.color', '#368aca')
            ->assertJsonPath('boards.0.columns.1.count', 1);
    }

    public function test_client_only_sees_public_cards_and_assignees_and_outsider_cannot_view(): void
    {
        extract($this->setupProject());
        $client = User::factory()->create(['is_admin' => false,
            'client_company_id' => $project->client_company_id]);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $client->id, 'role' => 'cliente']);
        $column = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $public = Card::create(['board_id' => $board->id, 'column_id' => $column->id,
            'title' => 'Pública', 'is_internal' => false, 'start_date' => '2027-01-10']);
        $public->assignees()->attach($client->id);
        $private = Card::create(['board_id' => $board->id, 'column_id' => $column->id,
            'title' => 'Privada', 'is_internal' => true, 'start_date' => '2025-01-01']);
        $private->assignees()->attach($owner->id);

        $this->actingAs($client)->getJson("/api/projects/{$project->id}/boards/overview")
            ->assertOk()
            ->assertJsonPath('can_manage', false)
            ->assertJsonPath('boards.0.total', 1)
            ->assertJsonPath('boards.0.start_date', '2027-01-10')
            ->assertJsonPath('boards.0.member_count', 1)
            ->assertJsonPath('boards.0.members.0.id', $client->id)
            ->assertJsonMissing(['id' => $owner->id, 'name' => $owner->name]);

        $this->actingAs($outsider)->getJson("/api/projects/{$project->id}/boards/overview")
            ->assertForbidden();
    }

    public function test_empty_board_returns_zero_counts_and_no_invented_dates(): void
    {
        extract($this->setupProject());
        $this->actingAs($viewer)->getJson("/api/projects/{$project->id}/boards/overview")
            ->assertOk()
            ->assertJsonPath('can_manage', false)
            ->assertJsonPath('boards.0.total', 0)
            ->assertJsonPath('boards.0.completed', 0)
            ->assertJsonPath('boards.0.start_date', null)
            ->assertJsonPath('boards.0.end_date', null)
            ->assertJsonPath('boards.0.member_count', 0);
    }
}
