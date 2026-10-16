<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Card;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\User;
use App\Models\Workspace;
use App\Support\Notifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class NotificationsInboxTest extends TestCase
{
    use RefreshDatabase;

    private function projectWithCard(User $owner): array
    {
        $workspace = Workspace::createInitialFor($owner);
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Cliente']);
        $project = Project::create([
            'workspace_id' => $workspace->id,
            'client_company_id' => $client->id,
            'name' => 'Proyecto',
        ]);
        $board = $project->boards()->create(['name' => 'Tablero', 'position' => 0]);
        $board->createDefaultColumns();
        $column = $board->columns()->where('workflow_state', 'pending')->firstOrFail();
        $card = Card::create([
            'board_id' => $board->id, 'column_id' => $column->id,
            'title' => 'Preparar entrega', 'priority' => 'media', 'is_internal' => false,
        ]);
        return [$workspace, $project, $board, $card];
    }

    public function test_notifications_require_authentication_and_only_belong_to_their_recipient(): void
    {
        $this->getJson('/api/notifications')->assertUnauthorized();

        $user = User::factory()->create(['notify_email' => false]);
        $other = User::factory()->create();
        $own = AppNotification::create(['user_id' => $user->id, 'body' => 'Mensaje para ti']);
        $someoneElses = AppNotification::create(['user_id' => $other->id, 'body' => 'Secreto']);

        $this->actingAs($user)->getJson('/api/notifications')->assertOk()
            ->assertJsonCount(1)->assertJsonPath('0.body', 'Mensaje para ti')
            ->assertJsonPath('0.read_at', null);

        $this->postJson("/api/notifications/{$someoneElses->id}/read")->assertNotFound();
        $this->postJson("/api/notifications/{$own->id}/read")->assertNoContent();
        $this->assertNotNull($own->fresh()->read_at);
        $this->assertNull($someoneElses->fresh()->read_at);
    }

    public function test_read_all_only_marks_the_authenticated_users_notifications(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        AppNotification::create(['user_id' => $user->id, 'body' => 'Uno']);
        AppNotification::create(['user_id' => $user->id, 'body' => 'Dos']);
        $otherNote = AppNotification::create(['user_id' => $other->id, 'body' => 'Otro']);

        $this->actingAs($user)->postJson('/api/notifications/read')->assertNoContent();
        $this->assertSame(0, AppNotification::where('user_id', $user->id)->whereNull('read_at')->count());
        $this->assertNull($otherNote->fresh()->read_at);
    }

    public function test_new_card_notifications_include_direct_navigation_context(): void
    {
        Mail::fake();
        $owner = User::factory()->create(['is_admin' => false, 'notify_email' => false, 'notify_in_app' => true]);
        [$workspace, $project, $board, $card] = $this->projectWithCard($owner);

        Notifier::send($owner, 'Te han asignado «Preparar entrega».', $card, 'assignment');

        $this->actingAs($owner)->getJson('/api/notifications')->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.kind', 'assignment')
            ->assertJsonPath('0.card.id', $card->id)
            ->assertJsonPath('0.card.board_id', $board->id)
            ->assertJsonPath('0.card.project_id', $project->id)
            ->assertJsonPath('0.card.workspace_id', $workspace->id);
    }

    public function test_card_notifications_stop_being_visible_if_project_access_is_removed(): void
    {
        Mail::fake();
        $owner = User::factory()->create(['is_admin' => false]);
        [$workspace, $project, , $card] = $this->projectWithCard($owner);
        $member = User::factory()->create(['is_admin' => false, 'notify_email' => false, 'notify_in_app' => true]);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $membership = $project->members()->create(['user_id' => $member->id, 'role' => 'editor']);

        Notifier::send($member, 'Una tarjeta del proyecto', $card, 'assignment');
        $this->actingAs($member)->getJson('/api/notifications')->assertOk()->assertJsonCount(1);

        $membership->delete();
        $this->getJson('/api/notifications')->assertOk()->assertJsonCount(0);
    }

    public function test_client_cannot_see_internal_card_notifications(): void
    {
        Mail::fake();
        $owner = User::factory()->create(['is_admin' => false]);
        [$workspace, $project, , $card] = $this->projectWithCard($owner);
        $workspace->update(['show_clients' => true]);
        $project->update(['client_access_enabled' => true]);
        $member = User::factory()->create(['is_admin' => false, 'notify_email' => false, 'notify_in_app' => true,
            'client_company_id' => $project->client_company_id]);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $project->members()->create(['user_id' => $member->id, 'role' => 'cliente']);

        Notifier::send($member, 'Tarjeta pública', $card, 'comment');
        $this->actingAs($member)->getJson('/api/notifications')->assertOk()->assertJsonCount(1);

        $card->update(['is_internal' => true]);
        $this->getJson('/api/notifications')->assertOk()->assertJsonCount(0);
    }
}
