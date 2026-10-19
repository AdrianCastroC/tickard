<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\CardChecklistItem;
use App\Models\ClientCompany;
use App\Models\Department;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class WorkspaceMembersTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $admin = User::factory()->create(['is_admin' => false]);
        $member = User::factory()->create(['is_admin' => false]);
        $client = User::factory()->create(['is_admin' => false]);
        $outside = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);

        $workspace->memberships()->create(['user_id' => $admin->id, 'role' => 'admin']);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Empresa cliente']);
        $workspace->memberships()->create([
            'user_id' => $client->id, 'role' => 'client', 'client_company_id' => $company->id,
        ]);

        return compact('owner', 'admin', 'member', 'client', 'outside', 'workspace', 'company');
    }

    public function test_owner_and_workspace_admin_can_view_roster_but_regular_member_cannot(): void
    {
        extract($this->fixture());
        $url = "/api/workspaces/{$workspace->id}/members";

        $this->actingAs($owner)->getJson($url)
            ->assertOk()->assertJsonPath('can_manage_roles', true)
            ->assertJsonCount(4, 'members')->assertJsonPath('member_count', 4);
        $this->actingAs($admin)->getJson($url)
            ->assertOk()->assertJsonPath('can_manage_roles', false)
            ->assertJsonCount(4, 'members');
        $this->actingAs($member)->getJson($url)->assertForbidden();
        $this->actingAs($outside)->getJson($url)->assertForbidden();
    }

    public function test_owner_can_change_membership_role_without_changing_project_permissions(): void
    {
        extract($this->fixture());
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Proyecto']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $member->id, 'role' => 'lector']);

        $url = "/api/workspaces/{$workspace->id}/members/{$member->id}/role";
        $this->actingAs($owner)->patchJson($url, ['role' => 'admin'])
            ->assertOk()->assertJsonPath('role', 'admin');
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $member->id, 'role' => 'admin',
        ]);
        $this->assertDatabaseHas('project_members', [
            'project_id' => $project->id, 'user_id' => $member->id, 'role' => 'lector',
        ]);
        $this->actingAs($owner)->patchJson($url, ['role' => 'member'])->assertOk();
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $member->id, 'role' => 'member',
        ]);
    }

    public function test_owner_and_client_roles_are_protected_and_admin_cannot_promote(): void
    {
        extract($this->fixture());
        $url = "/api/workspaces/{$workspace->id}/members/";

        $this->actingAs($owner)->patchJson($url.$owner->id.'/role', ['role' => 'member'])
            ->assertUnprocessable();
        $this->patchJson($url.$client->id.'/role', ['role' => 'admin'])->assertUnprocessable();
        $this->patchJson($url.$member->id.'/role', ['role' => 'owner'])
            ->assertUnprocessable()->assertJsonValidationErrors('role');
        $this->actingAs($admin)->patchJson($url.$member->id.'/role', ['role' => 'admin'])
            ->assertForbidden();
        $this->actingAs($outside)->patchJson($url.$member->id.'/role', ['role' => 'admin'])
            ->assertForbidden();

        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $client->id, 'role' => 'client',
        ]);
        $this->assertDatabaseHas('workspaces', ['id' => $workspace->id, 'owner_id' => $owner->id]);
    }

    public function test_cross_workspace_account_cannot_be_promoted_and_roster_is_scoped(): void
    {
        extract($this->fixture());
        $url = "/api/workspaces/{$workspace->id}/members/";
        $this->actingAs($owner)->patchJson($url.$outside->id.'/role', ['role' => 'admin'])
            ->assertNotFound();
        $this->actingAs($outside)->getJson('/api/workspaces/'.$workspace->id.'/members')
            ->assertForbidden();
    }

    public function test_roster_lists_only_links_from_current_workspace(): void
    {
        extract($this->fixture());
        $department = Department::create([
            'workspace_id' => $workspace->id, 'name' => 'Desarrollo', 'lead_user_id' => $member->id,
        ]);
        $department->members()->attach($member->id);
        $team = Team::create(['workspace_id' => $workspace->id, 'name' => 'Frontend', 'lead_user_id' => $member->id]);
        $team->members()->attach($member->id);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Portal']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $member->id, 'role' => 'editor']);

        $result = $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/members")
            ->assertOk()->json('members');
        $person = collect($result)->firstWhere('id', $member->id);

        $this->assertSame('Desarrollo', $person['departments'][0]['name']);
        $this->assertTrue($person['departments'][0]['is_lead']);
        $this->assertSame('Frontend', $person['teams'][0]['name']);
        $this->assertTrue($person['teams'][0]['is_lead']);
        $this->assertSame('Portal', $person['projects'][0]['name']);
        $this->assertSame('editor', $person['projects'][0]['role']);
        $this->assertSame($member->email, $person['email']);
        $this->assertArrayHasKey('professional_phone', $person);
        $this->assertArrayHasKey('joined_at', $person);
        $clientMember = collect($result)->firstWhere('id', $client->id);
        $this->assertSame('client', $clientMember['role']);
        $this->assertTrue($clientMember['is_client']);
    }
    public function test_owner_and_admin_can_update_a_workspaces_job_title_without_affecting_other_workspaces(): void
    {
        extract($this->fixture());
        $url = "/api/workspaces/{$workspace->id}/members/{$member->id}/job-title";

        $this->actingAs($owner)->patchJson($url, ['job_title' => 'Programador junior'])
            ->assertOk()->assertJsonPath('job_title', 'Programador junior');
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $member->id,
            'job_title' => 'Programador junior',
        ]);

        $this->actingAs($admin)->patchJson($url, ['job_title' => 'Programador backend'])
            ->assertOk()->assertJsonPath('job_title', 'Programador backend');

        $secondOwner = User::factory()->create(['is_admin' => false]);
        $otherWorkspace = Workspace::createInitialFor($secondOwner);
        $otherWorkspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $otherWorkspace->id, 'user_id' => $member->id,
            'job_title' => null,
        ]);

        $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/members")
            ->assertOk()->assertJsonPath('can_manage_jobs', true);
        $this->actingAs($admin)->getJson("/api/workspaces/{$workspace->id}/members")
            ->assertOk()->assertJsonPath('can_manage_jobs', true);
        $this->actingAs($secondOwner)->getJson("/api/workspaces/{$otherWorkspace->id}/members")
            ->assertOk()->assertJsonPath('can_manage_jobs', true);
        $this->actingAs($owner)->patchJson($url, ['job_title' => null])
            ->assertOk()->assertJsonPath('job_title', null);
    }

    public function test_job_title_changes_are_scoped_validated_and_cannot_modify_clients(): void
    {
        extract($this->fixture());
        $base = "/api/workspaces/{$workspace->id}/members/";

        $this->actingAs($member)->patchJson($base.$admin->id.'/job-title', [
            'job_title' => 'Director',
        ])->assertForbidden();
        $this->actingAs($outside)->patchJson($base.$member->id.'/job-title', [
            'job_title' => 'Consultor',
        ])->assertForbidden();

        $this->actingAs($owner)->patchJson($base.$outside->id.'/job-title', [
            'job_title' => 'Consultor',
        ])->assertNotFound();
        $this->patchJson($base.$client->id.'/job-title', [
            'job_title' => 'Gestor',
        ])->assertUnprocessable();
        $this->patchJson($base.$member->id.'/job-title', [
            'job_title' => str_repeat('a', 121),
        ])->assertUnprocessable()->assertJsonValidationErrors('job_title');
        $this->patchJson($base.$member->id.'/job-title', [
            'job_title' => ['invalid'],
        ])->assertUnprocessable()->assertJsonValidationErrors('job_title');

        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $member->id, 'job_title' => null,
        ]);
    }


    public function test_only_owner_can_remove_internal_members_and_owner_and_clients_are_protected(): void
    {
        extract($this->fixture());
        $url = "/api/workspaces/{$workspace->id}/members/";

        $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/members")
            ->assertOk()->assertJsonPath('can_remove_members', true);
        $this->actingAs($admin)->getJson("/api/workspaces/{$workspace->id}/members")
            ->assertOk()->assertJsonPath('can_remove_members', false);

        $this->actingAs($member)->deleteJson($url.$admin->id)->assertForbidden();
        $this->actingAs($outside)->deleteJson($url.$member->id)->assertForbidden();
        $this->actingAs($admin)->deleteJson($url.$member->id)->assertForbidden();

        $this->actingAs($owner)->deleteJson($url.$owner->id)->assertUnprocessable();
        $this->deleteJson($url.$client->id)->assertUnprocessable();
        $this->deleteJson($url.$outside->id)->assertNotFound();

        foreach ([$owner, $admin, $member, $client] as $person) {
            $this->assertDatabaseHas('workspace_members', [
                'workspace_id' => $workspace->id, 'user_id' => $person->id,
            ]);
        }
    }

    public function test_removing_member_revokes_all_scoped_access_but_keeps_tasks_history_and_other_workspaces(): void
    {
        extract($this->fixture());
        $department = Department::create([
            'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
            'lead_user_id' => $member->id,
        ]);
        $department->members()->attach([$member->id, $admin->id]);
        $team = Team::create([
            'workspace_id' => $workspace->id, 'name' => 'Backend',
            'lead_user_id' => $member->id,
        ]);
        $team->members()->attach([$member->id, $admin->id]);

        $project = Project::create([
            'workspace_id' => $workspace->id,
            'client_company_id' => $company->id, 'name' => 'Aplicación',
        ]);
        ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $member->id, 'role' => 'editor',
        ]);
        ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $admin->id, 'role' => 'editor',
        ]);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Sprint']);
        $board->createDefaultColumns();
        $column = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $card = Card::create([
            'board_id' => $board->id, 'column_id' => $column->id,
            'title' => 'Trabajo compartido',
        ]);
        $card->assignees()->attach([$member->id, $admin->id]);
        $checklist = CardChecklistItem::create([
            'card_id' => $card->id, 'body' => 'Revisar implementación',
        ]);
        $checklist->assignees()->attach([$member->id, $admin->id]);
        $onlyMine = Card::create([
            'board_id' => $board->id, 'column_id' => $column->id,
            'title' => 'Tarea pendiente de reasignación',
        ]);
        $onlyMine->assignees()->attach($member->id);
        DB::table('comments')->insert([
            'card_id' => $card->id, 'user_id' => $member->id,
            'body' => 'Comentario histórico', 'is_internal' => true,
        ]);
        DB::table('activities')->insert([
            'card_id' => $card->id, 'user_id' => $member->id,
            'type' => 'assigned',
        ]);

        $otherOwner = User::factory()->create(['is_admin' => false]);
        $otherWorkspace = Workspace::createInitialFor($otherOwner);
        $otherWorkspace->memberships()->create([
            'user_id' => $member->id, 'role' => 'member',
        ]);
        $otherCompany = ClientCompany::create([
            'workspace_id' => $otherWorkspace->id, 'name' => 'Otra empresa',
        ]);
        $otherProject = Project::create([
            'workspace_id' => $otherWorkspace->id,
            'client_company_id' => $otherCompany->id, 'name' => 'Otro proyecto',
        ]);
        ProjectMember::create([
            'project_id' => $otherProject->id, 'user_id' => $member->id, 'role' => 'editor',
        ]);
        $otherDepartment = Department::create([
            'workspace_id' => $otherWorkspace->id, 'name' => 'Otro departamento',
            'lead_user_id' => $member->id,
        ]);
        $otherDepartment->members()->attach($member->id);
        $otherTeam = Team::create([
            'workspace_id' => $otherWorkspace->id, 'name' => 'Otro equipo',
            'lead_user_id' => $member->id,
        ]);
        $otherTeam->members()->attach($member->id);
        $otherBoard = Board::create([
            'project_id' => $otherProject->id, 'name' => 'Otro tablero',
        ]);
        $otherBoard->createDefaultColumns();
        $otherColumn = $otherBoard->columns()->where('workflow_state', 'pending')->firstOrFail();
        $otherCard = Card::create([
            'board_id' => $otherBoard->id, 'column_id' => $otherColumn->id,
            'title' => 'Tarea externa',
        ]);
        $otherCard->assignees()->attach($member->id);
        $otherChecklist = CardChecklistItem::create([
            'card_id' => $otherCard->id, 'body' => 'Checklist externa',
        ]);
        $otherChecklist->assignees()->attach($member->id);
        DB::table('workspace_invitations')->insert([
            [
                'workspace_id' => $workspace->id, 'project_id' => $project->id,
                'recipient_user_id' => $member->id, 'invited_by' => $owner->id,
                'token_hash' => str_repeat('a', 64), 'expires_at' => now()->addWeek(),
                'status' => 'pending',
            ],
            [
                'workspace_id' => $otherWorkspace->id, 'project_id' => $otherProject->id,
                'recipient_user_id' => $member->id, 'invited_by' => $otherOwner->id,
                'token_hash' => str_repeat('b', 64), 'expires_at' => now()->addWeek(),
                'status' => 'pending',
            ],
        ]);

        $this->actingAs($owner)
            ->deleteJson("/api/workspaces/{$workspace->id}/members/{$member->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $member->id,
        ]);
        $this->assertDatabaseMissing('project_members', [
            'project_id' => $project->id, 'user_id' => $member->id,
        ]);
        $this->assertDatabaseMissing('department_user', [
            'department_id' => $department->id, 'user_id' => $member->id,
        ]);
        $this->assertDatabaseMissing('team_user', [
            'team_id' => $team->id, 'user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('departments', [
            'id' => $department->id, 'lead_user_id' => null,
        ]);
        $this->assertDatabaseHas('teams', [
            'id' => $team->id, 'lead_user_id' => null,
        ]);
        $this->assertDatabaseMissing('card_user', [
            'card_id' => $card->id, 'user_id' => $member->id,
        ]);
        $this->assertDatabaseMissing('card_user', [
            'card_id' => $onlyMine->id, 'user_id' => $member->id,
        ]);
        $this->assertDatabaseMissing('card_checklist_item_user', [
            'card_checklist_item_id' => $checklist->id, 'user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('card_user', [
            'card_id' => $card->id, 'user_id' => $admin->id,
        ]);
        $this->assertDatabaseHas('card_checklist_item_user', [
            'card_checklist_item_id' => $checklist->id, 'user_id' => $admin->id,
        ]);
        $this->assertDatabaseHas('cards', ['id' => $card->id, 'title' => 'Trabajo compartido']);
        $this->assertDatabaseHas('cards', ['id' => $onlyMine->id]);
        $this->assertDatabaseHas('card_checklist_items', ['id' => $checklist->id]);
        $this->assertDatabaseHas('comments', [
            'card_id' => $card->id, 'user_id' => $member->id, 'body' => 'Comentario histórico',
        ]);
        $this->assertDatabaseHas('activities', [
            'card_id' => $card->id, 'user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('users', ['id' => $member->id]);
        $this->assertTrue(DB::table('workspace_invitations')
            ->where('workspace_id', $workspace->id)
            ->where('recipient_user_id', $member->id)
            ->whereNotNull('revoked_at')->exists());
        $this->assertTrue(DB::table('workspace_invitations')
            ->where('workspace_id', $otherWorkspace->id)
            ->where('recipient_user_id', $member->id)
            ->whereNull('revoked_at')->exists());
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $otherWorkspace->id, 'user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('project_members', [
            'project_id' => $otherProject->id, 'user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('department_user', [
            'department_id' => $otherDepartment->id, 'user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('team_user', [
            'team_id' => $otherTeam->id, 'user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('departments', [
            'id' => $otherDepartment->id, 'lead_user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('teams', [
            'id' => $otherTeam->id, 'lead_user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('card_user', [
            'card_id' => $otherCard->id, 'user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('card_checklist_item_user', [
            'card_checklist_item_id' => $otherChecklist->id, 'user_id' => $member->id,
        ]);

        $this->actingAs($member)
            ->getJson("/api/projects/{$project->id}/personnel")->assertForbidden();
        $this->getJson("/api/workspaces/{$workspace->id}/members")->assertForbidden();
        $this->actingAs($owner)
            ->getJson("/api/workspaces/{$workspace->id}/members")
            ->assertOk()->assertJsonPath('member_count', 3);

        // Repeating the request is safe: it cannot remove anyone else.
        $this->deleteJson("/api/workspaces/{$workspace->id}/members/{$member->id}")
            ->assertNotFound();
    }

}
