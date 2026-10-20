<?php

namespace Tests\Feature;

use App\Models\ClientCompany;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientInvitationInviterSecurityTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $manager = User::factory()->create(['is_admin' => false]);
        $representative = User::factory()->create([
            'is_admin' => false, 'email_verified_at' => now(),
        ]);
        $workspace = Workspace::create([
            'name' => 'Agencia', 'owner_id' => $owner->id, 'show_clients' => true,
        ]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        $workspace->memberships()->create(['user_id' => $manager->id, 'role' => 'admin']);

        $id = $this->actingAs($manager)->postJson('/api/clients', [
            'workspace_id' => $workspace->id,
            'name' => 'Cliente restringido',
            'representative' => $representative->email,
        ])->assertCreated()->json('invitation_id');

        return [$owner, $manager, $representative, $workspace, $id];
    }

    public function test_demoted_inviter_cannot_create_client_from_pending_invitation(): void
    {
        [$owner, $manager, $representative, $workspace, $id] = $this->fixture();
        $this->actingAs($owner)->patchJson("/api/workspaces/{$workspace->id}/members/{$manager->id}/role", [
            'role' => 'member',
        ])->assertOk();

        $this->actingAs($representative)->postJson("/api/my/invitations/{$id}/respond", [
            'action' => 'accept',
        ])->assertStatus(409);

        $this->assertDatabaseMissing('client_companies', [
            'workspace_id' => $workspace->id, 'name' => 'Cliente restringido',
        ]);
        $this->assertDatabaseMissing('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $representative->id,
        ]);
    }

    public function test_removed_inviter_cannot_create_client_from_pending_invitation(): void
    {
        [$owner, $manager, $representative, $workspace, $id] = $this->fixture();
        $this->actingAs($owner)->deleteJson("/api/workspaces/{$workspace->id}/members/{$manager->id}")
            ->assertNoContent();

        $this->actingAs($representative)->postJson("/api/my/invitations/{$id}/respond", [
            'action' => 'accept',
        ])->assertStatus(409);

        $this->assertDatabaseCount('client_companies', 0);
        $this->assertDatabaseMissing('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $representative->id,
        ]);
    }

    public function test_authorized_inviter_still_can_onboard_client_representative(): void
    {
        [$owner, $manager, $representative, $workspace, $id] = $this->fixture();

        $this->actingAs($representative)->postJson("/api/my/invitations/{$id}/respond", [
            'action' => 'accept',
        ])->assertOk()->assertJsonPath('status', 'accepted');

        $company = ClientCompany::where('workspace_id', $workspace->id)->firstOrFail();
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id,
            'user_id' => $representative->id,
            'role' => 'client',
            'client_company_id' => $company->id,
        ]);
    }
}
