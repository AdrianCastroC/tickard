<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectPendingInvitationRevocationTest extends TestCase
{
    use RefreshDatabase;

    public function test_removing_project_member_revokes_earlier_pending_project_invitation(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $recipient = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $workspace->memberships()->create(['user_id' => $recipient->id, 'role' => 'member']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Proyecto']);

        $id = $this->actingAs($owner)->postJson("/api/projects/{$project->id}/invitations", [
            'recipients' => [$recipient->email], 'role' => 'editor',
        ])->assertCreated()->json('created.0.id');

        ProjectMember::create(['project_id' => $project->id, 'user_id' => $recipient->id, 'role' => 'lector']);

        $this->deleteJson("/api/projects/{$project->id}/personnel/members/{$recipient->id}")
            ->assertNoContent();
        $this->assertDatabaseHas('workspace_invitations', [
            'id' => $id, 'status' => 'pending',
        ]);
        $this->assertNotNull(\Illuminate\Support\Facades\DB::table('workspace_invitations')
            ->where('id', $id)->value('revoked_at'));

        $this->actingAs($recipient)->postJson("/api/my/invitations/{$id}/respond", [
            'action' => 'accept',
        ])->assertStatus(409);
        $this->assertDatabaseMissing('project_members', [
            'project_id' => $project->id, 'user_id' => $recipient->id,
        ]);

        // Revocation is scoped to this project: new valid invitations remain possible.
        $newId = $this->actingAs($owner)->postJson("/api/projects/{$project->id}/invitations", [
            'recipients' => [$recipient->email], 'role' => 'lector',
        ])->assertCreated()->json('created.0.id');
        $this->assertNotEquals($id, $newId);
        $this->actingAs($recipient)->postJson("/api/my/invitations/{$newId}/respond", [
            'action' => 'accept',
        ])->assertOk();
    }
}
