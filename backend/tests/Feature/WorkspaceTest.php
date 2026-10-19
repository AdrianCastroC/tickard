<?php

namespace Tests\Feature;

use App\Models\ClientCompany;
use App\Models\Department;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceTest extends TestCase
{
    use RefreshDatabase;

    public function test_workspace_can_be_created_with_an_owner(): void
    {
        $owner = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Mi espacio', 'owner_id' => $owner->id]);

        $this->assertTrue($workspace->owner->is($owner));
    }

    public function test_owner_can_have_an_owner_membership(): void
    {
        $owner = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Equipo', 'owner_id' => $owner->id]);
        $membership = $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);

        $this->assertSame('owner', $membership->role);
        $this->assertTrue($workspace->members->contains($owner));
    }

    public function test_user_can_belong_to_multiple_workspaces(): void
    {
        $user = User::factory()->create();
        $first = Workspace::create(['name' => 'Primero', 'owner_id' => $user->id]);
        $second = Workspace::create(['name' => 'Segundo', 'owner_id' => $user->id]);
        $user->workspaces()->attach([$first->id => ['role' => 'owner'], $second->id => ['role' => 'owner']]);

        $this->assertCount(2, $user->workspaces);
    }

    public function test_multiple_users_can_belong_to_the_same_workspace(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Equipo', 'owner_id' => $owner->id]);
        $workspace->members()->attach([
            $owner->id => ['role' => 'owner'],
            $member->id => ['role' => 'member'],
        ]);

        $this->assertCount(2, $workspace->members);
        $this->assertTrue($member->workspaces->contains($workspace));
    }

    public function test_workspace_membership_combination_is_unique(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Equipo', 'owner_id' => $user->id]);
        $workspace->members()->attach($user->id, ['role' => 'owner']);

        $this->expectException(\Illuminate\Database\QueryException::class);
        $workspace->members()->attach($user->id, ['role' => 'owner']);
    }

    public function test_workspace_and_user_relationships_are_available(): void
    {
        $owner = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Equipo', 'owner_id' => $owner->id]);
        $workspace->members()->attach($owner->id, ['role' => 'owner']);

        $this->assertTrue($workspace->owner->is($owner));
        $this->assertTrue($workspace->members->first()->is($owner));
        $this->assertTrue($owner->workspaceMemberships->first()->workspace->is($workspace));
        $this->assertTrue($owner->workspaces->first()->is($workspace));
        $this->assertTrue($owner->ownedWorkspaces->first()->is($workspace));
    }

    public function test_existing_user_gets_one_initial_workspace_idempotently(): void
    {
        $user = User::factory()->create();

        $first = Workspace::createInitialFor($user);
        $second = Workspace::createInitialFor($user);

        $this->assertTrue($first->is($second));
        $this->assertSame(1, $user->ownedWorkspaces()->count());
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $first->id,
            'user_id' => $user->id,
            'role' => 'owner',
        ]);
    }
    public function test_workspace_overview_has_real_scoped_metrics_for_owner_and_admin(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $workspace->update(['show_clients' => true]);
        $admin = User::factory()->create(['is_admin' => false]);
        $member = User::factory()->create(['is_admin' => false]);
        $external = User::factory()->create(['is_admin' => false]);
        $workspace->memberships()->create(['user_id' => $admin->id, 'role' => 'admin']);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $workspace->projects()->create(['name' => 'Proyecto uno']);
        $project = $workspace->projects()->create(['name' => 'Proyecto dos']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $member->id, 'role' => 'editor']);
        Department::create(['workspace_id' => $workspace->id, 'name' => 'Desarrollo']);
        Team::create(['workspace_id' => $workspace->id, 'name' => 'Backend']);
        ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Cliente A']);

        $url = "/api/workspaces/{$workspace->id}/overview";
        $this->actingAs($external)->getJson($url)->assertForbidden();
        $this->actingAs($owner)->getJson($url)->assertOk()
            ->assertJsonPath('can_manage', true)
            ->assertJsonPath('can_delete', false)
            ->assertJsonPath('stats.projects', 2)
            ->assertJsonPath('stats.members', 3)
            ->assertJsonPath('stats.departments', 1)
            ->assertJsonPath('stats.teams', 1)
            ->assertJsonPath('stats.clients', 1);

        $this->actingAs($admin)->getJson($url)->assertOk()
            ->assertJsonPath('can_manage', false)
            ->assertJsonPath('can_view_personnel', true)
            ->assertJsonPath('stats.projects', 2)
            ->assertJsonPath('stats.members', 3);
        $this->actingAs($member)->getJson($url)->assertOk()
            ->assertJsonPath('can_manage', false)
            ->assertJsonPath('can_view_personnel', false)
            ->assertJsonPath('stats.projects', 1)
            ->assertJsonPath('stats.members', null)
            ->assertJsonPath('stats.clients', null);
    }

    public function test_workspace_overview_hides_other_workspace_and_client_data(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $workspace->update(['show_clients' => true]);
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Cliente A']);
        $client = User::factory()->create(['is_admin' => false, 'email_verified_at' => now()]);
        $workspace->memberships()->create([
            'user_id' => $client->id, 'role' => 'client', 'client_company_id' => $company->id,
        ]);

        $visible = $workspace->projects()->create([
            'name' => 'Público', 'client_company_id' => $company->id, 'client_access_enabled' => true,
        ]);
        $hidden = $workspace->projects()->create(['name' => 'Interno']);
        foreach ([$visible, $hidden] as $project) {
            ProjectMember::create([
                'project_id' => $project->id, 'user_id' => $client->id, 'role' => 'cliente',
            ]);
        }
        $otherOwner = User::factory()->create(['is_admin' => false]);
        $otherWorkspace = Workspace::createInitialFor($otherOwner);
        $otherWorkspace->projects()->create(['name' => 'Privado']);

        $this->actingAs($client)->getJson("/api/workspaces/{$workspace->id}/overview")
            ->assertOk()
            ->assertJsonPath('can_view_personnel', false)
            ->assertJsonPath('stats.projects', 1)
            ->assertJsonPath('stats.members', null)
            ->assertJsonPath('stats.departments', null)
            ->assertJsonPath('stats.teams', null)
            ->assertJsonPath('stats.clients', null);
        $this->getJson("/api/workspaces/{$otherWorkspace->id}/overview")->assertForbidden();
        $workspace->update(['show_clients' => false]);
        $this->getJson("/api/workspaces/{$workspace->id}/overview")
            ->assertOk()->assertJsonPath('stats.projects', 0);
    }

    public function test_workspace_rename_requires_owner_valid_name_and_preserves_others(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $member = User::factory()->create(['is_admin' => false]);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $url = "/api/workspaces/{$workspace->id}";

        $this->actingAs($member)->patchJson($url, ['name' => 'No autorizado'])
            ->assertForbidden();
        $this->actingAs($owner)->patchJson($url, ['name' => '   '])->assertUnprocessable();
        $this->patchJson($url, ['name' => str_repeat('A', 101)])
            ->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->patchJson($url, ['name' => '  Empresa Nueva  '])
            ->assertOk()->assertJsonPath('name', 'Empresa Nueva');

        $this->assertDatabaseHas('workspaces', [
            'id' => $workspace->id, 'name' => 'Empresa Nueva',
        ]);
        $this->getJson($url.'/overview')->assertOk()
            ->assertJsonPath('name', 'Empresa Nueva');

        $this->deleteJson($url, ['confirmation_name' => 'Empresa Nueva'])
            ->assertUnprocessable();
    }

}
