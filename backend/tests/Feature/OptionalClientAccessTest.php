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

class OptionalClientAccessTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $owner = User::factory()->create(['is_admin' => true]);
        $workspace = Workspace::create(['name' => 'Agencia', 'owner_id' => $owner->id, 'show_clients' => true]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Nébula Mobile']);
        return compact('owner', 'workspace', 'company');
    }

    public function test_workspace_owner_controls_clients_without_deleting_data(): void
    {
        extract($this->fixture());
        $member = User::factory()->create(['is_admin' => false]);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);

        $this->actingAs($member)->patchJson('/api/workspaces/'.$workspace->id.'/client-settings', [
            'show_clients' => false,
        ])->assertForbidden();
        $this->actingAs($owner)->patchJson('/api/workspaces/'.$workspace->id.'/client-settings', [
            'show_clients' => false,
        ])->assertOk()->assertJsonPath('show_clients', false);
        $this->getJson('/api/me?workspace_id='.$workspace->id)->assertOk()
            ->assertJsonPath('workspaces.0.show_clients', false);
        $this->getJson('/api/clients?workspace_id='.$workspace->id)->assertNotFound();
        $this->assertDatabaseHas('client_companies', ['id' => $company->id]);
        $this->patchJson('/api/workspaces/'.$workspace->id.'/client-settings', [
            'show_clients' => true,
        ])->assertOk();
        $this->getJson('/api/clients?workspace_id='.$workspace->id)->assertOk();
    }

    public function test_new_project_without_client_is_allowed_and_client_access_is_off(): void
    {
        extract($this->fixture());
        $res = $this->actingAs($owner)->postJson('/api/projects', [
            'workspace_id' => $workspace->id,
            'name' => 'Proyecto personal',
        ])->assertCreated();
        $id = $res->json('id');
        $this->assertDatabaseHas('projects', [
            'id' => $id, 'client_company_id' => null, 'client_access_enabled' => false,
        ]);
        $res->assertJsonPath('client_name', null);
    }

    public function test_client_affiliation_does_not_automatically_enable_project_access(): void
    {
        extract($this->fixture());
        $customer = User::factory()->create(['is_admin' => false,
            'client_company_id' => $company->id, 'email_verified_at' => now()]);
        $workspace->memberships()->create(['user_id' => $customer->id, 'role' => 'member']);
        $res = $this->actingAs($owner)->postJson('/api/projects', [
            'workspace_id' => $workspace->id,
            'name' => 'Aplicación móvil', 'client_company_id' => $company->id,
        ])->assertCreated();
        $project = Project::findOrFail($res->json('id'));
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $customer->id, 'role' => 'cliente']);

        $this->assertNull(ProjectAccess::role($customer, $project));
        $this->actingAs($customer)->getJson('/api/projects/'.$project->id.'/personnel')->assertForbidden();

        $this->actingAs($owner)->patchJson('/api/projects/'.$project->id, [
            'client_access_enabled' => true,
        ])->assertOk();
        $this->assertSame('cliente', ProjectAccess::role($customer, $project->fresh()));
        $this->actingAs($customer)->getJson('/api/projects/'.$project->id.'/personnel')->assertOk();

        $this->actingAs($owner)->patchJson('/api/projects/'.$project->id, [
            'client_access_enabled' => false,
        ])->assertOk();
        $this->assertNull(ProjectAccess::role($customer, $project->fresh()));
    }

    public function test_client_access_requires_company_and_workspace_opt_in(): void
    {
        extract($this->fixture());
        $res = $this->actingAs($owner)->postJson('/api/projects', [
            'workspace_id' => $workspace->id, 'name' => 'Interno',
            'client_access_enabled' => true,
        ])->assertCreated();
        $project = Project::findOrFail($res->json('id'));
        $this->assertFalse($project->client_access_enabled);
        $this->patchJson('/api/projects/'.$project->id, ['client_access_enabled' => true])
            ->assertStatus(422);

        $this->patchJson('/api/projects/'.$project->id, [
            'client_company_id' => $company->id, 'client_access_enabled' => true,
        ])->assertOk();
        $this->patchJson('/api/projects/'.$project->id, [
            'client_company_id' => null,
        ])->assertStatus(422);
        $this->patchJson('/api/workspaces/'.$workspace->id.'/client-settings', [
            'show_clients' => false,
        ])->assertOk();
        $this->assertFalse((bool) ProjectAccess::role(
            User::factory()->create(['client_company_id' => $company->id]), $project->fresh()
        ));
    }

    public function test_contact_principal_requires_verified_active_workspace_user_and_same_company(): void
    {
        extract($this->fixture());
        $contact = User::factory()->create(['client_company_id' => $company->id,
            'professional_phone' => '+34 981 123 456', 'email_verified_at' => now()]);
        $workspace->memberships()->create(['user_id' => $contact->id, 'role' => 'member']);
        $inactive = User::factory()->create(['client_company_id' => $company->id]);
        $unverified = User::factory()->create(['client_company_id' => $company->id,
            'email_verified_at' => null]);
        $workspace->memberships()->create(['user_id' => $unverified->id, 'role' => 'member']);

        $this->actingAs($owner)->patchJson('/api/clients/'.$company->id, [
            'workspace_id' => $workspace->id, 'name' => 'Nébula Mobile',
            'primary_contact_user_id' => $inactive->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('primary_contact_user_id');
        $this->patchJson('/api/clients/'.$company->id, [
            'workspace_id' => $workspace->id, 'name' => 'Nébula Mobile',
            'primary_contact_user_id' => $unverified->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('primary_contact_user_id');

        $this->patchJson('/api/clients/'.$company->id, [
            'workspace_id' => $workspace->id, 'name' => 'Nébula Mobile',
            'client_type' => 'company', 'status' => 'active',
            'primary_contact_user_id' => $contact->id,
        ])->assertNoContent();
        $this->getJson('/api/clients?workspace_id='.$workspace->id)
            ->assertOk()->assertJsonPath('clients.0.primary_contact.id', $contact->id)
            ->assertJsonPath('clients.0.primary_contact.professional_phone', '+34 981 123 456')
            ->assertJsonPath('clients.0.people_count', 1);
    }

    public function test_professional_phone_can_be_updated_only_by_the_account_owner(): void
    {
        $user = User::factory()->create(['is_admin' => false]);
        $this->actingAs($user)->patchJson('/api/me', ['professional_phone' => '+34 981 123 456'])
            ->assertOk()->assertJsonPath('user.professional_phone', '+34 981 123 456');
        $this->patchJson('/api/me', ['professional_phone' => 'invalid'])
            ->assertUnprocessable()->assertJsonValidationErrors('professional_phone');
    }
}
