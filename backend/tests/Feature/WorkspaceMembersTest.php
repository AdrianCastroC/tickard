<?php

namespace Tests\Feature;

use App\Models\ClientCompany;
use App\Models\Department;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceMembersTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $admin = User::factory()->create(['is_admin' => false]);
        $member = User::factory()->create(['is_admin' => false]);
        $client = User::factory()->create(['is_admin' => false]);
        $outside = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);

        $workspace->memberships()->create(['user_id' => $admin->id, 'role' => 'admin']);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Empresa cliente']);
        $workspace->memberships()->create([
            'user_id' => $client->id, 'role' => 'client', 'client_company_id' => $company->id,
        ]);

        return compact('owner', 'admin', 'member', 'client', 'outside', 'workspace', 'company');
    }

    public function test_owner_and_workspace_admin_can_view_roster_but_regular_member_cannot(): void
    {
        extract($this->fixture());
        $url = "/api/workspaces/{$workspace->id}/members";

        $this->actingAs($owner)->getJson($url)
            ->assertOk()->assertJsonPath('can_manage_roles', true)
            ->assertJsonCount(4, 'members')->assertJsonPath('member_count', 4);
        $this->actingAs($admin)->getJson($url)
            ->assertOk()->assertJsonPath('can_manage_roles', false)
            ->assertJsonCount(4, 'members');
        $this->actingAs($member)->getJson($url)->assertForbidden();
        $this->actingAs($outside)->getJson($url)->assertForbidden();
    }

    public function test_owner_can_change_membership_role_without_changing_project_permissions(): void
    {
        extract($this->fixture());
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Proyecto']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $member->id, 'role' => 'lector']);

        $url = "/api/workspaces/{$workspace->id}/members/{$member->id}/role";
        $this->actingAs($owner)->patchJson($url, ['role' => 'admin'])
            ->assertOk()->assertJsonPath('role', 'admin');
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $member->id, 'role' => 'admin',
        ]);
        $this->assertDatabaseHas('project_members', [
            'project_id' => $project->id, 'user_id' => $member->id, 'role' => 'lector',
        ]);
        $this->actingAs($owner)->patchJson($url, ['role' => 'member'])->assertOk();
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $member->id, 'role' => 'member',
        ]);
    }

    public function test_owner_and_client_roles_are_protected_and_admin_cannot_promote(): void
    {
        extract($this->fixture());
        $url = "/api/workspaces/{$workspace->id}/members/";

        $this->actingAs($owner)->patchJson($url.$owner->id.'/role', ['role' => 'member'])
            ->assertUnprocessable();
        $this->patchJson($url.$client->id.'/role', ['role' => 'admin'])->assertUnprocessable();
        $this->patchJson($url.$member->id.'/role', ['role' => 'owner'])
            ->assertUnprocessable()->assertJsonValidationErrors('role');
        $this->actingAs($admin)->patchJson($url.$member->id.'/role', ['role' => 'admin'])
            ->assertForbidden();
        $this->actingAs($outside)->patchJson($url.$member->id.'/role', ['role' => 'admin'])
            ->assertForbidden();

        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $client->id, 'role' => 'client',
        ]);
        $this->assertDatabaseHas('workspaces', ['id' => $workspace->id, 'owner_id' => $owner->id]);
    }

    public function test_cross_workspace_account_cannot_be_promoted_and_roster_is_scoped(): void
    {
        extract($this->fixture());
        $url = "/api/workspaces/{$workspace->id}/members/";
        $this->actingAs($owner)->patchJson($url.$outside->id.'/role', ['role' => 'admin'])
            ->assertNotFound();
        $this->actingAs($outside)->getJson('/api/workspaces/'.$workspace->id.'/members')
            ->assertForbidden();
    }

    public function test_roster_lists_only_links_from_current_workspace(): void
    {
        extract($this->fixture());
        $department = Department::create([
            'workspace_id' => $workspace->id, 'name' => 'Desarrollo', 'lead_user_id' => $member->id,
        ]);
        $department->members()->attach($member->id);
        $team = Team::create(['workspace_id' => $workspace->id, 'name' => 'Frontend', 'lead_user_id' => $member->id]);
        $team->members()->attach($member->id);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Portal']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $member->id, 'role' => 'editor']);

        $result = $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/members")
            ->assertOk()->json('members');
        $person = collect($result)->firstWhere('id', $member->id);

        $this->assertSame('Desarrollo', $person['departments'][0]['name']);
        $this->assertTrue($person['departments'][0]['is_lead']);
        $this->assertSame('Frontend', $person['teams'][0]['name']);
        $this->assertTrue($person['teams'][0]['is_lead']);
        $this->assertSame('Portal', $person['projects'][0]['name']);
        $this->assertSame('editor', $person['projects'][0]['role']);
        $this->assertSame($member->email, $person['email']);
        $this->assertArrayHasKey('professional_phone', $person);
        $this->assertArrayHasKey('joined_at', $person);
        $clientMember = collect($result)->firstWhere('id', $client->id);
        $this->assertSame('client', $clientMember['role']);
        $this->assertTrue($clientMember['is_client']);
    }
    public function test_owner_and_admin_can_update_a_workspaces_job_title_without_affecting_other_workspaces(): void
    {
        extract($this->fixture());
        $url = "/api/workspaces/{$workspace->id}/members/{$member->id}/job-title";

        $this->actingAs($owner)->patchJson($url, ['job_title' => 'Programador junior'])
            ->assertOk()->assertJsonPath('job_title', 'Programador junior');
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $member->id,
            'job_title' => 'Programador junior',
        ]);

        $this->actingAs($admin)->patchJson($url, ['job_title' => 'Programador backend'])
            ->assertOk()->assertJsonPath('job_title', 'Programador backend');

        $secondOwner = User::factory()->create(['is_admin' => false]);
        $otherWorkspace = Workspace::createInitialFor($secondOwner);
        $otherWorkspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $otherWorkspace->id, 'user_id' => $member->id,
            'job_title' => null,
        ]);

        $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/members")
            ->assertOk()->assertJsonPath('can_manage_jobs', true);
        $this->actingAs($admin)->getJson("/api/workspaces/{$workspace->id}/members")
            ->assertOk()->assertJsonPath('can_manage_jobs', true);
        $this->actingAs($secondOwner)->getJson("/api/workspaces/{$otherWorkspace->id}/members")
            ->assertOk()->assertJsonPath('can_manage_jobs', true);
        $this->actingAs($owner)->patchJson($url, ['job_title' => null])
            ->assertOk()->assertJsonPath('job_title', null);
    }

    public function test_job_title_changes_are_scoped_validated_and_cannot_modify_clients(): void
    {
        extract($this->fixture());
        $base = "/api/workspaces/{$workspace->id}/members/";

        $this->actingAs($member)->patchJson($base.$admin->id.'/job-title', [
            'job_title' => 'Director',
        ])->assertForbidden();
        $this->actingAs($outside)->patchJson($base.$member->id.'/job-title', [
            'job_title' => 'Consultor',
        ])->assertForbidden();

        $this->actingAs($owner)->patchJson($base.$outside->id.'/job-title', [
            'job_title' => 'Consultor',
        ])->assertNotFound();
        $this->patchJson($base.$client->id.'/job-title', [
            'job_title' => 'Gestor',
        ])->assertUnprocessable();
        $this->patchJson($base.$member->id.'/job-title', [
            'job_title' => str_repeat('a', 121),
        ])->assertUnprocessable()->assertJsonValidationErrors('job_title');
        $this->patchJson($base.$member->id.'/job-title', [
            'job_title' => ['invalid'],
        ])->assertUnprocessable()->assertJsonValidationErrors('job_title');

        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $member->id, 'job_title' => null,
        ]);
    }

}
