<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class InvitationLifecycleSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_regular_workspace_invites_have_short_lifetime_and_legacy_stale_invites_cannot_be_used(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $recipient = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $url = "/api/workspaces/{$workspace->id}/invitations";

        $old = $this->actingAs($owner)->postJson($url, [
            'recipients' => [$recipient->email],
        ])->assertCreated()->json('created.0.id');

        $invitation = WorkspaceInvitation::findOrFail($old);
        $this->assertTrue($invitation->expires_at->betweenIncluded(
            now()->addDays(29), now()->addDays(31)
        ));

        // An existing old invitation from the previous 50-year lifetime
        // is not usable or allowed to block a fresh invitation.
        DB::table('workspace_invitations')->where('id', $old)->update([
            'created_at' => now()->subDays(31),
            'expires_at' => now()->addYears(40),
        ]);

        $this->actingAs($recipient)->postJson("/api/my/invitations/{$old}/respond", [
            'action' => 'accept',
        ])->assertStatus(409);
        $this->assertDatabaseMissing('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $recipient->id,
        ]);

        $new = $this->actingAs($owner)->postJson($url, [
            'recipients' => [$recipient->email],
        ])->assertCreated()->json('created.0.id');
        $this->assertNotEquals($old, $new);
        $this->actingAs($recipient)->postJson("/api/my/invitations/{$new}/respond", [
            'action' => 'accept',
        ])->assertOk();
    }

    public function test_workspace_member_role_disabled_after_invitation_prevents_new_membership(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $recipient = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $id = $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/invitations", [
            'recipients' => [$recipient->email],
        ])->assertCreated()->json('created.0.id');

        $this->patchJson("/api/workspaces/{$workspace->id}/roles/builtin/member", [
            'enabled' => false,
        ])->assertOk();
        $this->actingAs($recipient)->postJson("/api/my/invitations/{$id}/respond", [
            'action' => 'accept',
        ])->assertStatus(409);

        $this->assertDatabaseMissing('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $recipient->id,
        ]);
    }

    public function test_client_can_reject_pending_invitation_after_workspace_disables_clients(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $recipient = User::factory()->create(['is_admin' => false, 'email_verified_at' => now()]);
        $workspace = Workspace::create([
            'name' => 'Agencia', 'owner_id' => $owner->id, 'show_clients' => true,
        ]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        $id = $this->actingAs($owner)->postJson('/api/clients', [
            'workspace_id' => $workspace->id, 'name' => 'Cliente invitado',
            'representative' => $recipient->email,
        ])->assertCreated()->json('invitation_id');

        $workspace->update(['show_clients' => false]);
        $this->actingAs($recipient)->postJson("/api/my/invitations/{$id}/respond", [
            'action' => 'reject',
        ])->assertOk()->assertJsonPath('status', 'rejected');

        $this->assertDatabaseCount('client_companies', 0);
    }
}
