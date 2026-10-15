<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectPersonnelTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $manager = User::factory()->create(['is_admin' => false]);
        $editor = User::factory()->create(['is_admin' => false]);
        $newcomer = User::factory()->create(['is_admin' => false]);
        $outsider = User::factory()->create(['is_admin' => false]);

        $workspace = Workspace::create(['name' => 'Empresa', 'owner_id' => $manager->id]);
        foreach ([$manager, $editor, $newcomer] as $user) {
            $workspace->memberships()->create([
                'user_id' => $user->id, 'role' => $user->id === $manager->id ? 'owner' : 'member',
            ]);
        }
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Cliente']);
        $project = Project::create([
            'workspace_id' => $workspace->id, 'client_company_id' => $client->id, 'name' => 'Nébula Mobile',
        ]);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $manager->id, 'role' => 'responsable']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $editor->id, 'role' => 'editor']);

        $team = Team::create(['workspace_id' => $workspace->id, 'name' => 'Backend']);
        $team->members()->attach([$editor->id, $newcomer->id]);

        return compact('manager', 'editor', 'newcomer', 'outsider', 'workspace', 'project', 'team');
    }

    public function test_the_project_personnel_view_shows_real_assigned_tasks_and_excludes_archived_cards(): void
    {
        extract($this->fixture());
        $board = Board::create(['project_id' => $project->id, 'name' => 'Sprint']);
        $board->createDefaultColumns();
        $inProgress = $board->columns()->where('workflow_state', 'in_progress')->firstOrFail();
        $done = $board->columns()->where('workflow_state', 'done')->firstOrFail();
        $active = Card::create([
            'board_id' => $board->id, 'column_id' => $inProgress->id, 'title' => 'Pantalla principal',
            'is_internal' => true,
        ]);
        $active->assignees()->attach([$manager->id, $editor->id]);
        $completed = Card::create([
            'board_id' => $board->id, 'column_id' => $done->id, 'title' => 'Diseño final',
        ]);
        $completed->assignees()->attach($editor->id);
        Card::create([
            'board_id' => $board->id, 'column_id' => $inProgress->id,
            'title' => 'Archivada', 'archived_at' => now(),
        ]);

        $response = $this->actingAs($manager)->getJson("/api/projects/{$project->id}/personnel");
        $response->assertOk()->assertJsonPath('summary.total', 2)
            ->assertJsonPath('summary.assigned', 2)
            ->assertJsonPath('summary.in_progress', 1)
            ->assertJsonPath('summary.done', 1)
            ->assertJsonPath('can_manage', true)
            ->assertJsonCount(2, 'members');
    }

    public function test_only_managers_can_add_a_team_and_existing_roles_are_preserved(): void
    {
        extract($this->fixture());
        $url = "/api/projects/{$project->id}/personnel/teams";
        $payload = [
            'team_id' => $team->id, 'role' => 'lector',
            'confirmed_member_ids' => [$editor->id, $newcomer->id],
        ];

        $this->actingAs($editor)->postJson($url, $payload)->assertForbidden();
        $this->actingAs($manager)->postJson($url, $payload)
            ->assertCreated()->assertJsonPath('added', 1);
        $this->assertDatabaseHas('project_team', ['project_id' => $project->id, 'team_id' => $team->id]);
        $this->assertDatabaseHas('project_members', [
            'project_id' => $project->id, 'user_id' => $editor->id, 'role' => 'editor',
        ]);
        $this->assertDatabaseHas('project_members', [
            'project_id' => $project->id, 'user_id' => $newcomer->id, 'role' => 'lector',
        ]);
        $this->actingAs($manager)->postJson($url, $payload)
            ->assertCreated()->assertJsonPath('added', 0);
    }

    public function test_team_assignment_requires_confirmation_of_current_members(): void
    {
        extract($this->fixture());
        $this->actingAs($manager)->postJson("/api/projects/{$project->id}/personnel/teams", [
            'team_id' => $team->id, 'role' => 'editor', 'confirmed_member_ids' => [$editor->id],
        ])->assertUnprocessable();
        $this->assertDatabaseMissing('project_members', [
            'project_id' => $project->id, 'user_id' => $newcomer->id,
        ]);
    }

    public function test_external_user_and_external_team_cannot_be_added(): void
    {
        extract($this->fixture());
        $this->actingAs($manager)->postJson("/api/projects/{$project->id}/personnel/members", [
            'user_id' => $outsider->id, 'role' => 'editor',
        ])->assertUnprocessable();

        $other = Workspace::create(['name' => 'Otra', 'owner_id' => $outsider->id]);
        $otherTeam = Team::create(['workspace_id' => $other->id, 'name' => 'Privado']);
        $this->actingAs($manager)->postJson("/api/projects/{$project->id}/personnel/teams", [
            'team_id' => $otherTeam->id, 'role' => 'editor', 'confirmed_member_ids' => [],
        ])->assertUnprocessable();
    }

    public function test_manager_cannot_remove_the_last_project_responsible(): void
    {
        extract($this->fixture());
        $this->actingAs($manager)
            ->deleteJson("/api/projects/{$project->id}/personnel/members/{$manager->id}")
            ->assertUnprocessable();
        $this->assertDatabaseHas('project_members', [
            'project_id' => $project->id, 'user_id' => $manager->id, 'role' => 'responsable',
        ]);
    }

    public function test_clients_only_see_their_public_assignments_and_their_own_identity(): void
    {
        extract($this->fixture());
        $client = User::factory()->create([
            'is_admin' => false, 'client_company_id' => $project->client_company_id,
        ]);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $client->id, 'role' => 'cliente']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Tablero']);
        $board->createDefaultColumns();
        $column = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $private = Card::create(['board_id' => $board->id, 'column_id' => $column->id,
            'title' => 'Interna', 'is_internal' => true]);
        $public = Card::create(['board_id' => $board->id, 'column_id' => $column->id,
            'title' => 'Visible', 'is_internal' => false]);
        $private->assignees()->attach($client->id);
        $public->assignees()->attach($client->id);

        $this->actingAs($client)->getJson("/api/projects/{$project->id}/personnel")
            ->assertOk()
            ->assertJsonPath('can_manage', false)
            ->assertJsonPath('summary.total', 1)
            ->assertJsonCount(1, 'members')
            ->assertJsonCount(0, 'teams')
            ->assertJsonCount(0, 'available_people')
            ->assertJsonMissing(['title' => 'Interna']);
    }
}
