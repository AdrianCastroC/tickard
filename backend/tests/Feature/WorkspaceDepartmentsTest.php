<?php

namespace Tests\Feature;

use App\Models\ClientCompany;
use App\Models\Department;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceDepartmentsTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $member = User::factory()->create(['is_admin' => false]);
        $other = User::factory()->create(['is_admin' => false]);
        $client = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::create(['name' => 'Empresa', 'owner_id' => $owner->id]);
        foreach ([$owner, $member, $client] as $person) {
            $workspace->memberships()->create([
                'user_id' => $person->id,
                'role' => $person->id === $owner->id ? 'owner' : 'member',
            ]);
        }
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Cliente externo']);
        $client->update(['client_company_id' => $company->id]);
        return compact('owner', 'member', 'other', 'client', 'workspace');
    }

    public function test_owner_can_create_and_update_departments_and_lead(): void
    {
        extract($this->fixture());
        $post = $this->actingAs($owner)->postJson('/api/departments', [
            'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
            'member_ids' => [$owner->id, $member->id], 'lead_user_id' => $member->id,
        ]);
        $post->assertCreated();
        $id = $post->json('id');
        $this->assertDatabaseHas('departments', [
            'id' => $id, 'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
            'lead_user_id' => $member->id,
        ]);

        $this->getJson('/api/departments?workspace_id='.$workspace->id)->assertOk()
            ->assertJsonPath('can_manage', true)
            ->assertJsonPath('departments.0.members.0.avatar_url', null)
            ->assertJsonPath('departments.0.lead_user_id', $member->id);

        $this->patchJson('/api/departments/'.$id, [
            'workspace_id' => $workspace->id, 'name' => 'Producto',
            'member_ids' => [$owner->id], 'lead_user_id' => $owner->id,
        ])->assertNoContent();
        $this->assertDatabaseHas('departments', ['id' => $id, 'name' => 'Producto', 'lead_user_id' => $owner->id]);
        $this->assertSame([$owner->id], Department::findOrFail($id)->members()->pluck('users.id')->all());

        $this->deleteJson('/api/departments/'.$id, ['workspace_id' => $workspace->id])
            ->assertNoContent();
        $this->assertDatabaseMissing('departments', ['id' => $id]);
        $this->assertDatabaseHas('workspace_members', ['workspace_id' => $workspace->id, 'user_id' => $member->id]);
    }

    public function test_workspace_member_can_view_but_cannot_modify_departments(): void
    {
        extract($this->fixture());
        $department = Department::create(['workspace_id' => $workspace->id, 'name' => 'Soporte']);
        $this->actingAs($member)->getJson('/api/departments?workspace_id='.$workspace->id)
            ->assertOk()->assertJsonPath('can_manage', false);
        $this->postJson('/api/departments', [
            'workspace_id' => $workspace->id, 'name' => 'No permitido',
        ])->assertForbidden();
        $this->patchJson('/api/departments/'.$department->id, [
            'workspace_id' => $workspace->id, 'name' => 'No permitido',
        ])->assertForbidden();
        $this->deleteJson('/api/departments/'.$department->id, [
            'workspace_id' => $workspace->id,
        ])->assertForbidden();
    }

    public function test_outsiders_and_clients_are_excluded(): void
    {
        extract($this->fixture());
        $this->actingAs($other)->getJson('/api/departments?workspace_id='.$workspace->id)->assertForbidden();
        $this->actingAs($client)->getJson('/api/departments?workspace_id='.$workspace->id)->assertForbidden();

        $this->actingAs($owner)->postJson('/api/departments', [
            'workspace_id' => $workspace->id, 'name' => 'Soporte',
            'member_ids' => [$other->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('member_ids');
        $this->postJson('/api/departments', [
            'workspace_id' => $workspace->id, 'name' => 'Soporte',
            'member_ids' => [$client->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('member_ids');
    }

    public function test_lead_must_belong_to_department_and_names_are_unique_per_workspace(): void
    {
        extract($this->fixture());
        $this->actingAs($owner)->postJson('/api/departments', [
            'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
            'member_ids' => [$owner->id], 'lead_user_id' => $member->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('lead_user_id');

        Department::create(['workspace_id' => $workspace->id, 'name' => 'Desarrollo']);
        $this->postJson('/api/departments', [
            'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
            'member_ids' => [$owner->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('name');
    }
}
