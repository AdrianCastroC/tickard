<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Support\ProjectAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GlobalAdminTenantIsolationSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_global_admin_must_belong_to_workspace_before_accessing_its_project(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $admin = User::factory()->create(['is_admin' => true]);
        $workspace = Workspace::createInitialFor($owner);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Confidencial']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Privado']);
        $board->createDefaultColumns();
        $card = Card::create([
            'board_id' => $board->id, 'column_id' => $board->columns()->firstOrFail()->id,
            'title' => 'Información privada', 'created_by' => $owner->id,
        ]);
        $this->assertNull(ProjectAccess::role($admin, $project));
        $this->actingAs($admin)->getJson("/api/projects/{$project->id}/dashboard")
            ->assertForbidden();
        $this->getJson("/api/boards/{$board->id}")->assertForbidden();
        $this->getJson("/api/projects/{$project->id}/files")->assertForbidden();
        $this->patchJson("/api/cards/{$card->id}", ['title' => 'Alterada'])
            ->assertForbidden();

        $workspace->memberships()->create(['user_id' => $admin->id, 'role' => 'admin']);
        $this->assertSame('responsable', ProjectAccess::role($admin, $project));
        $this->getJson("/api/projects/{$project->id}/dashboard")->assertOk();
        $this->patchJson("/api/cards/{$card->id}", ['title' => 'Permitida'])
            ->assertNoContent();
    }

    public function test_global_admin_flag_does_not_override_client_membership_privacy(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $client = User::factory()->create(['is_admin' => true, 'email_verified_at' => now()]);
        $workspace = Workspace::create([
            'name' => 'Empresa', 'owner_id' => $owner->id, 'show_clients' => true,
        ]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Cliente']);
        $workspace->memberships()->create([
            'user_id' => $client->id, 'role' => 'client', 'client_company_id' => $company->id,
        ]);
        $project = Project::create([
            'workspace_id' => $workspace->id, 'name' => 'Compartido',
            'client_company_id' => $company->id, 'client_access_enabled' => true,
        ]);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $client->id, 'role' => 'cliente']);

        $this->assertNull(ProjectAccess::role($client, $project));
        $this->actingAs($client)->getJson("/api/projects/{$project->id}/dashboard")
            ->assertForbidden();
    }

    public function test_removed_global_admin_cannot_authorize_pending_client_invitation(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $globalAdmin = User::factory()->create(['is_admin' => true]);
        $representative = User::factory()->create(['is_admin' => false, 'email_verified_at' => now()]);
        $workspace = Workspace::create([
            'name' => 'Agencia', 'owner_id' => $owner->id, 'show_clients' => true,
        ]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        $workspace->memberships()->create(['user_id' => $globalAdmin->id, 'role' => 'admin']);

        $id = $this->actingAs($globalAdmin)->postJson('/api/clients', [
            'workspace_id' => $workspace->id,
            'name' => 'Empresa pendiente', 'representative' => $representative->email,
        ])->assertCreated()->json('invitation_id');

        $this->actingAs($owner)->deleteJson("/api/workspaces/{$workspace->id}/members/{$globalAdmin->id}")
            ->assertNoContent();
        $this->assertFalse(\App\Support\WorkspacePersonnelGuard::canManageUser(
            $globalAdmin, $workspace, 'workspace.clients'
        ));

        $this->actingAs($representative)->postJson("/api/my/invitations/{$id}/respond", [
            'action' => 'accept',
        ])->assertStatus(409);

        $this->assertDatabaseCount('client_companies', 0);
    }
}
