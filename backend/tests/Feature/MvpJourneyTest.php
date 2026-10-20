<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\Project;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Smoke test through actual API routes, rather than directly creating domain
 * entities. It protects the essential new-user-to-first-card MVP journey.
 */
class MvpJourneyTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_to_first_project_board_and_card_then_logout(): void
    {
        $registration = $this->postJson('/api/register', [
            'first_name' => 'Eva',
            'email' => 'eva.mvp@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated()->assertJsonStructure(['token', 'user']);

        $token = $registration->json('token');
        $this->withToken($token);
        $user = User::where('email', 'eva.mvp@example.com')->firstOrFail();
        $workspace = Workspace::where('owner_id', $user->id)->firstOrFail();

        $this->getJson('/api/me?workspace_id='.$workspace->id)
            ->assertOk()->assertJsonPath('user.email', 'eva.mvp@example.com');

        $created = $this->postJson('/api/projects', [
            'workspace_id' => $workspace->id,
            'name' => 'Primer proyecto',
        ])->assertCreated();
        $project = Project::where('workspace_id', $workspace->id)->where('name', 'Primer proyecto')->firstOrFail();
        $this->assertSame($project->id, $created->json('id'));

        $board = Board::where('project_id', $project->id)->firstOrFail();
        $pending = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $newCard = $this->postJson('/api/boards/'.$board->id.'/cards', [
            'column_id' => $pending->id,
            'title' => 'Primera tarea',
        ])->assertCreated()->assertJsonStructure(['id']);
        $cardId = $newCard->json('id');
        $this->assertSame('Primera tarea', Card::findOrFail($cardId)->title);

        $this->patchJson('/api/cards/'.$cardId, ['title' => 'Tarea actualizada'])
            ->assertNoContent();
        $this->assertSame('Tarea actualizada', Card::findOrFail($cardId)->title);
        $this->getJson('/api/boards/'.$board->id)->assertOk();

        $this->postJson('/api/logout')->assertNoContent();
        $this->getJson('/api/me')->assertUnauthorized();
    }

    public function test_other_account_cannot_change_or_see_an_unshared_project(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $outsider = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::create(['name' => 'Privado', 'owner_id' => $owner->id]);
        $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Confidencial']);

        $this->actingAs($outsider)->getJson('/api/projects/'.$project->id.'/settings')
            ->assertForbidden();
        $this->postJson('/api/projects/'.$project->id.'/boards', ['name' => 'Intruso'])
            ->assertForbidden();
    }
}
