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
            'workspace_id' => $workspace->id, 'client_company_id' => $client->id,
            'name' => 'Nébula Mobile', 'client_access_enabled' => true,
        ]);
        $workspace->update(['show_clients' => true]);
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

    public function test_personnel_uses_real_column_names_order_and_per_member_counts(): void
    {
        extract($this->fixture());
        $board = Board::create(['project_id' => $project->id, 'name' => 'Sprint', 'position' => 1]);
        $board->createDefaultColumns();

        $backlog = $board->columns()->where('workflow_state', 'backlog')->firstOrFail();
        $pending = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $backlog->update(['name' => 'Ideas futuras', 'color' => '#aabbcc', 'position' => 6]);
        $pending->update(['name' => 'Pendiente de validar', 'position' => 0]);

        $idea = Card::create(['board_id' => $board->id, 'column_id' => $backlog->id,
            'title' => 'Investigar']);
        $idea->assignees()->attach($editor->id);
        $task = Card::create(['board_id' => $board->id, 'column_id' => $pending->id,
            'title' => 'Validar']);
        $task->assignees()->attach($editor->id);

        $response = $this->actingAs($manager)->getJson("/api/projects/{$project->id}/personnel");
        $response->assertOk()
            ->assertJsonPath('columns.0.id', $backlog->id)
            ->assertJsonPath('columns.0.name', 'Ideas futuras')
            ->assertJsonPath('columns.0.color', '#aabbcc')
            ->assertJsonPath('columns.1.id', $pending->id)
            ->assertJsonPath('columns.1.name', 'Pendiente de validar')
            ->assertJsonPath('summary.backlog', 1)
            ->assertJsonPath('summary.pending', 1);

        $members = collect($response->json('members'));
        $editorData = $members->firstWhere('id', $editor->id);
        $this->assertSame(1, $editorData['column_counts'][(string) $backlog->id]);
        $this->assertSame(1, $editorData['column_counts'][(string) $pending->id]);
        $this->assertSame('Ideas futuras', collect($editorData['tasks'])->firstWhere('id', $idea->id)['column_name']);
        $this->assertSame('Pendiente de validar', collect($editorData['tasks'])->firstWhere('id', $task->id)['column_name']);
    }

    public function test_client_cannot_see_private_column_names_in_personnel(): void
    {
        extract($this->fixture());
        $clientUser = User::factory()->create(['is_admin' => false,
            'client_company_id' => $project->client_company_id]);
        $workspace->memberships()->create(['user_id' => $clientUser->id, 'role' => 'member']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $clientUser->id, 'role' => 'cliente']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Servicio']);
        $board->createDefaultColumns();
        $publicColumn = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $privateColumn = $board->columns()->where('workflow_state', 'review')->firstOrFail();
        $privateColumn->update(['name' => 'Revisión secreta']);
        $visible = Card::create(['board_id' => $board->id, 'column_id' => $publicColumn->id,
            'title' => 'Visible', 'is_internal' => false]);
        $hidden = Card::create(['board_id' => $board->id, 'column_id' => $privateColumn->id,
            'title' => 'Oculta', 'is_internal' => true]);
        $visible->assignees()->attach($clientUser->id);
        $hidden->assignees()->attach($clientUser->id);

        $this->actingAs($clientUser)->getJson("/api/projects/{$project->id}/personnel")
            ->assertOk()
            ->assertJsonCount(1, 'columns')
            ->assertJsonPath('columns.0.id', $publicColumn->id)
            ->assertJsonMissing(['name' => 'Revisión secreta'])
            ->assertJsonMissing(['column_name' => 'Revisión secreta']);
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

    public function test_workspace_owner_cannot_be_removed_from_project(): void
    {
        extract($this->fixture());
        $this->actingAs($manager)
            ->deleteJson("/api/projects/{$project->id}/personnel/members/{$manager->id}")
            ->assertForbidden();
        $this->assertDatabaseHas('project_members', [
            'project_id' => $project->id, 'user_id' => $manager->id, 'role' => 'responsable',
        ]);
    }

    public function test_project_personnel_uses_job_title_from_its_own_workspace(): void
    {
        extract($this->fixture());

        $workspace->memberships()->where('user_id', $editor->id)
            ->firstOrFail()->update(['job_title' => 'Programador junior']);

        $otherWorkspace = Workspace::create(['name' => 'Otra empresa', 'owner_id' => $outsider->id]);
        $otherWorkspace->memberships()->create([
            'user_id' => $editor->id, 'role' => 'member', 'job_title' => 'Director técnico',
        ]);

        $response = $this->actingAs($manager)->getJson("/api/projects/{$project->id}/personnel")
            ->assertOk();

        $person = collect($response->json('members'))->firstWhere('id', $editor->id);
        $this->assertSame('Programador junior', $person['job_title']);
        $this->assertNotSame('Director técnico', $person['job_title']);
        $ownerPerson = collect($response->json('members'))->firstWhere('id', $manager->id);
        $this->assertNull($ownerPerson['job_title']);
    }

    public function test_clients_only_see_their_public_assignments_and_their_own_identity(): void
    {
        extract($this->fixture());
        $client = User::factory()->create([
            'is_admin' => false, 'client_company_id' => $project->client_company_id,
        ]);
        $workspace->memberships()->create(['user_id' => $client->id, 'role' => 'member']);
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
            ->assertJsonPath('members.0.job_title', null)
            ->assertJsonMissing(['title' => 'Interna']);
    }
}
