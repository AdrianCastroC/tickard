<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectCalendarAssignmentsTest extends TestCase
{
    use RefreshDatabase;

    private function project(): array
    {
        $admin = User::factory()->create(['is_admin' => true, 'name' => 'Admin']);
        $editor = User::factory()->create(['is_admin' => false, 'name' => 'Editor']);
        $colleague = User::factory()->create(['is_admin' => false, 'name' => 'Colleague']);
        $workspace = Workspace::create(['name' => 'Demo', 'owner_id' => $admin->id]);
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Aster']);
        $project = Project::create(['workspace_id' => $workspace->id, 'client_company_id' => $client->id, 'name' => 'Nébula']);
        $workspace->memberships()->create(['user_id' => $editor->id, 'role' => 'member']);
        $workspace->memberships()->create(['user_id' => $colleague->id, 'role' => 'member']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $editor->id, 'role' => 'editor']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $colleague->id, 'role' => 'lector']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'General']);
        $column = $board->columns()->create(['name' => 'Pendiente', 'workflow_state' => 'pending', 'position' => 0]);

        $mine = Card::create([
            'board_id' => $board->id, 'column_id' => $column->id,
            'title' => 'Mi tarea', 'created_by' => $admin->id,
            'start_date' => '2026-10-14', 'due_date' => '2026-10-20',
        ]);
        $mine->assignees()->attach($editor->id);
        $shared = Card::create([
            'board_id' => $board->id, 'column_id' => $column->id,
            'title' => 'Compartida', 'created_by' => $admin->id,
            'start_date' => '2026-10-15', 'due_date' => '2026-10-20',
        ]);
        $shared->assignees()->attach([$editor->id, $colleague->id]);
        $other = Card::create([
            'board_id' => $board->id, 'column_id' => $column->id,
            'title' => 'De otro', 'created_by' => $admin->id,
            'start_date' => '2026-10-16', 'due_date' => '2026-10-20',
        ]);
        $other->assignees()->attach($colleague->id);
        Card::create([
            'board_id' => $board->id, 'column_id' => $column->id,
            'title' => 'Sin asignar', 'created_by' => $admin->id,
            'start_date' => '2026-10-17', 'due_date' => '2026-10-20',
        ]);

        return [$admin, $editor, $colleague, $board];
    }

    public function test_non_admin_calendar_only_includes_explicitly_assigned_cards(): void
    {
        [, $editor, , $board] = $this->project();
        $data = $this->actingAs($editor)->getJson("/api/boards/{$board->id}?calendar=1")
            ->assertOk()->assertJsonCount(2, 'columns.0.cards')->json();
        $titles = collect($data['columns'][0]['cards'])->pluck('title')->all();
        $this->assertEqualsCanonicalizing(['Mi tarea', 'Compartida'], $titles);
        $this->assertArrayNotHasKey('dependencies', $data['columns'][0]['cards'][0]);
        $this->assertArrayNotHasKey('comments', $data['columns'][0]['cards'][0]);

        // This scoping is only for the calendar: the existing full Kanban
        // and project Gantt responses must continue returning all four Cards.
        $this->actingAs($editor)->getJson("/api/boards/{$board->id}")
            ->assertOk()->assertJsonCount(4, 'columns.0.cards');
        $this->actingAs($editor)->getJson("/api/boards/{$board->id}?gantt=1")
            ->assertOk()->assertJsonCount(4, 'columns.0.cards');
        // Calendar semantics take priority when both flags are present.
        $this->actingAs($editor)->getJson("/api/boards/{$board->id}?calendar=1&gantt=1")
            ->assertOk()->assertJsonCount(2, 'columns.0.cards');
    }

    public function test_admin_can_see_every_card_and_all_assignees(): void
    {
        [$admin, , $colleague, $board] = $this->project();
        $data = $this->actingAs($admin)->getJson("/api/boards/{$board->id}?calendar=1")
            ->assertOk()->assertJsonCount(4, 'columns.0.cards')->json();

        $shared = collect($data['columns'][0]['cards'])->firstWhere('title', 'Compartida');
        $this->assertCount(2, $shared['assignees']);
        $this->assertContains($colleague->id, collect($shared['assignees'])->pluck('id')->all());
        $this->assertArrayHasKey('avatar_url', $shared['assignees'][0]);
        $this->assertArrayHasKey('avatar_url', $data['members'][0]);

        $unassigned = collect($data['columns'][0]['cards'])->firstWhere('title', 'Sin asignar');
        $this->assertSame([], $unassigned['assignees']);
    }

    public function test_project_responsable_can_see_every_card_without_global_admin_flag(): void
    {
        [, , $colleague, $board] = $this->project();
        $responsable = User::factory()->create(['is_admin' => false]);
        $board->project->workspace->memberships()->create(['user_id' => $responsable->id, 'role' => 'member']);
        ProjectMember::create(['project_id' => $board->project_id, 'user_id' => $responsable->id, 'role' => 'responsable']);

        $data = $this->actingAs($responsable)->getJson("/api/boards/{$board->id}?calendar=1")
            ->assertOk()->assertJsonPath('role', 'responsable')
            ->assertJsonCount(4, 'columns.0.cards')
            ->json();

        $shared = collect($data['columns'][0]['cards'])->firstWhere('title', 'Compartida');
        $this->assertCount(2, $shared['assignees']);
        $this->assertContains($colleague->id, collect($shared['assignees'])->pluck('id')->all());
        $unassigned = collect($data['columns'][0]['cards'])->firstWhere('title', 'Sin asignar');
        $this->assertSame([], $unassigned['assignees']);
    }

    public function test_non_admin_editor_without_assignments_sees_no_cards(): void
    {
        [, , , $board] = $this->project();
        $editor = User::factory()->create(['is_admin' => false]);
        $board->project->workspace->memberships()->create(['user_id' => $editor->id, 'role' => 'member']);
        ProjectMember::create(['project_id' => $board->project_id, 'user_id' => $editor->id, 'role' => 'editor']);
        $this->actingAs($editor)->getJson("/api/boards/{$board->id}?calendar=1")
            ->assertOk()->assertJsonCount(0, 'columns.0.cards');
    }

    public function test_non_admin_reader_sees_only_own_assigned_cards(): void
    {
        [, , $reader, $board] = $this->project();
        $data = $this->actingAs($reader)->getJson("/api/boards/{$board->id}?calendar=1")
            ->assertOk()->assertJsonCount(2, 'columns.0.cards')->json();

        $this->assertEqualsCanonicalizing(
            ['Compartida', 'De otro'],
            collect($data['columns'][0]['cards'])->pluck('title')->all()
        );
    }
}
