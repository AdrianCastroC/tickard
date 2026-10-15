<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MyTasksTest extends TestCase
{
    use RefreshDatabase;

    private function project(Workspace $workspace, string $name): array
    {
        $client = ClientCompany::firstOrCreate([
            'workspace_id' => $workspace->id, 'name' => $name.' cliente',
        ]);
        $project = Project::create([
            'workspace_id' => $workspace->id, 'client_company_id' => $client->id, 'name' => $name,
        ]);
        $board = $project->boards()->create(['name' => $name.' tablero', 'position' => 0]);
        $board->createDefaultColumns();

        return [$project, $board];
    }

    private function assigned(User $user, $board, string $title, string $state = 'pending', array $attributes = []): Card
    {
        $column = $board->columns()->where('workflow_state', $state)->firstOrFail();
        $card = Card::create(array_merge([
            'board_id' => $board->id, 'column_id' => $column->id,
            'title' => $title, 'priority' => 'media', 'is_internal' => true,
        ], $attributes));
        $card->assignees()->attach($user->id);
        return $card;
    }

    public function test_my_tasks_requires_authentication(): void
    {
        $this->getJson('/api/my/tasks')->assertUnauthorized();
    }

    public function test_only_assigned_accessible_non_archived_cards_are_returned_across_workspaces(): void
    {
        $user = User::factory()->create(['is_admin' => false]);
        $firstWorkspace = Workspace::createInitialFor($user);
        [$projectA, $boardA] = $this->project($firstWorkspace, 'Proyecto A');

        $otherOwner = User::factory()->create();
        $secondWorkspace = Workspace::createInitialFor($otherOwner);
        $secondWorkspace->memberships()->create(['user_id' => $user->id, 'role' => 'member']);
        [$projectB, $boardB] = $this->project($secondWorkspace, 'Proyecto B');
        $projectB->members()->create(['user_id' => $user->id, 'role' => 'editor']);

        $outsideOwner = User::factory()->create();
        [$outsideProject, $outsideBoard] = $this->project(Workspace::createInitialFor($outsideOwner), 'Privado');

        $cardA = $this->assigned($user, $boardA, 'Mi tarjeta A', 'in_progress');
        $cardB = $this->assigned($user, $boardB, 'Mi tarjeta B');
        $this->assigned($user, $outsideBoard, 'Fuera del Workspace');
        $archived = $this->assigned($user, $boardB, 'Archivada', 'pending', [
            'archived_at' => now(),
        ]);
        $otherCard = Card::create([
            'board_id' => $boardA->id, 'column_id' => $boardA->columns()->first()->id,
            'title' => 'Sin asignar', 'priority' => 'media',
        ]);

        $response = $this->actingAs($user)->getJson('/api/my/tasks')->assertOk()
            ->assertJsonPath('summary.total', 2)
            ->assertJsonPath('pagination.total', 2)
            ->assertJsonCount(2, 'tasks')
            ->assertJsonCount(2, 'scopes');
        $ids = collect($response->json('tasks'))->pluck('id')->all();
        $this->assertEqualsCanonicalizing([$cardA->id, $cardB->id], $ids);
        $this->assertNotContains($archived->id, $ids);
        $this->assertNotContains($otherCard->id, $ids);
        $this->assertSame($projectB->id, collect($response->json('tasks'))->firstWhere('id', $cardB->id)['project_id']);

        // An explicit project filter never circumvents permissions.
        $this->getJson('/api/my/tasks?project_id='.$outsideProject->id)
            ->assertOk()->assertJsonCount(0, 'tasks');
    }

    public function test_filters_summary_overdue_priority_and_search(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        [$project, $board] = $this->project($workspace, 'Alpha');
        $late = $this->assigned($owner, $board, 'Entrega urgente', 'in_progress', [
            'due_date' => now()->subDays(2)->toDateString(), 'priority' => 'urgente',
        ]);
        $this->assigned($owner, $board, 'Planificar campaña', 'pending', [
            'due_date' => now()->addDays(5)->toDateString(),
        ]);
        $this->assigned($owner, $board, 'Completada', 'done', [
            'due_date' => now()->subDays(8)->toDateString(),
        ]);
        $this->assigned($owner, $board, 'Backlog sin fecha', 'backlog');

        $this->actingAs($owner)->getJson('/api/my/tasks')
            ->assertOk()->assertJsonPath('summary.total', 4)
            ->assertJsonPath('summary.overdue', 1)
            ->assertJsonPath('summary.done', 1);

        $response = $this->getJson('/api/my/tasks?state=overdue&priority=urgente&q=Entrega')
            ->assertOk()->assertJsonPath('pagination.total', 1)
            ->assertJsonPath('tasks.0.id', $late->id)
            ->assertJsonPath('tasks.0.overdue', true);
        $this->assertSame(4, $response->json('summary.total'));

        $this->getJson('/api/my/tasks?state=done')->assertOk()
            ->assertJsonPath('pagination.total', 1);
        $this->getJson('/api/my/tasks?workspace_id='.$workspace->id.'&project_id='.$project->id)
            ->assertOk()->assertJsonPath('pagination.total', 4);
        $this->getJson('/api/my/tasks?state=not-a-state')->assertUnprocessable();
    }

    public function test_client_only_sees_assigned_public_cards_and_removed_project_access_is_respected(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        [$project, $board] = $this->project($workspace, 'Proyecto cliente');
        $client = User::factory()->create(['is_admin' => false]);
        $workspace->memberships()->create(['user_id' => $client->id, 'role' => 'member']);
        $membership = $project->members()->create(['user_id' => $client->id, 'role' => 'cliente']);

        $this->assigned($client, $board, 'Incidencia interna', 'pending', ['is_internal' => true]);
        $public = $this->assigned($client, $board, 'Incidencia pública', 'pending', ['is_internal' => false]);

        $this->actingAs($client)->getJson('/api/my/tasks')->assertOk()
            ->assertJsonPath('summary.total', 1)
            ->assertJsonPath('tasks.0.id', $public->id)
            ->assertJsonMissing(['title' => 'Incidencia interna']);

        $membership->delete();
        $this->getJson('/api/my/tasks')->assertOk()->assertJsonCount(0, 'tasks')
            ->assertJsonCount(0, 'scopes');
    }

    public function test_list_is_paginated_without_loading_entire_boards(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        [, $board] = $this->project($workspace, 'Volumen');

        foreach (range(1, 34) as $number) {
            $this->assigned($owner, $board, 'Tarea '.$number);
        }

        $this->actingAs($owner)->getJson('/api/my/tasks?page=1')->assertOk()
            ->assertJsonCount(30, 'tasks')->assertJsonPath('pagination.total', 34)
            ->assertJsonPath('pagination.last_page', 2);
        $this->getJson('/api/my/tasks?page=2')->assertOk()
            ->assertJsonCount(4, 'tasks')->assertJsonPath('pagination.page', 2);
    }
}
