<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceCustomRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GlobalProjectScopeSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_without_project_view_cannot_read_project_metadata_from_global_views(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $member = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Secret Project']);
        $membership = ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $member->id, 'role' => 'editor',
        ]);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Confidencial']);
        $board->createDefaultColumns();
        $card = Card::create([
            'board_id' => $board->id, 'column_id' => $board->columns()->firstOrFail()->id,
            'title' => 'Dato privado', 'is_internal' => false, 'created_by' => $owner->id,
        ]);
        $card->assignees()->attach($member->id);

        $this->actingAs($member)->getJson('/api/my/home/projects')
            ->assertOk()->assertJsonCount(1, 'projects');
        $this->getJson('/api/my/tasks')->assertOk()->assertJsonCount(1, 'tasks');
        $this->getJson("/api/workspaces/{$workspace->id}/overview")
            ->assertOk()->assertJsonPath('stats.projects', 1);

        $role = WorkspaceCustomRole::create([
            'workspace_id' => $workspace->id, 'scope' => 'project',
            'name' => 'Sin visualización', 'permissions' => ['cards.comment'], 'enabled' => true,
        ]);
        $membership->update(['role' => 'lector', 'custom_role_id' => $role->id]);

        $this->getJson('/api/my/home/projects')
            ->assertOk()->assertJsonCount(0, 'projects');
        $this->getJson('/api/my/tasks')
            ->assertOk()->assertJsonCount(0, 'tasks')->assertJsonCount(0, 'scopes');
        $this->getJson("/api/workspaces/{$workspace->id}/overview")
            ->assertOk()->assertJsonPath('stats.projects', 0)->assertJsonCount(0, 'dashboard.projects');
    }

    public function test_revoking_client_project_access_removes_it_from_all_global_views(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $client = User::factory()->create(['is_admin' => false, 'email_verified_at' => now()]);
        $workspace = Workspace::create([
            'name' => 'Agencia', 'owner_id' => $owner->id, 'show_clients' => true,
        ]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Empresa']);
        $workspace->memberships()->create([
            'user_id' => $client->id, 'role' => 'client', 'client_company_id' => $company->id,
        ]);
        $project = Project::create([
            'workspace_id' => $workspace->id, 'name' => 'Compartido',
            'client_company_id' => $company->id, 'client_access_enabled' => true,
        ]);
        ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $client->id, 'role' => 'cliente',
        ]);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Tablero']);
        $board->createDefaultColumns();
        $card = Card::create([
            'board_id' => $board->id, 'column_id' => $board->columns()->firstOrFail()->id,
            'title' => 'Pública', 'is_internal' => false, 'created_by' => $owner->id,
        ]);
        $card->assignees()->attach($client->id);

        $this->actingAs($client)->getJson('/api/my/home/projects')
            ->assertOk()->assertJsonCount(1, 'projects');
        $this->getJson('/api/my/tasks')->assertOk()->assertJsonCount(1, 'tasks');
        $this->getJson("/api/workspaces/{$workspace->id}/overview")
            ->assertOk()->assertJsonPath('stats.projects', 1);

        $project->update(['client_access_enabled' => false]);

        $this->getJson('/api/my/home/projects')->assertOk()->assertJsonCount(0, 'projects');
        $this->getJson('/api/my/tasks')
            ->assertOk()->assertJsonCount(0, 'tasks')->assertJsonCount(0, 'scopes');
        $this->getJson("/api/workspaces/{$workspace->id}/overview")
            ->assertOk()->assertJsonPath('stats.projects', 0)->assertJsonCount(0, 'dashboard.projects');
    }

    public function test_owner_remains_able_to_view_owned_projects_without_member_row(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Propio']);

        $this->actingAs($owner)->getJson('/api/my/home/projects')
            ->assertOk()->assertJsonPath('projects.0.id', $project->id);
    }
}
