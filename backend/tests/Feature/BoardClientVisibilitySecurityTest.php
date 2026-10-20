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

class BoardClientVisibilitySecurityTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $client = User::factory()->create(['is_admin' => false, 'email_verified_at' => now()]);
        $workspace = Workspace::create([
            'name' => 'Agencia', 'owner_id' => $owner->id, 'show_clients' => true,
        ]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Cliente']);
        $workspace->memberships()->create([
            'user_id' => $client->id, 'role' => 'client', 'client_company_id' => $company->id,
        ]);
        $project = Project::create([
            'workspace_id' => $workspace->id, 'name' => 'Proyecto',
            'client_company_id' => $company->id, 'client_access_enabled' => true,
        ]);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $client->id, 'role' => 'cliente']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Tablero']);
        $board->createDefaultColumns();

        return [$owner, $client, $workspace, $project, $board];
    }

    public function test_client_does_not_receive_column_names_containing_only_internal_cards(): void
    {
        [$owner, $client, $workspace, $project, $board] = $this->fixture();
        $private = $board->columns()->where('workflow_state', 'review')->firstOrFail();
        $public = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $private->update(['name' => 'Revisión confidencial']);
        $public->update(['name' => 'Entregas cliente']);
        Card::create([
            'board_id' => $board->id, 'column_id' => $private->id,
            'title' => 'Información privada', 'is_internal' => true, 'created_by' => $owner->id,
        ]);
        Card::create([
            'board_id' => $board->id, 'column_id' => $public->id,
            'title' => 'Entrega pública', 'is_internal' => false, 'created_by' => $owner->id,
        ]);

        $this->actingAs($client)->getJson("/api/boards/{$board->id}/dashboard")
            ->assertOk()->assertJsonCount(1, 'columns')
            ->assertJsonPath('columns.0.name', 'Entregas cliente')
            ->assertJsonMissing(['name' => 'Revisión confidencial']);
        $this->getJson("/api/boards/{$board->id}")
            ->assertOk()->assertJsonCount(1, 'columns')
            ->assertJsonPath('columns.0.name', 'Entregas cliente')
            ->assertJsonMissing(['name' => 'Revisión confidencial']);

        $this->actingAs($owner)->getJson("/api/boards/{$board->id}/dashboard")
            ->assertOk()->assertJsonCount(5, 'columns');
    }

    public function test_project_role_without_view_cannot_read_board_or_dashboard(): void
    {
        [$owner, $client, $workspace, $project, $board] = $this->fixture();
        $member = User::factory()->create(['is_admin' => false]);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $custom = WorkspaceCustomRole::create([
            'workspace_id' => $workspace->id, 'name' => 'Sin lectura',
            'scope' => 'project', 'permissions' => ['cards.comment'], 'enabled' => true,
        ]);
        ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $member->id,
            'role' => 'lector', 'custom_role_id' => $custom->id,
        ]);

        $this->actingAs($member)->getJson("/api/boards/{$board->id}")->assertForbidden();
        $this->getJson("/api/boards/{$board->id}/dashboard")->assertForbidden();

        $this->actingAs($owner)->getJson("/api/boards/{$board->id}")->assertOk();
        $this->getJson("/api/boards/{$board->id}/dashboard")->assertOk();
    }
}
