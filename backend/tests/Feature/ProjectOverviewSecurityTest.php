<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceCustomRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectOverviewSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_summary_and_board_overview_require_effective_project_view(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $member = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Reservado']);
        $role = WorkspaceCustomRole::create([
            'workspace_id' => $workspace->id, 'scope' => 'project', 'name' => 'Sin lectura',
            'permissions' => ['cards.comment'], 'enabled' => true,
        ]);
        ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $member->id,
            'role' => 'lector', 'custom_role_id' => $role->id,
        ]);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Confidencial']);
        $board->createDefaultColumns();

        $this->actingAs($member)
            ->getJson("/api/projects/{$project->id}/dashboard")->assertForbidden();
        $this->getJson("/api/projects/{$project->id}/boards/overview")->assertForbidden();

        $this->actingAs($owner)
            ->getJson("/api/projects/{$project->id}/dashboard")->assertOk();
        $this->getJson("/api/projects/{$project->id}/boards/overview")->assertOk();
    }

    public function test_client_overview_hides_columns_without_visible_cards(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $client = User::factory()->create(['is_admin' => false, 'email_verified_at' => now()]);
        $workspace = Workspace::create(['name' => 'Agencia', 'owner_id' => $owner->id, 'show_clients' => true]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Empresa']);
        $workspace->memberships()->create([
            'user_id' => $client->id, 'role' => 'client', 'client_company_id' => $company->id,
        ]);
        $project = Project::create([
            'workspace_id' => $workspace->id, 'client_company_id' => $company->id,
            'client_access_enabled' => true, 'name' => 'Portal',
        ]);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $client->id, 'role' => 'cliente']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Trabajo']);
        $board->createDefaultColumns();
        $secretColumn = $board->columns()->where('workflow_state', 'review')->firstOrFail();
        $secretColumn->update(['name' => 'Aprobación interna']);
        $visibleColumn = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $visibleColumn->update(['name' => 'Trabajo del cliente']);
        Card::create([
            'board_id' => $board->id, 'column_id' => $secretColumn->id,
            'title' => 'Nota interna', 'is_internal' => true, 'created_by' => $owner->id,
        ]);
        Card::create([
            'board_id' => $board->id, 'column_id' => $visibleColumn->id,
            'title' => 'Nota pública', 'is_internal' => false, 'created_by' => $owner->id,
        ]);

        $this->actingAs($client)->getJson("/api/projects/{$project->id}/boards/overview")
            ->assertOk()
            ->assertJsonCount(1, 'boards.0.columns')
            ->assertJsonPath('boards.0.columns.0.name', 'Trabajo del cliente')
            ->assertJsonMissing(['name' => 'Aprobación interna']);

        $this->actingAs($owner)->getJson("/api/projects/{$project->id}/boards/overview")
            ->assertOk()->assertJsonCount(5, 'boards.0.columns');
    }
}
