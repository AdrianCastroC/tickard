<?php

namespace Tests\Feature;

use App\Models\ClientCompany;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientCompanyInvitationTest extends TestCase
{
    use RefreshDatabase;

    private function prepare(): array
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $representative = User::factory()->create([
            'is_admin' => false, 'email_verified_at' => now(),
        ]);
        $workspace = Workspace::create([
            'name' => 'Empresa gestora', 'owner_id' => $owner->id, 'show_clients' => true,
        ]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        return compact('owner', 'representative', 'workspace');
    }

    private function invite(Workspace $workspace, User $owner, User $representative, string $name = 'Nébula Mobile'): int
    {
        $result = $this->actingAs($owner)->postJson('/api/clients', [
            'workspace_id' => $workspace->id,
            'name' => $name,
            'client_type' => 'company',
            'sector' => 'Tecnología',
            'description' => 'Aplicación móvil',
            'representative' => $representative->email,
        ])->assertCreated()->assertJsonPath('status', 'pending');

        return $result->json('invitation_id');
    }

    public function test_client_is_only_created_after_first_representative_accepts(): void
    {
        extract($this->prepare());
        $id = $this->invite($workspace, $owner, $representative);
        $this->assertDatabaseMissing('client_companies', ['workspace_id' => $workspace->id, 'name' => 'Nébula Mobile']);
        $this->actingAs($owner)->getJson('/api/clients?workspace_id='.$workspace->id)
            ->assertOk()->assertJsonPath('pending_clients.0.id', $id)
            ->assertJsonCount(0, 'clients');

        $this->actingAs($representative)->getJson('/api/my/invitations')
            ->assertOk()->assertJsonPath('0.kind', 'client_company')
            ->assertJsonPath('0.client_company_name', 'Nébula Mobile');
        $this->postJson('/api/my/invitations/'.$id.'/respond', ['action' => 'accept'])
            ->assertOk()->assertJsonPath('status', 'accepted');
        $company = ClientCompany::where('workspace_id', $workspace->id)
            ->where('name', 'Nébula Mobile')->firstOrFail();
        $this->assertSame($representative->id, (int) $company->primary_contact_user_id);
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $representative->id,
            'role' => 'client', 'client_company_id' => $company->id,
        ]);
        $this->assertNull($representative->fresh()->client_company_id);
        $this->actingAs($owner)->getJson('/api/clients?workspace_id='.$workspace->id)
            ->assertOk()->assertJsonCount(0, 'pending_clients')
            ->assertJsonPath('clients.0.people_count', 1)
            ->assertJsonPath('clients.0.primary_contact.id', $representative->id)
            ->assertJsonPath('clients.0.needs_representative', false);

        $this->actingAs($representative)->postJson('/api/my/invitations/'.$id.'/respond', [
            'action' => 'accept',
        ])->assertStatus(409);
        $this->assertSame(1, ClientCompany::where('workspace_id', $workspace->id)->count());
    }

    public function test_rejecting_or_canceling_creates_no_company(): void
    {
        extract($this->prepare());
        $id = $this->invite($workspace, $owner, $representative);
        $this->actingAs($representative)->postJson('/api/my/invitations/'.$id.'/respond', [
            'action' => 'reject',
        ])->assertOk()->assertJsonPath('status', 'rejected');
        $this->assertDatabaseCount('client_companies', 0);

        $pending = $this->invite($workspace, $owner, $representative, 'Otro cliente');
        $this->deleteJson('/api/clients/pending/'.$pending, [
            'workspace_id' => $workspace->id,
        ])->assertNoContent();
        $this->actingAs($representative)->postJson('/api/my/invitations/'.$pending.'/respond', [
            'action' => 'accept',
        ])->assertStatus(409);
        $this->assertDatabaseCount('client_companies', 0);
    }

    public function test_only_valid_registered_account_can_be_invited_and_names_cannot_duplicate(): void
    {
        extract($this->prepare());
        $this->actingAs($owner)->postJson('/api/clients', [
            'workspace_id' => $workspace->id, 'name' => 'Sin cuenta',
        ])->assertUnprocessable()->assertJsonValidationErrors('representative');
        $this->postJson('/api/clients', [
            'workspace_id' => $workspace->id, 'name' => 'Sin cuenta',
            'representative' => 'not-present@example.invalid',
        ])->assertUnprocessable()->assertJsonValidationErrors('representative');

        $unverified = User::factory()->create(['email_verified_at' => null]);
        $this->postJson('/api/clients', [
            'workspace_id' => $workspace->id, 'name' => 'Sin verificar',
            'representative' => $unverified->email,
        ])->assertUnprocessable()->assertJsonValidationErrors('representative');

        $id = $this->invite($workspace, $owner, $representative);
        $this->postJson('/api/clients', [
            'workspace_id' => $workspace->id, 'name' => 'Nébula Mobile',
            'representative' => $representative->email,
        ])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->assertSame('pending', WorkspaceInvitation::findOrFail($id)->status);
        $this->assertDatabaseCount('client_companies', 0);
    }

    public function test_scoped_company_does_not_turn_same_user_into_client_in_other_workspace(): void
    {
        extract($this->prepare());
        $anotherOwner = User::factory()->create(['is_admin' => false]);
        $another = Workspace::create(['name' => 'Otro Workspace', 'owner_id' => $anotherOwner->id]);
        $another->memberships()->create(['user_id' => $anotherOwner->id, 'role' => 'owner']);
        $another->memberships()->create(['user_id' => $representative->id, 'role' => 'member']);

        $id = $this->invite($workspace, $owner, $representative);
        $this->actingAs($representative)->postJson('/api/my/invitations/'.$id.'/respond', [
            'action' => 'accept',
        ])->assertOk();

        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $another->id,
            'user_id' => $representative->id,
            'role' => 'member',
            'client_company_id' => null,
        ]);
        $this->assertDatabaseMissing('workspace_members', [
            'workspace_id' => $another->id, 'user_id' => $representative->id, 'role' => 'client',
        ]);
        $this->actingAs($representative)->getJson('/api/clients?workspace_id='.$workspace->id)
            ->assertForbidden();
    }

    public function test_other_users_cannot_accept_invitation_or_cancel_it(): void
    {
        extract($this->prepare());
        $id = $this->invite($workspace, $owner, $representative);
        $other = User::factory()->create(['is_admin' => false]);
        $this->actingAs($other)->postJson('/api/my/invitations/'.$id.'/respond', [
            'action' => 'accept',
        ])->assertForbidden();
        $this->deleteJson('/api/clients/pending/'.$id, [
            'workspace_id' => $workspace->id,
        ])->assertForbidden();
        $this->assertDatabaseCount('client_companies', 0);
    }

    public function test_existing_legacy_company_without_users_is_flagged_not_deleted(): void
    {
        extract($this->prepare());
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Histórico']);
        $this->actingAs($owner)->getJson('/api/clients?workspace_id='.$workspace->id)
            ->assertOk()->assertJsonPath('clients.0.needs_representative', true);
        $this->assertDatabaseHas('client_companies', ['id' => $company->id]);
    }
}
