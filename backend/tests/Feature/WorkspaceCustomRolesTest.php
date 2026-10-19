<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceCustomRole;
use App\Support\ProjectAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceCustomRolesTest extends TestCase
{
    use RefreshDatabase;

    private function setupWorkspace(): array
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::create(['name' => 'Empresa', 'owner_id' => $owner->id]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        return [$owner, $workspace];
    }

    public function test_owner_can_manage_custom_roles_but_unrelated_users_cannot(): void
    {
        [$owner, $workspace] = $this->setupWorkspace();
        $other = User::factory()->create(['is_admin' => false]);
        $url = "/api/workspaces/{$workspace->id}/roles";
        $this->actingAs($other)->getJson($url)->assertForbidden();
        $this->actingAs($other)->postJson($url, [
            'scope' => 'project', 'name' => 'Coordinador',
            'permissions' => ['project.view', 'cards.edit'],
        ])->assertForbidden();

        $this->actingAs($owner)->postJson($url, [
            'scope' => 'project', 'name' => 'Coordinador',
            'permissions' => ['project.view', 'cards.edit'],
        ])->assertCreated()->assertJsonPath('name', 'Coordinador');
        $this->getJson($url)->assertOk()->assertJsonCount(1, 'roles');
    }

    public function test_custom_role_is_workspace_scoped_and_cannot_gain_foreign_permissions(): void
    {
        [$owner, $workspace] = $this->setupWorkspace();
        $url = "/api/workspaces/{$workspace->id}/roles";
        $this->actingAs($owner)->postJson($url, [
            'scope' => 'project', 'name' => 'Externo',
            'permissions' => ['project.view', 'workspace.manage'],
        ])->assertUnprocessable();
        $role = WorkspaceCustomRole::create([
            'workspace_id' => $workspace->id, 'scope' => 'project',
            'name' => 'Lector interno', 'permissions' => ['project.view'],
        ]);
        [$otherOwner, $otherWorkspace] = $this->setupWorkspace();
        $this->actingAs($otherOwner)->patchJson("/api/workspaces/{$otherWorkspace->id}/roles/{$role->id}", [
            'name' => 'Cambiado', 'permissions' => ['project.view'],
        ])->assertNotFound();
        $this->assertSame('Lector interno', $role->fresh()->name);
    }

    public function test_member_permissions_follow_custom_role_and_role_cannot_be_deleted_while_used(): void
    {
        [$owner, $workspace] = $this->setupWorkspace();
        $member = User::factory()->create(['is_admin' => false]);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Tareas']);
        $role = WorkspaceCustomRole::create([
            'workspace_id' => $workspace->id, 'scope' => 'project',
            'name' => 'Editor limitado', 'permissions' => ['project.view', 'cards.comment'],
        ]);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $member->id,
            'role' => 'lector', 'custom_role_id' => $role->id]);
        $this->assertTrue(ProjectAccess::canView($member, $project));
        $this->assertTrue(ProjectAccess::canComment($member, $project));
        $this->assertFalse(ProjectAccess::canEditCards($member, $project));
        $role->update(['permissions' => ['project.view', 'cards.edit']]);
        $this->assertTrue(ProjectAccess::canEditCards($member, $project));
        $this->assertFalse(ProjectAccess::canComment($member, $project));
        $this->actingAs($owner)->deleteJson("/api/workspaces/{$workspace->id}/roles/{$role->id}")
            ->assertUnprocessable();
    }
}
