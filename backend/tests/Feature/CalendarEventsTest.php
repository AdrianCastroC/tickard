<?php

namespace Tests\Feature;

use App\Models\CalendarEvent;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CalendarEventsTest extends TestCase
{
    use RefreshDatabase;

    private function projectWithMember(string $role): array
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $user = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::create(['name' => 'Test', 'owner_id' => $owner->id]);
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Test client']);
        $project = Project::create([
            'workspace_id' => $workspace->id,
            'client_company_id' => $client->id,
            'name' => 'Test project',
        ]);
        $workspace->memberships()->create(['user_id' => $user->id, 'role' => 'member']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $user->id, 'role' => $role]);

        return [$user, $project];
    }

    private function eventData(): array
    {
        return [
            'kind' => 'meeting', 'title' => 'Planificación semanal',
            'description' => 'Revisar entregas', 'location' => 'Sala 2',
            'start_date' => '2026-10-14', 'end_date' => '2026-10-16',
            'all_day' => false, 'start_time' => '09:00', 'end_time' => '12:30',
        ];
    }

    public function test_editor_can_create_find_update_and_delete_a_multiday_event(): void
    {
        [$user, $project] = $this->projectWithMember('editor');
        $uri = "/api/projects/{$project->id}/calendar-events";
        $created = $this->actingAs($user)->postJson($uri, $this->eventData())
            ->assertCreated()
            ->assertJsonPath('title', 'Planificación semanal')
            ->assertJsonPath('end_date', '2026-10-16')
            ->json();
        $this->assertDatabaseHas('calendar_events', ['id' => $created['id'], 'project_id' => $project->id]);

        $this->actingAs($user)->getJson($uri.'?start_date=2026-10-15&end_date=2026-10-15')
            ->assertOk()->assertJsonCount(1);
        $this->actingAs($user)->getJson($uri.'?start_date=2026-10-17&end_date=2026-10-18')
            ->assertOk()->assertJsonCount(0);

        $this->actingAs($user)->patchJson('/api/calendar-events/'.$created['id'], [
            ...$this->eventData(), 'title' => 'Revisión con producto',
            'all_day' => true, 'start_time' => null, 'end_time' => null,
        ])->assertOk()->assertJsonPath('title', 'Revisión con producto')
            ->assertJsonPath('start_time', null);

        $this->actingAs($user)->deleteJson('/api/calendar-events/'.$created['id'])->assertNoContent();
        $this->assertDatabaseCount('calendar_events', 0);
    }

    public function test_reader_can_see_but_cannot_modify_and_client_cannot_see_events(): void
    {
        [$reader, $project] = $this->projectWithMember('lector');
        $client = User::factory()->create(['is_admin' => false]);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $client->id, 'role' => 'cliente']);
        $event = CalendarEvent::create([
            ...$this->eventData(), 'project_id' => $project->id,
        ]);
        $uri = "/api/projects/{$project->id}/calendar-events?start_date=2026-10-14&end_date=2026-10-18";

        $this->actingAs($reader)->getJson($uri)->assertOk()->assertJsonCount(1);
        $this->actingAs($reader)->postJson("/api/projects/{$project->id}/calendar-events", $this->eventData())->assertForbidden();
        $this->actingAs($reader)->deleteJson("/api/calendar-events/{$event->id}")->assertForbidden();

        $this->actingAs($client)->getJson($uri)->assertForbidden();
        $this->actingAs($client)->postJson("/api/projects/{$project->id}/calendar-events", $this->eventData())->assertForbidden();
    }

    public function test_invalid_date_or_time_ranges_are_rejected(): void
    {
        [$editor, $project] = $this->projectWithMember('editor');
        $uri = "/api/projects/{$project->id}/calendar-events";
        $this->actingAs($editor)->postJson($uri, [
            ...$this->eventData(), 'end_date' => '2026-10-13',
        ])->assertUnprocessable();

        $this->actingAs($editor)->postJson($uri, [
            ...$this->eventData(), 'end_date' => '2026-10-14', 'end_time' => '08:30',
        ])->assertUnprocessable();

        $this->actingAs($editor)->getJson($uri.'?start_date=2026-01-01&end_date=2026-12-31')
            ->assertUnprocessable();
    }

    public function test_events_are_isolated_between_projects(): void
    {
        [$user, $first] = $this->projectWithMember('editor');
        [$other, $second] = $this->projectWithMember('editor');
        $event = CalendarEvent::create([...$this->eventData(), 'project_id' => $first->id]);
        $uri = "/api/projects/{$second->id}/calendar-events?start_date=2026-10-01&end_date=2026-10-31";

        $this->actingAs($other)->getJson($uri)->assertOk()->assertJsonCount(0);
        $this->actingAs($other)->patchJson("/api/calendar-events/{$event->id}", $this->eventData())->assertForbidden();
        $this->actingAs($user)->getJson($uri)->assertForbidden();
    }
}
