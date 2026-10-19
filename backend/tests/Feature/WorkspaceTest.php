<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
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

    public function test_workspace_dashboard_uses_real_card_statistics_and_scoped_lists(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $workspace->update(['show_clients' => true]);
        $project = $workspace->projects()->create([
            'name' => 'Proyecto A', 'description' => 'Diseño y desarrollo de una plataforma',
        ]);
        \App\Models\ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $owner->id, 'role' => 'responsable',
        ]);
        $owner->update(['avatar_path' => 'avatars/ana-demo.jpg']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Tablero A']);
        $board->createDefaultColumns();
        $pending = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $done = $board->columns()->where('workflow_state', 'done')->firstOrFail();
        $task = Card::create([
            'board_id' => $board->id, 'column_id' => $pending->id,
            'title' => 'Validar pagos', 'due_date' => now()->addDay()->toDateString(),
        ]);
        Card::create([
            'board_id' => $board->id, 'column_id' => $done->id,
            'title' => 'Tarea finalizada',
        ]);
        $task->activities()->create(['user_id' => $owner->id, 'type' => 'created']);
        $workspace->teams()->create(['name' => 'Frontend']);
        $workspace->departments()->create(['name' => 'Desarrollo']);
        $workspace->clientCompanies()->create(['name' => 'Nébula Mobile']);

        $otherOwner = User::factory()->create(['is_admin' => false]);
        $other = Workspace::createInitialFor($otherOwner);
        $otherProject = $other->projects()->create(['name' => 'Proyecto ajeno']);
        $otherBoard = Board::create(['project_id' => $otherProject->id, 'name' => 'Tablero ajeno']);
        $otherBoard->createDefaultColumns();
        Card::create([
            'board_id' => $otherBoard->id,
            'column_id' => $otherBoard->columns()->firstOrFail()->id,
            'title' => 'Tarea ajena',
        ]);

        $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/overview")
            ->assertOk()->assertJsonPath('dashboard.cards.total', 2)
            ->assertJsonPath('dashboard.cards.completed', 1)
            ->assertJsonCount(1, 'dashboard.projects')
            ->assertJsonPath('dashboard.projects.0.name', 'Proyecto A')
            ->assertJsonPath('dashboard.projects.0.description', 'Diseño y desarrollo de una plataforma')
            ->assertJsonPath('dashboard.projects.0.member_count', 1)
            ->assertJsonPath('dashboard.projects.0.members.0.id', $owner->id)
            ->assertJsonPath('dashboard.projects.0.members.0.avatar_url', '/storage/avatars/ana-demo.jpg')
            ->assertJsonPath('dashboard.projects.0.latest_due_date', $task->due_date)
            ->assertJsonPath('dashboard.projects.0.total', 2)
            ->assertJsonPath('dashboard.projects.0.completed', 1)
            ->assertJsonCount(1, 'dashboard.tasks')
            ->assertJsonPath('dashboard.tasks.0.title', 'Validar pagos')
            ->assertJsonPath('dashboard.tasks.0.project_id', $project->id)
            ->assertJsonCount(1, 'dashboard.activity')
            ->assertJsonPath('dashboard.activity.0.card_title', 'Validar pagos')
            ->assertJsonPath('dashboard.activity.0.user_id', $owner->id)
            ->assertJsonPath('dashboard.activity.0.avatar_url', '/storage/avatars/ana-demo.jpg')
            ->assertJsonPath('dashboard.teams.0.name', 'Frontend')
            ->assertJsonPath('dashboard.departments.0.name', 'Desarrollo')
            ->assertJsonPath('dashboard.clients.0.name', 'Nébula Mobile')
            ->assertJsonMissing(['title' => 'Tarea ajena']);
    }

    public function test_workspace_dashboard_does_not_expose_unassigned_cards_or_internal_client_cards(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $workspace->update(['show_clients' => true]);
        $company = $workspace->clientCompanies()->create(['name' => 'Cliente A']);
        $member = User::factory()->create(['is_admin' => false]);
        $client = User::factory()->create(['is_admin' => false, 'email_verified_at' => now()]);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $workspace->memberships()->create([
            'user_id' => $client->id, 'role' => 'client', 'client_company_id' => $company->id,
        ]);
        $project = $workspace->projects()->create([
            'name' => 'Portal', 'client_company_id' => $company->id, 'client_access_enabled' => true,
        ]);
        \App\Models\ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $member->id, 'role' => 'editor',
        ]);
        \App\Models\ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $client->id, 'role' => 'cliente',
        ]);
        $board = Board::create(['project_id' => $project->id, 'name' => 'General']);
        $board->createDefaultColumns();
        $column = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $public = Card::create([
            'board_id' => $board->id, 'column_id' => $column->id,
            'title' => 'Pública', 'is_internal' => false,
        ]);
        $internal = Card::create([
            'board_id' => $board->id, 'column_id' => $column->id,
            'title' => 'Interna', 'is_internal' => true,
        ]);
        $public->assignees()->attach([$member->id, $client->id]);
        $public->activities()->create(['user_id' => $owner->id, 'type' => 'created']);
        $internal->activities()->create(['user_id' => $owner->id, 'type' => 'created']);

        $this->actingAs($member)->getJson("/api/workspaces/{$workspace->id}/overview")
            ->assertOk()->assertJsonPath('dashboard.cards.total', 1)
            ->assertJsonCount(1, 'dashboard.tasks')
            ->assertJsonCount(1, 'dashboard.activity')
            ->assertJsonCount(0, 'dashboard.members');

        $this->actingAs($client)->getJson("/api/workspaces/{$workspace->id}/overview")
            ->assertOk()->assertJsonPath('dashboard.cards.total', 1)
            ->assertJsonCount(1, 'dashboard.projects')
            ->assertJsonCount(1, 'dashboard.tasks')
            ->assertJsonCount(1, 'dashboard.activity')
            ->assertJsonCount(0, 'dashboard.members')
            ->assertJsonCount(0, 'dashboard.clients')
            ->assertJsonMissing(['card_title' => 'Interna']);
    }

    public function test_owner_can_create_and_edit_project_description_but_regular_member_cannot(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $member = User::factory()->create(['is_admin' => false]);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);

        $this->actingAs($member)->postJson('/api/projects', [
            'workspace_id' => $workspace->id, 'name' => 'No autorizado',
        ])->assertForbidden();

        $response = $this->actingAs($owner)->postJson('/api/projects', [
            'workspace_id' => $workspace->id,
            'name' => 'Proyecto con descripción',
            'description' => 'Objetivo general de la aplicación',
        ])->assertCreated();
        $id = $response->json('id');
        $this->assertDatabaseHas('projects', [
            'id' => $id, 'description' => 'Objetivo general de la aplicación',
        ]);

        $this->patchJson('/api/projects/'.$id, [
            'description' => '  Nueva descripción general  ',
        ])->assertOk();
        $this->assertDatabaseHas('projects', [
            'id' => $id, 'description' => 'Nueva descripción general',
        ]);
        $this->getJson('/api/projects/'.$id.'/settings')
            ->assertOk()->assertJsonPath('description', 'Nueva descripción general');
        $this->patchJson('/api/projects/'.$id, [
            'description' => str_repeat('X', 2001),
        ])->assertUnprocessable()->assertJsonValidationErrors('description');
    }

}
