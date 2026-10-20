<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvitationInviterAuthoritySecurityTest extends TestCase
{
    use RefreshDatabase;

    private function projectFixture(): array
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $manager = User::factory()->create(['is_admin' => false]);
        $recipient = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        foreach ([$manager, $recipient] as $user) {
            $workspace->memberships()->create(['user_id' => $user->id, 'role' => 'member']);
        }
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Equipo']);
        ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $manager->id, 'role' => 'responsable',
        ]);

        return [$owner, $manager, $recipient, $workspace, $project];
    }

    public function test_removed_inviter_cannot_grant_project_membership_through_pending_invitation(): void
    {
        [$owner, $manager, $recipient, $workspace, $project] = $this->projectFixture();
        $id = $this->actingAs($manager)->postJson("/api/projects/{$project->id}/invitations", [
            'recipients' => [$recipient->email], 'role' => 'editor',
        ])->assertCreated()->json('created.0.id');

        $this->actingAs($owner)->deleteJson("/api/workspaces/{$workspace->id}/members/{$manager->id}")
            ->assertNoContent();

        $this->actingAs($recipient)
            ->postJson("/api/my/invitations/{$id}/respond", ['action' => 'accept'])
            ->assertStatus(409);

        $this->assertDatabaseMissing('project_members', [
            'project_id' => $project->id, 'user_id' => $recipient->id,
        ]);
    }

    public function test_demoted_inviter_cannot_grant_project_membership(): void
    {
        [$owner, $manager, $recipient, $workspace, $project] = $this->projectFixture();
        $id = $this->actingAs($manager)->postJson("/api/projects/{$project->id}/invitations", [
            'recipients' => [$recipient->email], 'role' => 'editor',
        ])->assertCreated()->json('created.0.id');

        $project->members()->where('user_id', $manager->id)->firstOrFail()
            ->update(['role' => 'lector']);

        $this->actingAs($recipient)
            ->postJson("/api/my/invitations/{$id}/respond", ['action' => 'accept'])
            ->assertStatus(409);

        $this->assertDatabaseMissing('project_members', [
            'project_id' => $project->id, 'user_id' => $recipient->id,
        ]);
    }

    public function test_owner_and_active_manager_invitations_remain_valid(): void
    {
        [$owner, $manager, $recipient, $workspace, $project] = $this->projectFixture();
        $id = $this->actingAs($manager)->postJson("/api/projects/{$project->id}/invitations", [
            'recipients' => [$recipient->email], 'role' => 'editor',
        ])->assertCreated()->json('created.0.id');

        $this->actingAs($recipient)
            ->postJson("/api/my/invitations/{$id}/respond", ['action' => 'accept'])
            ->assertOk();

        // Use a separate Workspace so the Free-plan member cap remains respected.
        $ownerWorkspace = Workspace::createInitialFor($owner);
        $ownerProject = Project::create([
            'workspace_id' => $ownerWorkspace->id, 'name' => 'Segundo proyecto',
        ]);
        $external = User::factory()->create(['is_admin' => false]);
        $ownerId = $this->actingAs($owner)->postJson("/api/projects/{$ownerProject->id}/invitations", [
            'recipients' => [$external->email], 'role' => 'lector',
        ])->assertCreated()->json('created.0.id');

        $this->actingAs($external)
            ->postJson("/api/my/invitations/{$ownerId}/respond", ['action' => 'accept'])
            ->assertOk();

        $this->assertDatabaseHas('project_members', [
            'project_id' => $ownerProject->id, 'user_id' => $external->id, 'role' => 'lector',
        ]);
    }
}
