<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceInvitationExpirationSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_expired_workspace_invitation_cannot_grant_membership(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $recipient = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);

        $id = $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/invitations", [
            'recipients' => [$recipient->email],
        ])->assertCreated()->json('created.0.id');

        WorkspaceInvitation::findOrFail($id)->update(['expires_at' => now()->subMinute()]);
        $this->actingAs($recipient)->postJson("/api/my/invitations/{$id}/respond", [
            'action' => 'accept',
        ])->assertStatus(409);

        $this->assertDatabaseMissing('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $recipient->id,
        ]);
        $this->assertDatabaseHas('workspace_invitations', ['id' => $id, 'status' => 'pending']);
    }

    public function test_expired_project_invitation_cannot_grant_membership(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $recipient = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Privado']);

        $id = $this->actingAs($owner)->postJson("/api/projects/{$project->id}/invitations", [
            'recipients' => [$recipient->email], 'role' => 'editor',
        ])->assertCreated()->json('created.0.id');

        WorkspaceInvitation::findOrFail($id)->update(['expires_at' => now()->subMinute()]);
        $this->actingAs($recipient)->postJson("/api/my/invitations/{$id}/respond", [
            'action' => 'accept',
        ])->assertStatus(409);

        $this->assertDatabaseMissing('project_members', [
            'project_id' => $project->id, 'user_id' => $recipient->id,
        ]);
        $this->assertDatabaseMissing('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $recipient->id,
        ]);
    }

    public function test_valid_invitation_can_still_be_accepted(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $recipient = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);

        $id = $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/invitations", [
            'recipients' => [$recipient->email],
        ])->assertCreated()->json('created.0.id');

        $this->actingAs($recipient)->postJson("/api/my/invitations/{$id}/respond", [
            'action' => 'accept',
        ])->assertOk()->assertJsonPath('status', 'accepted');
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $recipient->id,
        ]);
    }
}
