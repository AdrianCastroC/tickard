<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Support\ProjectAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceOwnerProjectAccessTest extends TestCase
{
    use RefreshDatabase;

    private function workspaceProject(User $owner): Project
    {
        $workspace = Workspace::create(['name' => 'Propiedad', 'owner_id' => $owner->id]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Cliente']);
        $project = Project::create(['name' => 'Proyecto', 'workspace_id' => $workspace->id,
            'client_company_id' => $client->id]);
        $project->boards()->create(['name' => 'Tablero', 'position' => 0])->createDefaultColumns();
        return $project;
    }

    public function test_owner_has_responsible_permissions_without_project_membership(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $project = $this->workspaceProject($owner);

        $this->assertFalse($project->members()->where('user_id', $owner->id)->exists());
        $this->assertTrue(ProjectAccess::isWorkspaceOwner($owner, $project));
        $this->assertSame('responsable', ProjectAccess::role($owner, $project));
        $this->assertTrue(ProjectAccess::canView($owner, $project));
        $this->assertTrue(ProjectAccess::canEditCards($owner, $project));
        $this->assertTrue(ProjectAccess::canManage($owner, $project));

        $this->actingAs($owner)->getJson("/api/projects/{$project->id}/personnel")
            ->assertOk()->assertJsonPath('can_manage', true)
            ->assertJsonPath('summary.members', 0);
    }

    public function test_project_role_cannot_downgrade_workspace_owner(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $project = $this->workspaceProject($owner);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $owner->id, 'role' => 'lector']);

        $this->assertSame('responsable', ProjectAccess::role($owner, $project));

        $this->actingAs($owner)->getJson("/api/projects/{$project->id}/personnel")
            ->assertOk()
            ->assertJsonPath('members.0.is_workspace_owner', true)
            ->assertJsonPath('members.0.role', 'responsable');
        $this->actingAs($owner)->patchJson("/api/projects/{$project->id}/personnel/members/{$owner->id}", [
            'role' => 'editor',
        ])->assertForbidden();
        $this->actingAs($owner)->deleteJson("/api/projects/{$project->id}/personnel/members/{$owner->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('project_members', [
            'project_id' => $project->id, 'user_id' => $owner->id, 'role' => 'lector',
        ]);
    }

    public function test_non_owner_without_membership_still_has_no_access(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $outsider = User::factory()->create(['is_admin' => false]);
        $project = $this->workspaceProject($owner);

        $this->assertFalse(ProjectAccess::isWorkspaceOwner($outsider, $project));
        $this->assertNull(ProjectAccess::role($outsider, $project));
        $this->actingAs($outsider)->getJson("/api/projects/{$project->id}/personnel")
            ->assertForbidden();
    }
}
