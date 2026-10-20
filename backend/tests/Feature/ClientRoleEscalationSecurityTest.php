<?php

namespace Tests\Feature;

use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Support\ProjectAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientRoleEscalationSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_cannot_accept_internal_project_invitation_sent_before_onboarding(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $client = User::factory()->create(['is_admin' => false, 'email_verified_at' => now()]);
        $workspace = Workspace::create([
            'name' => 'Agencia', 'owner_id' => $owner->id, 'show_clients' => true,
        ]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Proyecto compartido']);
        $internalInvitation = $this->actingAs($owner)->postJson("/api/projects/{$project->id}/invitations", [
            'recipients' => [$client->email], 'role' => 'editor',
        ])->assertCreated()->json('created.0.id');

        $clientInvitation = $this->postJson('/api/clients', [
            'workspace_id' => $workspace->id,
            'name' => 'Empresa externa',
            'representative' => $client->email,
        ])->assertCreated()->json('invitation_id');

        $this->actingAs($client)->postJson("/api/my/invitations/{$clientInvitation}/respond", [
            'action' => 'accept',
        ])->assertOk();

        $this->postJson("/api/my/invitations/{$internalInvitation}/respond", [
            'action' => 'accept',
        ])->assertStatus(409);

        $this->assertDatabaseMissing('project_members', [
            'project_id' => $project->id, 'user_id' => $client->id,
        ]);
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $client->id, 'role' => 'client',
        ]);
    }

    public function test_legacy_client_with_internal_project_role_cannot_read_private_project_data(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $client = User::factory()->create(['is_admin' => false, 'email_verified_at' => now()]);
        $workspace = Workspace::create([
            'name' => 'Agencia', 'owner_id' => $owner->id, 'show_clients' => true,
        ]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Empresa externa']);
        $workspace->memberships()->create([
            'user_id' => $client->id, 'role' => 'client', 'client_company_id' => $company->id,
        ]);
        $project = Project::create([
            'workspace_id' => $workspace->id, 'name' => 'Interno',
            'client_company_id' => $company->id, 'client_access_enabled' => true,
        ]);
        $member = ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $client->id, 'role' => 'editor',
        ]);
        $this->assertNull(ProjectAccess::role($client, $project));
        $this->actingAs($client)->getJson("/api/projects/{$project->id}/dashboard")->assertForbidden();

        $member->update(['role' => 'cliente']);
        $this->assertSame('cliente', ProjectAccess::role($client, $project));
        $this->getJson("/api/projects/{$project->id}/dashboard")->assertOk();
    }
}
