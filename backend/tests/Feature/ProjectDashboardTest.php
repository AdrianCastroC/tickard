<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Board;
use App\Models\Card;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProjectDashboardTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $client = User::factory()->create(['is_admin' => false]);
        $outsider = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::create(['name' => 'Demo', 'owner_id' => $owner->id]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Cliente']);
        $project = Project::create(['workspace_id' => $workspace->id, 'client_company_id' => $company->id,
            'name' => 'Proyecto', 'client_access_enabled' => true]);
        $workspace->update(['show_clients' => true]);
        $client->update(['client_company_id' => $company->id]);
        $workspace->memberships()->create(['user_id' => $client->id, 'role' => 'member']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $client->id, 'role' => 'cliente']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Diseño', 'position' => 0]);
        $board->createDefaultColumns();

        return compact('owner', 'client', 'outsider', 'project', 'board');
    }

    public function test_dashboard_uses_actual_columns_dates_and_milestones(): void
    {
        extract($this->fixture());
        $backlog = $board->columns()->where('workflow_state', 'backlog')->firstOrFail();
        $pending = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $done = $board->columns()->where('workflow_state', 'done')->firstOrFail();
        $pending->update(['name' => 'Preparado', 'color' => '#357fde']);

        Card::create(['board_id' => $board->id, 'column_id' => $backlog->id,
            'title' => 'Ideas', 'start_date' => '2020-01-01', 'due_date' => '2020-01-03']);
        $task = Card::create(['board_id' => $board->id, 'column_id' => $pending->id,
            'title' => 'Entrega prevista', 'start_date' => '2026-11-01',
            'due_date' => '2026-11-10', 'is_milestone' => true, 'is_internal' => false]);
        Card::create(['board_id' => $board->id, 'column_id' => $done->id,
            'title' => 'Terminada', 'start_date' => '2026-10-01', 'due_date' => '2026-10-02']);
        Card::create(['board_id' => $board->id, 'column_id' => $pending->id,
            'title' => 'Archivada', 'archived_at' => now()]);
        Activity::create(['card_id' => $task->id, 'user_id' => $owner->id,
            'type' => 'created', 'meta' => []]);

        $this->actingAs($owner)->getJson("/api/projects/{$project->id}/dashboard")
            ->assertOk()
            ->assertJsonPath('summary.total', 3)
            ->assertJsonPath('summary.completed', 1)
            ->assertJsonPath('summary.pending', 1)
            ->assertJsonPath('summary.backlog', 1)
            ->assertJsonPath('summary.start_date', '2026-10-01')
            ->assertJsonMissingPath('upcoming')
            ->assertJsonMissingPath('overdue_tasks')
            ->assertJsonPath('summary.end_date', '2026-11-10')
            ->assertJsonPath('boards.0.total', 3)
            ->assertJsonPath('columns.1.name', 'Preparado')
            ->assertJsonPath('columns.1.color', '#357fde')
            ->assertJsonPath('milestones.0.title', 'Entrega prevista')
            ->assertJsonPath('activity.0.card_title', 'Entrega prevista');
    }

    public function test_client_cannot_see_internal_cards_or_activity_and_stranger_is_denied(): void
    {
        extract($this->fixture());
        $column = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $public = Card::create(['board_id' => $board->id, 'column_id' => $column->id,
            'title' => 'Pública', 'is_internal' => false, 'due_date' => '2027-01-01']);
        $private = Card::create(['board_id' => $board->id, 'column_id' => $column->id,
            'title' => 'Privada', 'is_internal' => true, 'due_date' => '2026-01-01',
            'is_milestone' => true]);
        Activity::create(['card_id' => $public->id, 'user_id' => $client->id,
            'type' => 'commented', 'meta' => ['internal' => true]]);
        Activity::create(['card_id' => $public->id, 'user_id' => $client->id,
            'type' => 'moved', 'meta' => []]);
        Activity::create(['card_id' => $private->id, 'user_id' => $owner->id,
            'type' => 'created', 'meta' => []]);

        $this->actingAs($client)->getJson("/api/projects/{$project->id}/dashboard")
            ->assertOk()
            ->assertJsonPath('summary.total', 1)
            ->assertJsonPath('summary.overdue', 0)
            ->assertJsonPath('summary.start_date', '2027-01-01')
            ->assertJsonPath('summary.member_count', 1)
            ->assertJsonCount(0, 'milestones')
            ->assertJsonCount(1, 'activity')
            ->assertJsonPath('activity.0.card_title', 'Pública')
            ->assertJsonMissing(['title' => 'Privada']);

        $this->actingAs($outsider)->getJson("/api/projects/{$project->id}/dashboard")->assertForbidden();
    }

    public function test_empty_project_is_valid_and_has_no_artificial_metrics(): void
    {
        extract($this->fixture());
        $this->actingAs($owner)->getJson("/api/projects/{$project->id}/dashboard")
            ->assertOk()
            ->assertJsonPath('summary.total', 0)
            ->assertJsonPath('summary.start_date', null)
            ->assertJsonPath('summary.end_date', null)
            ->assertJsonCount(0, 'columns')
            ->assertJsonCount(1, 'boards')
            ->assertJsonCount(0, 'activity');
    }

    public function test_team_progress_counts_explicit_assignments_and_includes_empty_linked_teams(): void
    {
        extract($this->fixture());
        $team = Team::create(['workspace_id' => $project->workspace_id, 'name' => 'Desarrollo']);
        $shared = Team::create(['workspace_id' => $project->workspace_id, 'name' => 'Diseño']);
        $empty = Team::create(['workspace_id' => $project->workspace_id, 'name' => 'Soporte']);
        foreach ([$team, $shared, $empty] as $linked) {
            DB::table('project_team')->insert([
                'project_id' => $project->id, 'team_id' => $linked->id,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        $pending = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $done = $board->columns()->where('workflow_state', 'done')->firstOrFail();
        $completed = Card::create(['board_id' => $board->id, 'column_id' => $done->id,
            'title' => 'Completada', 'is_internal' => false]);
        $incomplete = Card::create(['board_id' => $board->id, 'column_id' => $pending->id,
            'title' => 'Pendiente', 'is_internal' => false]);
        $archived = Card::create(['board_id' => $board->id, 'column_id' => $done->id,
            'title' => 'Archivada', 'is_internal' => false, 'archived_at' => now()]);
        $completed->teams()->attach([$team->id, $shared->id]);
        $incomplete->teams()->attach($team->id);
        $archived->teams()->attach($team->id);

        $this->actingAs($owner)->getJson("/api/projects/{$project->id}/dashboard")
            ->assertOk()
            ->assertJsonPath('summary.total', 2)
            ->assertJsonCount(3, 'teams')
            ->assertJsonPath('teams.0.name', 'Desarrollo')
            ->assertJsonPath('teams.0.completed', 1)
            ->assertJsonPath('teams.0.total', 2)
            ->assertJsonPath('teams.1.name', 'Diseño')
            ->assertJsonPath('teams.1.completed', 1)
            ->assertJsonPath('teams.1.total', 1)
            ->assertJsonPath('teams.2.name', 'Soporte')
            ->assertJsonPath('teams.2.total', 0);

        $this->actingAs($client)->getJson("/api/projects/{$project->id}/dashboard")
            ->assertOk()->assertJsonCount(0, 'teams');
    }

    public function test_distribution_orders_workflow_states_across_different_boards(): void
    {
        extract($this->fixture());
        $other = Board::create(['project_id' => $project->id, 'name' => 'Segundo', 'position' => 1]);
        $other->createDefaultColumns();
        $firstPending = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $firstReview = $board->columns()->where('workflow_state', 'review')->firstOrFail();
        $nextProgress = $other->columns()->where('workflow_state', 'in_progress')->firstOrFail();
        $nextDone = $other->columns()->where('workflow_state', 'done')->firstOrFail();
        foreach ([
            [$firstPending, 'Por hacer'],
            [$firstReview, 'Revisión'],
            [$nextProgress, 'En curso'],
            [$nextDone, 'Completada'],
        ] as [$column, $title]) {
            Card::create(['board_id' => $column->board_id, 'column_id' => $column->id,
                'title' => $title, 'is_internal' => false]);
        }

        $this->actingAs($owner)->getJson("/api/projects/{$project->id}/dashboard")
            ->assertOk()
            ->assertJsonPath('columns.0.workflow_state', 'pending')
            ->assertJsonPath('columns.1.workflow_state', 'in_progress')
            ->assertJsonPath('columns.2.workflow_state', 'review')
            ->assertJsonPath('columns.3.workflow_state', 'done')
            ->assertJsonCount(2, 'boards');
    }

}
