<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Support\ProjectAccess;
use App\Support\WorkspaceClientAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrphanClientIsolationSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_orphan_client_membership_cannot_become_internal_workspace_or_project_user(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $client = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::create([
            'name' => 'Agencia', 'owner_id' => $owner->id, 'show_clients' => true,
        ]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        // Represents older data with missing/removed company relationship.
        $workspace->memberships()->create([
            'user_id' => $client->id, 'role' => 'client', 'client_company_id' => null,
        ]);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Privado']);
        ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $client->id, 'role' => 'editor',
        ]);

        $this->assertTrue(WorkspaceClientAccess::isClient($client, $workspace));
        $this->assertNull(ProjectAccess::role($client, $project));
        $this->assertFalse(ProjectAccess::canView($client, $project));

        $this->actingAs($client)->getJson("/api/teams?workspace_id={$workspace->id}")
            ->assertForbidden();
        $this->getJson("/api/departments?workspace_id={$workspace->id}")
            ->assertForbidden();
        $this->getJson("/api/clients?workspace_id={$workspace->id}")
            ->assertForbidden();
        $this->getJson("/api/workspaces/{$workspace->id}/roles")->assertForbidden();
        $this->getJson("/api/projects/{$project->id}/dashboard")->assertForbidden();
        $this->getJson('/api/my/home/projects')->assertOk()->assertJsonCount(0, 'projects');

        $this->actingAs($owner)->getJson("/api/teams?workspace_id={$workspace->id}")
            ->assertOk();
    }
}
