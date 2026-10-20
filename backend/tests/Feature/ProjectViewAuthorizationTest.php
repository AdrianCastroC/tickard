<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\CalendarEvent;
use App\Models\Card;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceCustomRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProjectViewAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_custom_role_without_project_view_cannot_read_personnel_or_calendar(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $member = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Privado']);

        $role = WorkspaceCustomRole::create([
            'workspace_id' => $workspace->id,
            'scope' => 'project',
            'name' => 'Restringido',
            'permissions' => ['cards.comment'],
            'enabled' => true,
        ]);
        ProjectMember::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'role' => 'lector',
            'custom_role_id' => $role->id,
        ]);

        $board = Board::create(['project_id' => $project->id, 'name' => 'Confidencial']);
        $board->createDefaultColumns();
        Card::create([
            'board_id' => $board->id,
            'column_id' => $board->columns()->firstOrFail()->id,
            'title' => 'Información privada',
        ]);

        $personnelUrl = "/api/projects/{$project->id}/personnel";
        $calendarUrl = "/api/projects/{$project->id}/calendar-events?start_date=2026-10-01&end_date=2026-10-31";

        $this->actingAs($member)->getJson($personnelUrl)->assertForbidden();
        $this->getJson($calendarUrl)->assertForbidden();

        $this->actingAs($owner)->getJson($personnelUrl)->assertOk();
        $this->getJson($calendarUrl)->assertOk();
    }

    public function test_revoked_builtin_project_view_denies_personnel_and_calendar(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $editor = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $workspace->memberships()->create(['user_id' => $editor->id, 'role' => 'member']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Privado']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $editor->id, 'role' => 'editor']);
        DB::table('workspace_role_settings')->insert([
            'workspace_id' => $workspace->id,
            'role_key' => 'editor',
            'permissions' => json_encode(['cards.comment']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($editor)
            ->getJson("/api/projects/{$project->id}/personnel")->assertForbidden();
        $this->getJson("/api/projects/{$project->id}/calendar-events?start_date=2026-10-01&end_date=2026-10-31")
            ->assertForbidden();
    }
}
