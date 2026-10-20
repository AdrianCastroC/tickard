<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GlobalHomeTest extends TestCase
{
    use RefreshDatabase;

    private function makeProject(Workspace $workspace, string $name): array
    {
        $client = ClientCompany::create([
            'workspace_id' => $workspace->id,
            'name' => $name.' cliente',
        ]);
        $project = Project::create([
            'workspace_id' => $workspace->id,
            'client_company_id' => $client->id,
            'name' => $name,
        ]);
        $board = $project->boards()->create(['name' => 'Principal', 'position' => 0]);
        $board->createDefaultColumns();
        return [$project, $board];
    }

    private function card($board, string $title, string $state, bool $internal = false, bool $archived = false): Card
    {
        return Card::create([
            'board_id' => $board->id,
            'column_id' => $board->columns()->where('workflow_state', $state)->firstOrFail()->id,
            'title' => $title,
            'priority' => 'media',
            'is_internal' => $internal,
            'archived_at' => $archived ? now() : null,
        ]);
    }

    public function test_projects_require_authentication(): void
    {
        $this->getJson('/api/my/home/projects')->assertUnauthorized();
    }

    public function test_only_accessible_projects_across_workspaces_are_listed_with_real_progress(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        [$visibleProject, $visibleBoard] = $this->makeProject($workspace, 'Visible');
        [$hiddenProject] = $this->makeProject($workspace, 'No autorizado');

        $member = User::factory()->create(['is_admin' => false]);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $visibleProject->members()->create(['user_id' => $member->id, 'role' => 'editor']);

        $this->card($visibleBoard, 'Finalizada', 'done');
        $this->card($visibleBoard, 'Pendiente', 'pending');
        $this->card($visibleBoard, 'Archivada', 'done', false, true);

        $secondOwner = User::factory()->create(['is_admin' => false]);
        $secondWorkspace = Workspace::createInitialFor($secondOwner);
        [$secondProject] = $this->makeProject($secondWorkspace, 'Segundo espacio');
        $secondWorkspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $secondProject->members()->create(['user_id' => $member->id, 'role' => 'lector']);

        $thirdOwner = User::factory()->create(['is_admin' => false]);
        [$privateProject] = $this->makeProject(Workspace::createInitialFor($thirdOwner), 'Otro privado');

        $response = $this->actingAs($member)->getJson('/api/my/home/projects')
            ->assertOk()->assertJsonCount(2, 'projects')->assertJsonPath('has_more', false);
        $projects = collect($response->json('projects'))->keyBy('id');
        $this->assertArrayHasKey($visibleProject->id, $projects->all());
        $this->assertArrayHasKey($secondProject->id, $projects->all());
        $this->assertArrayNotHasKey($hiddenProject->id, $projects->all());
        $this->assertArrayNotHasKey($privateProject->id, $projects->all());
        $this->assertSame('editor', $projects[$visibleProject->id]['role']);
        $this->assertSame('lector', $projects[$secondProject->id]['role']);
        $this->assertSame(1, $projects[$visibleProject->id]['board_count']);
        $this->assertSame(2, $projects[$visibleProject->id]['card_count']);
        $this->assertSame(1, $projects[$visibleProject->id]['completed_count']);
        $this->assertSame(0, $projects[$secondProject->id]['card_count']);
    }

    public function test_workspace_owner_sees_own_projects_even_without_project_membership(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        [$project] = $this->makeProject($workspace, 'Propietario');

        $this->actingAs($owner)->getJson('/api/my/home/projects')->assertOk()
            ->assertJsonCount(1, 'projects')
            ->assertJsonPath('projects.0.id', $project->id)
            ->assertJsonPath('projects.0.role', 'responsable');
    }

    public function test_client_project_progress_never_includes_internal_cards(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        [$project, $board] = $this->makeProject($workspace, 'Cliente');
        $client = User::factory()->create(['is_admin' => false, 'email_verified_at' => now()]);
        $workspace->update(['show_clients' => true]);
        $project->update(['client_access_enabled' => true]);
        $workspace->memberships()->create([
            'user_id' => $client->id, 'role' => 'client',
            'client_company_id' => $project->client_company_id,
        ]);
        $project->members()->create(['user_id' => $client->id, 'role' => 'cliente']);

        $this->card($board, 'Visible completa', 'done');
        $this->card($board, 'Interna pendiente', 'pending', true);
        $this->card($board, 'Interna completa', 'done', true);

        $this->actingAs($client)->getJson('/api/my/home/projects')->assertOk()
            ->assertJsonCount(1, 'projects')
            ->assertJsonPath('projects.0.role', 'cliente')
            ->assertJsonPath('projects.0.card_count', 1)
            ->assertJsonPath('projects.0.completed_count', 1);
    }

    public function test_global_admin_still_needs_membership_in_the_workspace(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $included = Workspace::createInitialFor($admin);
        [$allowed] = $this->makeProject($included, 'Permitido');

        $otherOwner = User::factory()->create();
        $excluded = Workspace::createInitialFor($otherOwner);
        [$denied] = $this->makeProject($excluded, 'Ajeno');

        $this->actingAs($admin)->getJson('/api/my/home/projects')->assertOk()
            ->assertJsonCount(1, 'projects')->assertJsonPath('projects.0.id', $allowed->id)
            ->assertJsonMissing(['id' => $denied->id]);
    }
}
