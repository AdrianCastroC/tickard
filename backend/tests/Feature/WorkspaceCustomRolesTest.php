<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Board;
use App\Models\Card;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceCustomRole;
use App\Support\ProjectAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceCustomRolesTest extends TestCase
{
    use RefreshDatabase;

    private function setupWorkspace(): array
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::create(['name' => 'Empresa', 'owner_id' => $owner->id]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        return [$owner, $workspace];
    }

    public function test_owner_can_manage_custom_roles_but_unrelated_users_cannot(): void
    {
        [$owner, $workspace] = $this->setupWorkspace();
        $other = User::factory()->create(['is_admin' => false]);
        $url = "/api/workspaces/{$workspace->id}/roles";
        $this->actingAs($other)->getJson($url)->assertForbidden();
        $this->actingAs($other)->postJson($url, [
            'scope' => 'project', 'name' => 'Coordinador',
            'permissions' => ['project.view', 'cards.edit'],
        ])->assertForbidden();

        $this->actingAs($owner)->postJson($url, [
            'scope' => 'project', 'name' => 'Coordinador',
            'permissions' => ['project.view', 'cards.edit'],
        ])->assertCreated()->assertJsonPath('name', 'Coordinador');
        $this->getJson($url)->assertOk()->assertJsonCount(1, 'roles');
        $id = WorkspaceCustomRole::where('name', 'Coordinador')->value('id');
        $this->patchJson($url.'/'.$id, [
            'name' => 'Coordinador actualizado',
            'permissions' => ['project.view', 'cards.comment'],
        ])->assertOk()->assertJsonPath('name', 'Coordinador actualizado');
    }

    public function test_custom_role_is_workspace_scoped_and_cannot_gain_foreign_permissions(): void
    {
        [$owner, $workspace] = $this->setupWorkspace();
        $url = "/api/workspaces/{$workspace->id}/roles";
        $this->actingAs($owner)->postJson($url, [
            'scope' => 'project', 'name' => 'Externo',
            'permissions' => ['project.view', 'workspace.manage'],
        ])->assertUnprocessable();
        $role = WorkspaceCustomRole::create([
            'workspace_id' => $workspace->id, 'scope' => 'project',
            'name' => 'Lector interno', 'permissions' => ['project.view'],
        ]);
        [$otherOwner, $otherWorkspace] = $this->setupWorkspace();
        $this->actingAs($otherOwner)->patchJson("/api/workspaces/{$otherWorkspace->id}/roles/{$role->id}", [
            'name' => 'Cambiado', 'permissions' => ['project.view'],
        ])->assertNotFound();
        $this->assertSame('Lector interno', $role->fresh()->name);
    }

    public function test_member_permissions_follow_custom_role_and_role_cannot_be_deleted_while_used(): void
    {
        [$owner, $workspace] = $this->setupWorkspace();
        $member = User::factory()->create(['is_admin' => false]);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Tareas']);
        $role = WorkspaceCustomRole::create([
            'workspace_id' => $workspace->id, 'scope' => 'project',
            'name' => 'Editor limitado', 'permissions' => ['project.view', 'cards.comment'],
        ]);
        $this->actingAs($owner)->postJson("/api/projects/{$project->id}/personnel/members", [
            'user_id' => $member->id, 'role' => 'lector', 'custom_role_id' => $role->id,
        ])->assertCreated()->assertJsonPath('custom_role_id', $role->id);
        $this->assertTrue(ProjectAccess::canView($member, $project));
        $this->assertTrue(ProjectAccess::canComment($member, $project));
        $this->assertFalse(ProjectAccess::canEditCards($member, $project));
        $role->update(['permissions' => ['project.view', 'cards.edit']]);
        $this->assertTrue(ProjectAccess::canEditCards($member, $project));
        $this->assertFalse(ProjectAccess::canComment($member, $project));
        $this->actingAs($owner)->deleteJson("/api/workspaces/{$workspace->id}/roles/{$role->id}")
            ->assertUnprocessable();
    }
    public function test_builtin_roles_are_listed_and_protected_roles_cannot_be_disabled(): void
    {
        [$owner, $workspace] = $this->setupWorkspace();
        $url = "/api/workspaces/{$workspace->id}/roles";
        $this->actingAs($owner)->getJson($url)->assertOk()->assertJsonCount(7, 'builtin_roles');
        $this->patchJson($url.'/builtin/owner', ['enabled' => false])->assertUnprocessable();
        $this->patchJson($url.'/builtin/cliente', ['enabled' => false])->assertUnprocessable();
        $this->patchJson($url.'/builtin/editor', ['enabled' => false])
            ->assertOk()->assertJsonPath('enabled', false);
        $this->getJson($url)->assertOk()->assertJsonFragment(['key' => 'editor', 'enabled' => false]);
        $this->patchJson($url.'/builtin/editor', ['enabled' => true])->assertOk();
    }

    public function test_custom_role_can_apply_to_workspace_and_project_and_be_deactivated(): void
    {
        [$owner, $workspace] = $this->setupWorkspace();
        $url = "/api/workspaces/{$workspace->id}/roles";
        $created = $this->actingAs($owner)->postJson($url, [
            'scope' => 'both', 'name' => 'Coordinador mixto',
            'permissions' => ['workspace.view', 'project.view', 'cards.comment', 'workspace.teams'],
        ])->assertCreated()->assertJsonPath('scope', 'both');
        $id = $created->json('id');
        $projectMember = User::factory()->create(['is_admin' => false]);
        $workspace->memberships()->create(['user_id' => $projectMember->id, 'role' => 'member']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Proyecto']);
        $this->postJson("/api/projects/{$project->id}/personnel/members", [
            'user_id' => $projectMember->id, 'role' => 'lector', 'custom_role_id' => $id,
        ])->assertCreated();
        $this->patchJson($url.'/'.$id, [
            'name' => 'Coordinador mixto', 'permissions' => ['workspace.view', 'project.view'],
            'enabled' => false,
        ])->assertOk()->assertJsonPath('enabled', false);
        $this->assertTrue(\App\Support\ProjectAccess::canView($projectMember, $project));
        $next = User::factory()->create(['is_admin' => false]);
        $workspace->memberships()->create(['user_id' => $next->id, 'role' => 'member']);
        $this->postJson("/api/projects/{$project->id}/personnel/members", [
            'user_id' => $next->id, 'role' => 'lector', 'custom_role_id' => $id,
        ])->assertUnprocessable();
    }

    public function test_dual_scope_workspace_configuration_requires_explicit_permission(): void
    {
        [$owner, $workspace] = $this->setupWorkspace();
        $member = User::factory()->create(['is_admin' => false]);
        $role = WorkspaceCustomRole::create([
            'workspace_id' => $workspace->id, 'scope' => 'both', 'name' => 'Gestor mixto',
            'permissions' => ['workspace.view', 'project.view', 'workspace.manage'],
            'enabled' => true,
        ]);
        $workspace->memberships()->create([
            'user_id' => $member->id, 'role' => 'member', 'custom_role_id' => $role->id,
        ]);
        $this->actingAs($member)->patchJson("/api/workspaces/{$workspace->id}", [
            'name' => 'Nombre permitido',
        ])->assertOk();
        $role->update(['permissions' => ['workspace.view', 'project.view']]);
        $this->patchJson("/api/workspaces/{$workspace->id}", [
            'name' => 'Nombre bloqueado',
        ])->assertForbidden();
        $this->assertSame('Nombre permitido', $workspace->fresh()->name);
    }

    public function test_project_member_manager_can_invite_without_project_configuration_permission(): void
    {
        [$owner, $workspace] = $this->setupWorkspace();
        $manager = User::factory()->create(['is_admin' => false]);
        $recipient = User::factory()->create(['is_admin' => false]);
        $workspace->memberships()->create(['user_id' => $manager->id, 'role' => 'member']);
        $workspace->memberships()->create(['user_id' => $recipient->id, 'role' => 'member']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Proyecto']);
        $role = WorkspaceCustomRole::create([
            'workspace_id' => $workspace->id, 'scope' => 'project',
            'name' => 'Gestor de personal', 'permissions' => ['project.view', 'project.members'],
            'enabled' => true,
        ]);
        ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $manager->id,
            'role' => 'lector', 'custom_role_id' => $role->id,
        ]);
        $this->assertFalse(ProjectAccess::canManage($manager, $project));
        $this->assertTrue(ProjectAccess::canManageMembers($manager, $project));
        $this->actingAs($manager)->postJson("/api/projects/{$project->id}/invitations", [
            'recipients' => [$recipient->publicHandle()], 'role' => 'lector',
        ])->assertCreated();
        $role->update(['permissions' => ['project.view']]);
        $this->postJson("/api/projects/{$project->id}/invitations", [
            'recipients' => [$recipient->publicHandle()], 'role' => 'lector',
        ])->assertForbidden();
    }

    public function test_granular_card_permissions_prevent_unapproved_actions(): void
    {
        [$owner, $workspace] = $this->setupWorkspace();
        $member = User::factory()->create(['is_admin' => false]);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Proyecto']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Tablero']);
        $board->createDefaultColumns();
        $pending = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $done = $board->columns()->where('workflow_state', 'done')->firstOrFail();
        $role = WorkspaceCustomRole::create([
            'workspace_id' => $workspace->id, 'scope' => 'project', 'name' => 'Creador limitado',
            'permissions' => ['project.view', 'cards.create'], 'enabled' => true,
        ]);
        ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $member->id,
            'role' => 'lector', 'custom_role_id' => $role->id,
        ]);

        $this->actingAs($member)->postJson("/api/boards/{$board->id}/cards", [
            'column_id' => $pending->id, 'title' => 'Card creada',
        ])->assertCreated();
        $card = Card::where('title', 'Card creada')->firstOrFail();
        $this->patchJson("/api/cards/{$card->id}", ['title' => 'No permitido'])->assertForbidden();
        $this->patchJson("/api/cards/{$card->id}", ['assignee_ids' => [$member->id]])->assertForbidden();
        $this->patchJson("/api/cards/{$card->id}", ['due_date' => '2026-11-01'])->assertForbidden();
        $this->postJson("/api/cards/{$card->id}/move", [
            'column_id' => $done->id, 'position' => 0,
        ])->assertForbidden();
        $this->deleteJson("/api/cards/{$card->id}")->assertForbidden();

        $role->update(['permissions' => ['project.view', 'cards.assign', 'cards.dates', 'cards.state']]);
        $this->patchJson("/api/cards/{$card->id}", ['assignee_ids' => [$member->id]])->assertNoContent();
        $this->patchJson("/api/cards/{$card->id}", ['start_date' => '2026-10-20', 'due_date' => '2026-11-01'])->assertNoContent();
        $this->postJson("/api/cards/{$card->id}/move", [
            'column_id' => $done->id, 'position' => 0,
        ])->assertNoContent();
        $this->postJson("/api/boards/{$board->id}/cards", [
            'column_id' => $pending->id, 'title' => 'No crear',
        ])->assertForbidden();

        $role->update(['permissions' => ['project.view', 'cards.delete']]);
        $this->deleteJson("/api/cards/{$card->id}")->assertNoContent();
    }

    public function test_checklist_permissions_are_enforced_for_individual_fields_and_module_operations(): void
    {
        [$owner, $workspace] = $this->setupWorkspace();
        $user = User::factory()->create(['is_admin' => false]);
        $workspace->memberships()->create(['user_id' => $user->id, 'role' => 'member']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Proyecto']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Sprint']);
        $board->createDefaultColumns();
        $column = $board->columns()->where('workflow_state', 'in_progress')->firstOrFail();
        $card = Card::create(['board_id' => $board->id, 'column_id' => $column->id, 'title' => 'Card']);
        $module = $card->modules()->create(['type' => 'checklist', 'title' => 'Pasos', 'position' => 1]);
        $item = $module->checklistItems()->create([
            'card_id' => $card->id, 'body' => 'Verificar', 'position' => 1,
        ]);
        $role = WorkspaceCustomRole::create([
            'workspace_id' => $workspace->id, 'scope' => 'project',
            'name' => 'Asignador', 'permissions' => ['project.view', 'cards.assign'], 'enabled' => true,
        ]);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $user->id,
            'role' => 'lector', 'custom_role_id' => $role->id]);

        $this->actingAs($user)->patchJson("/api/checklist/{$item->id}", [
            'assignee_ids' => [$user->id],
        ])->assertOk();
        $this->patchJson("/api/checklist/{$item->id}", ['is_done' => true])->assertForbidden();
        $this->patchJson("/api/checklist/{$item->id}", ['due_date' => '2026-11-20'])->assertForbidden();
        $this->postJson("/api/cards/{$card->id}/checklist", [
            'module_id' => $module->id, 'body' => 'Otro',
        ])->assertForbidden();
        $this->deleteJson("/api/modules/{$module->id}")->assertForbidden();

        $role->update(['permissions' => ['project.view', 'cards.dates']]);
        $this->patchJson("/api/checklist/{$item->id}", [
            'due_date' => '2026-11-20',
        ])->assertOk();
        $this->patchJson("/api/checklist/{$item->id}", [
            'assignee_ids' => [$user->id],
        ])->assertForbidden();

        $role->update(['permissions' => ['project.view', 'cards.edit']]);
        $this->patchJson("/api/checklist/{$item->id}", ['is_done' => true])->assertOk();
        $this->postJson("/api/cards/{$card->id}/checklist", [
            'module_id' => $module->id, 'body' => 'Otro',
        ])->assertCreated();
        $this->patchJson("/api/checklist/{$item->id}", [
            'assignee_ids' => [$user->id],
        ])->assertForbidden();
    }

    public function test_card_attachment_removal_requires_uploader_or_project_management(): void
    {
        [$owner, $workspace] = $this->setupWorkspace();
        $uploader = User::factory()->create(['is_admin' => false]);
        $colleague = User::factory()->create(['is_admin' => false]);
        foreach ([$uploader, $colleague] as $person) {
            $workspace->memberships()->create(['user_id' => $person->id, 'role' => 'member']);
        }
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Proyecto']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Tablero']);
        $board->createDefaultColumns();
        $column = $board->columns()->firstOrFail();
        $card = Card::create(['board_id' => $board->id, 'column_id' => $column->id, 'title' => 'Prueba']);
        $role = WorkspaceCustomRole::create([
            'workspace_id' => $workspace->id, 'scope' => 'project',
            'name' => 'Subidor', 'permissions' => ['project.view', 'files.upload'], 'enabled' => true,
        ]);
        foreach ([$uploader, $colleague] as $person) {
            ProjectMember::create(['project_id' => $project->id, 'user_id' => $person->id,
                'role' => 'lector', 'custom_role_id' => $role->id]);
        }
        $attachment = $card->attachments()->create([
            'user_id' => $uploader->id, 'original_name' => 'prueba.txt',
            'disk_path' => 'card-attachments/prueba.txt', 'mime_type' => 'text/plain', 'size' => 12,
        ]);
        $this->actingAs($colleague)->deleteJson("/api/attachments/{$attachment->id}")->assertForbidden();
        $this->actingAs($uploader)->deleteJson("/api/attachments/{$attachment->id}")->assertNoContent();

        $attachment = $card->attachments()->create([
            'user_id' => $uploader->id, 'original_name' => 'otro.txt',
            'disk_path' => 'card-attachments/otro.txt', 'mime_type' => 'text/plain', 'size' => 6,
        ]);
        $role->update(['permissions' => ['project.view', 'files.upload', 'project.manage']]);
        $this->actingAs($colleague)->deleteJson("/api/attachments/{$attachment->id}")->assertNoContent();
    }

}
