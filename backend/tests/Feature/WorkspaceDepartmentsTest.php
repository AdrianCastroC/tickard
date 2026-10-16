<?php

namespace Tests\Feature;

use App\Models\ClientCompany;
use App\Models\Department;
use App\Models\Team;
use App\Models\Project;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceDepartmentsTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $member = User::factory()->create(['is_admin' => false]);
        $other = User::factory()->create(['is_admin' => false]);
        $client = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::create(['name' => 'Empresa', 'owner_id' => $owner->id]);
        foreach ([$owner, $member, $client] as $person) {
            $workspace->memberships()->create([
                'user_id' => $person->id,
                'role' => $person->id === $owner->id ? 'owner' : 'member',
            ]);
        }
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Cliente externo']);
        $client->update(['client_company_id' => $company->id]);
        return compact('owner', 'member', 'other', 'client', 'workspace');
    }

    public function test_owner_can_create_and_update_departments_and_lead(): void
    {
        extract($this->fixture());
        $post = $this->actingAs($owner)->postJson('/api/departments', [
            'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
            'member_ids' => [$owner->id, $member->id], 'lead_user_id' => $member->id,
        ]);
        $post->assertCreated();
        $id = $post->json('id');
        $this->assertDatabaseHas('departments', [
            'id' => $id, 'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
            'lead_user_id' => $member->id,
        ]);

        $this->getJson('/api/departments?workspace_id='.$workspace->id)->assertOk()
            ->assertJsonPath('can_manage', true)
            ->assertJsonPath('departments.0.members.0.avatar_url', null)
            ->assertJsonPath('departments.0.lead_user_id', $member->id);

        $this->patchJson('/api/departments/'.$id, [
            'workspace_id' => $workspace->id, 'name' => 'Producto',
            'member_ids' => [$owner->id], 'lead_user_id' => $owner->id,
        ])->assertNoContent();
        $this->assertDatabaseHas('departments', ['id' => $id, 'name' => 'Producto', 'lead_user_id' => $owner->id]);
        $this->assertSame([$owner->id], Department::findOrFail($id)->members()->pluck('users.id')->all());

        $this->deleteJson('/api/departments/'.$id, ['workspace_id' => $workspace->id])
            ->assertNoContent();
        $this->assertDatabaseMissing('departments', ['id' => $id]);
        $this->assertDatabaseHas('workspace_members', ['workspace_id' => $workspace->id, 'user_id' => $member->id]);
    }

    public function test_workspace_member_can_view_but_cannot_modify_departments(): void
    {
        extract($this->fixture());
        $department = Department::create(['workspace_id' => $workspace->id, 'name' => 'Soporte']);
        $this->actingAs($member)->getJson('/api/departments?workspace_id='.$workspace->id)
            ->assertOk()->assertJsonPath('can_manage', false);
        $this->postJson('/api/departments', [
            'workspace_id' => $workspace->id, 'name' => 'No permitido',
        ])->assertForbidden();
        $this->patchJson('/api/departments/'.$department->id, [
            'workspace_id' => $workspace->id, 'name' => 'No permitido',
        ])->assertForbidden();
        $this->deleteJson('/api/departments/'.$department->id, [
            'workspace_id' => $workspace->id,
        ])->assertForbidden();
    }

    public function test_outsiders_and_clients_are_excluded(): void
    {
        extract($this->fixture());
        $this->actingAs($other)->getJson('/api/departments?workspace_id='.$workspace->id)->assertForbidden();
        $this->actingAs($client)->getJson('/api/departments?workspace_id='.$workspace->id)->assertForbidden();

        $this->actingAs($owner)->postJson('/api/departments', [
            'workspace_id' => $workspace->id, 'name' => 'Soporte',
            'member_ids' => [$other->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('member_ids');
        $this->postJson('/api/departments', [
            'workspace_id' => $workspace->id, 'name' => 'Soporte',
            'member_ids' => [$client->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('member_ids');
    }

    public function test_department_panel_has_real_descriptions_status_members_teams_projects_and_timestamps(): void
    {
        extract($this->fixture());
        $team = Team::create(['workspace_id' => $workspace->id, 'name' => 'Frontend']);
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Interno']);
        $project = Project::create(['workspace_id' => $workspace->id,
            'client_company_id' => $company->id, 'name' => 'Web corporativa']);

        $id = $this->actingAs($owner)->postJson('/api/departments', [
            'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
            'description' => 'Aplicaciones y sitios web',
            'status' => 'active', 'icon' => 'code',
            'member_ids' => [$owner->id, $member->id], 'lead_user_id' => $member->id,
            'team_ids' => [$team->id], 'project_ids' => [$project->id],
        ])->assertCreated()->json('id');

        $this->assertDatabaseHas('department_team', ['department_id' => $id, 'team_id' => $team->id]);
        $this->assertDatabaseHas('department_project', ['department_id' => $id, 'project_id' => $project->id]);

        $this->getJson('/api/departments?workspace_id='.$workspace->id)->assertOk()
            ->assertJsonPath('departments.0.description', 'Aplicaciones y sitios web')
            ->assertJsonPath('departments.0.icon', 'code')
            ->assertJsonPath('departments.0.status', 'active')
            ->assertJsonPath('departments.0.teams.0.name', 'Frontend')
            ->assertJsonPath('departments.0.projects.0.name', 'Web corporativa')
            ->assertJsonPath('departments.0.lead_user_id', $member->id)
            ->assertJsonStructure(['departments' => [['created_at', 'updated_at', 'members']]]);

        $this->patchJson('/api/departments/'.$id, [
            'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
            'description' => 'Renovado', 'status' => 'inactive', 'icon' => 'palette',
            'member_ids' => [$owner->id], 'lead_user_id' => $owner->id,
            'team_ids' => [], 'project_ids' => [],
        ])->assertNoContent();
        $this->assertDatabaseHas('departments', ['id' => $id, 'description' => 'Renovado',
            'status' => 'inactive', 'icon' => 'palette', 'lead_user_id' => null]);
        $this->assertDatabaseMissing('department_team', ['department_id' => $id, 'team_id' => $team->id]);
        $this->assertDatabaseMissing('department_project', ['department_id' => $id, 'project_id' => $project->id]);
        $this->assertDatabaseHas('projects', ['id' => $project->id]);
        $this->assertDatabaseHas('teams', ['id' => $team->id]);
    }

    public function test_cross_workspace_teams_and_projects_cannot_be_attached_to_departments(): void
    {
        extract($this->fixture());
        $otherWorkspace = Workspace::create(['name' => 'Otra', 'owner_id' => $other->id]);
        $otherWorkspace->memberships()->create(['user_id' => $other->id, 'role' => 'owner']);
        $otherTeam = Team::create(['workspace_id' => $otherWorkspace->id, 'name' => 'Confidencial']);
        $client = ClientCompany::create(['workspace_id' => $otherWorkspace->id, 'name' => 'Otra empresa']);
        $otherProject = Project::create(['workspace_id' => $otherWorkspace->id,
            'client_company_id' => $client->id, 'name' => 'Secreto']);

        $this->actingAs($owner)->postJson('/api/departments', [
            'workspace_id' => $workspace->id, 'name' => 'Prueba',
            'team_ids' => [$otherTeam->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('team_ids');

        $this->postJson('/api/departments', [
            'workspace_id' => $workspace->id, 'name' => 'Prueba',
            'project_ids' => [$otherProject->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('project_ids');

        $this->postJson('/api/departments', [
            'workspace_id' => $workspace->id, 'name' => 'Prueba',
            'status' => 'unknown', 'icon' => 'javascript:alert(1)',
        ])->assertUnprocessable()->assertJsonValidationErrors(['status', 'icon']);
    }

    public function test_lead_must_belong_to_department_and_names_are_unique_per_workspace(): void
    {
        extract($this->fixture());
        $this->actingAs($owner)->postJson('/api/departments', [
            'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
            'member_ids' => [$owner->id], 'lead_user_id' => $member->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('lead_user_id');

        Department::create(['workspace_id' => $workspace->id, 'name' => 'Desarrollo']);
        $this->postJson('/api/departments', [
            'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
            'member_ids' => [$owner->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('name');
    }
}
