<?php

namespace Tests\Feature;

use App\Models\ClientCompany;
use App\Models\Department;
use App\Models\Project;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceTeamsClientsTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $member = User::factory()->create(['is_admin' => false]);
        $outsider = User::factory()->create(['is_admin' => false]);
        $client = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::create(['name' => 'Agencia', 'owner_id' => $owner->id]);
        foreach ([$owner, $member, $client] as $user) {
            $workspace->memberships()->create(['user_id' => $user->id,
                'role' => $user->id === $owner->id ? 'owner' : 'member']);
        }
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Cliente externo']);
        $client->update(['client_company_id' => $company->id]);
        return compact('workspace', 'owner', 'member', 'outsider', 'client', 'company');
    }

    public function test_owner_manages_teams_and_internal_members_with_avatars(): void
    {
        extract($this->fixture());
        $created = $this->actingAs($owner)->postJson('/api/teams', [
            'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
            'member_ids' => [$owner->id, $member->id], 'lead_user_id' => $owner->id,
        ])->assertCreated()->json('id');
        $this->getJson('/api/teams?workspace_id='.$workspace->id)->assertOk()
            ->assertJsonPath('can_manage', true)
            ->assertJsonPath('teams.0.name', 'Desarrollo')
            ->assertJsonPath('teams.0.projects_count', 0)
            ->assertJsonPath('teams.0.cards_count', 0);

        $this->patchJson('/api/teams/'.$created, [
            'workspace_id' => $workspace->id, 'name' => 'Producto',
            'member_ids' => [$owner->id], 'lead_user_id' => $owner->id,
        ])->assertNoContent();
        $this->assertSame([$owner->id], Team::findOrFail($created)->members()->pluck('users.id')->all());

        $this->postJson('/api/teams', [
            'workspace_id' => $workspace->id, 'name' => 'Producto',
        ])->assertUnprocessable()->assertJsonValidationErrors('name');

        $this->deleteJson('/api/teams/'.$created, ['workspace_id' => $workspace->id])
            ->assertNoContent();
        $this->assertDatabaseMissing('teams', ['id' => $created]);
        $this->assertDatabaseHas('workspace_members', ['workspace_id' => $workspace->id, 'user_id' => $owner->id]);
    }

    public function test_members_may_view_but_only_workspace_managers_may_write(): void
    {
        extract($this->fixture());
        $team = Team::create(['workspace_id' => $workspace->id, 'name' => 'Equipo']);
        $this->actingAs($member)->getJson('/api/teams?workspace_id='.$workspace->id)
            ->assertOk()->assertJsonPath('can_manage', false);
        $this->postJson('/api/teams', ['workspace_id' => $workspace->id, 'name' => 'No'])
            ->assertForbidden();
        $this->patchJson('/api/teams/'.$team->id, ['workspace_id' => $workspace->id, 'name' => 'No'])
            ->assertForbidden();
        $this->deleteJson('/api/teams/'.$team->id, ['workspace_id' => $workspace->id])
            ->assertForbidden();
        $this->getJson('/api/clients?workspace_id='.$workspace->id)
            ->assertOk()->assertJsonPath('can_manage', false);
        $this->postJson('/api/clients', ['workspace_id' => $workspace->id, 'name' => 'No'])
            ->assertForbidden();
    }

    public function test_other_workspace_people_and_external_clients_are_excluded(): void
    {
        extract($this->fixture());
        $this->actingAs($outsider)->getJson('/api/teams?workspace_id='.$workspace->id)->assertForbidden();
        $this->getJson('/api/clients?workspace_id='.$workspace->id)->assertForbidden();
        $this->actingAs($client)->getJson('/api/teams?workspace_id='.$workspace->id)->assertForbidden();
        $this->getJson('/api/clients?workspace_id='.$workspace->id)->assertForbidden();
        $this->actingAs($owner)->postJson('/api/teams', [
            'workspace_id' => $workspace->id, 'name' => 'Invalido',
            'member_ids' => [$outsider->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('member_ids');
        $this->postJson('/api/teams', [
            'workspace_id' => $workspace->id, 'name' => 'Invalido',
            'member_ids' => [$client->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('member_ids');
    }

    public function test_teams_dashboard_has_real_status_description_icons_members_departments_and_projects(): void
    {
        extract($this->fixture());
        $department = Department::create(['workspace_id' => $workspace->id, 'name' => 'Desarrollo']);
        $project = Project::create(['workspace_id' => $workspace->id,
            'client_company_id' => $company->id, 'name' => 'Portal']);

        $created = $this->actingAs($owner)->postJson('/api/teams', [
            'workspace_id' => $workspace->id, 'name' => 'Frontend',
            'description' => 'Interfaces de usuario', 'status' => 'active', 'icon' => 'code',
            'member_ids' => [$owner->id, $member->id], 'lead_user_id' => $owner->id,
            'department_ids' => [$department->id], 'project_ids' => [$project->id],
        ])->assertCreated()->json('id');

        $this->assertDatabaseHas('department_team', [
            'department_id' => $department->id, 'team_id' => $created,
        ]);
        $this->assertDatabaseHas('project_team', [
            'project_id' => $project->id, 'team_id' => $created,
        ]);
        $this->getJson('/api/teams?workspace_id='.$workspace->id)->assertOk()
            ->assertJsonPath('teams.0.name', 'Frontend')
            ->assertJsonPath('teams.0.description', 'Interfaces de usuario')
            ->assertJsonPath('teams.0.status', 'active')
            ->assertJsonPath('teams.0.icon', 'code')
            ->assertJsonPath('teams.0.departments.0.name', 'Desarrollo')
            ->assertJsonPath('teams.0.projects.0.name', 'Portal')
            ->assertJsonPath('teams.0.projects_count', 1)
            ->assertJsonStructure(['teams' => [['members', 'created_at', 'updated_at']]]);

        $this->patchJson('/api/teams/'.$created, [
            'workspace_id' => $workspace->id, 'name' => 'Frontend',
            'description' => 'Renovado', 'status' => 'inactive', 'icon' => 'palette',
            'member_ids' => [$owner->id], 'lead_user_id' => $owner->id,
            'department_ids' => [], 'project_ids' => [],
        ])->assertNoContent();
        $this->assertDatabaseHas('teams', [
            'id' => $created, 'description' => 'Renovado', 'status' => 'inactive', 'icon' => 'palette',
        ]);
        $this->assertDatabaseMissing('department_team', ['team_id' => $created]);
        $this->assertDatabaseMissing('project_team', ['team_id' => $created]);
        $this->assertDatabaseHas('projects', ['id' => $project->id]);
        $this->assertDatabaseHas('departments', ['id' => $department->id]);
    }

    public function test_team_cannot_reference_departments_or_projects_from_other_workspaces(): void
    {
        extract($this->fixture());
        $outsideWorkspace = Workspace::create(['name' => 'Otra agencia', 'owner_id' => $outsider->id]);
        $outsideWorkspace->memberships()->create(['user_id' => $outsider->id, 'role' => 'owner']);
        $department = Department::create(['workspace_id' => $outsideWorkspace->id, 'name' => 'Privado']);
        $outsideCompany = ClientCompany::create(['workspace_id' => $outsideWorkspace->id, 'name' => 'Otro cliente']);
        $outsideProject = Project::create(['workspace_id' => $outsideWorkspace->id,
            'client_company_id' => $outsideCompany->id, 'name' => 'Confidencial']);

        $this->actingAs($owner)->postJson('/api/teams', [
            'workspace_id' => $workspace->id, 'name' => 'Prueba',
            'department_ids' => [$department->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('department_ids');

        $this->postJson('/api/teams', [
            'workspace_id' => $workspace->id, 'name' => 'Prueba',
            'project_ids' => [$outsideProject->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('project_ids');

        $this->postJson('/api/teams', [
            'workspace_id' => $workspace->id, 'name' => 'Prueba',
            'status' => 'unknown', 'icon' => 'not-an-icon',
        ])->assertUnprocessable()->assertJsonValidationErrors(['status', 'icon']);
    }

    public function test_client_crud_is_workspace_scoped_and_cannot_delete_used_company(): void
    {
        extract($this->fixture());
        // Existing client fixtures can be created by seeders; HTTP creation must use an invitation.
        $created = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Nuevo cliente'])->id;
        $this->actingAs($owner);
        $this->getJson('/api/clients?workspace_id='.$workspace->id)
            ->assertOk()->assertJsonPath('can_manage', true);
        $this->patchJson('/api/clients/'.$created, [
            'workspace_id' => $workspace->id, 'name' => 'Cliente renombrado',
        ])->assertNoContent();
        $this->assertDatabaseHas('client_companies', ['id' => $created, 'name' => 'Cliente renombrado']);

        $this->postJson('/api/clients', [
            'workspace_id' => $workspace->id, 'name' => 'Cliente renombrado',
        ])->assertUnprocessable()->assertJsonValidationErrors('name');

        Project::create(['workspace_id' => $workspace->id,
            'client_company_id' => $created, 'name' => 'Proyecto activo']);
        $this->deleteJson('/api/clients/'.$created, ['workspace_id' => $workspace->id])
            ->assertUnprocessable()->assertJsonValidationErrors('client');
        $this->deleteJson('/api/clients/'.$company->id, ['workspace_id' => $workspace->id])
            ->assertUnprocessable()->assertJsonValidationErrors('client');

        $empty = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Sin asignaciones'])->id;
        $this->deleteJson('/api/clients/'.$empty, ['workspace_id' => $workspace->id])
            ->assertNoContent();
        $this->assertDatabaseMissing('client_companies', ['id' => $empty]);
    }

    public function test_cross_workspace_updates_cannot_modify_other_teams_or_clients(): void
    {
        extract($this->fixture());
        $otherOwner = User::factory()->create(['is_admin' => false]);
        $otherWorkspace = Workspace::create(['name' => 'Otra', 'owner_id' => $otherOwner->id]);
        $otherWorkspace->memberships()->create(['user_id' => $otherOwner->id, 'role' => 'owner']);
        $team = Team::create(['workspace_id' => $otherWorkspace->id, 'name' => 'Confidencial']);
        $otherClient = ClientCompany::create(['workspace_id' => $otherWorkspace->id, 'name' => 'Privado']);
        $this->actingAs($owner)->patchJson('/api/teams/'.$team->id, [
            'workspace_id' => $workspace->id, 'name' => 'Hack',
        ])->assertNotFound();
        $this->deleteJson('/api/teams/'.$team->id, ['workspace_id' => $workspace->id])->assertNotFound();
        $this->patchJson('/api/clients/'.$otherClient->id, [
            'workspace_id' => $workspace->id, 'name' => 'Hack',
        ])->assertNotFound();
        $this->deleteJson('/api/clients/'.$otherClient->id, ['workspace_id' => $workspace->id])->assertNotFound();
    }
}
