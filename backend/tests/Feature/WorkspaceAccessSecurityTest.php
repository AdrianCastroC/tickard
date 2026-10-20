<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Support\ProjectAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class WorkspaceAccessSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_without_member_management_permission_cannot_edit_job_titles(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $admin = User::factory()->create(['is_admin' => false]);
        $member = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $workspace->memberships()->create(['user_id' => $admin->id, 'role' => 'admin']);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);

        DB::table('workspace_role_settings')->insert([
            'workspace_id' => $workspace->id,
            'role_key' => 'admin',
            'permissions' => json_encode(['workspace.view']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $url = "/api/workspaces/{$workspace->id}/members/{$member->id}/job-title";

        $this->actingAs($admin)->getJson("/api/workspaces/{$workspace->id}/members")
            ->assertForbidden();
        $this->patchJson($url, ['job_title' => 'Cargo no autorizado'])->assertForbidden();
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id,
            'user_id' => $member->id,
            'job_title' => null,
        ]);

        $this->actingAs($owner)->patchJson($url, ['job_title' => 'Cargo autorizado'])
            ->assertOk()->assertJsonPath('job_title', 'Cargo autorizado');
    }

    public function test_orphaned_project_membership_cannot_grant_access_after_workspace_revocation(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $member = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Proyecto privado']);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $member->id, 'role' => 'editor']);

        $this->assertTrue(ProjectAccess::canView($member, $project));
        $workspace->memberships()->where('user_id', $member->id)->delete();

        $this->assertDatabaseHas('project_members', [
            'project_id' => $project->id, 'user_id' => $member->id,
        ]);
        $this->assertNull(ProjectAccess::role($member, $project));
        $this->assertFalse(ProjectAccess::canView($member, $project));
        $this->assertFalse(ProjectAccess::canEditCards($member, $project));
        $this->actingAs($member)->getJson("/api/projects/{$project->id}/personnel")
            ->assertForbidden();
    }
}
