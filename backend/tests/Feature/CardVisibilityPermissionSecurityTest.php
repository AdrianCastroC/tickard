<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Board;
use App\Models\Card;
use App\Models\CardAttachment;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceCustomRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CardVisibilityPermissionSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_role_without_view_cannot_download_card_attachment_or_read_card_notifications(): void
    {
        Storage::fake('local');
        $owner = User::factory()->create(['is_admin' => false]);
        $member = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Confidencial']);
        $custom = WorkspaceCustomRole::create([
            'workspace_id' => $workspace->id, 'scope' => 'project',
            'name' => 'Sin lectura', 'permissions' => ['cards.comment'], 'enabled' => true,
        ]);
        ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $member->id,
            'role' => 'lector', 'custom_role_id' => $custom->id,
        ]);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Trabajo']);
        $board->createDefaultColumns();
        $card = Card::create([
            'board_id' => $board->id,
            'column_id' => $board->columns()->firstOrFail()->id,
            'title' => 'Documento interno', 'is_internal' => false,
        ]);
        Storage::disk('local')->put('card-attachments/private.txt', 'contenido confidencial');
        $attachment = CardAttachment::create([
            'card_id' => $card->id, 'user_id' => $owner->id,
            'disk_path' => 'card-attachments/private.txt',
            'original_name' => 'private.txt', 'mime_type' => 'text/plain', 'size' => 21,
        ]);
        AppNotification::create([
            'user_id' => $member->id, 'card_id' => $card->id,
            'kind' => 'comment', 'body' => 'Comentario de tarjeta privada',
        ]);
        AppNotification::create([
            'user_id' => $member->id, 'kind' => 'invitation',
            'body' => 'Una invitación independiente',
        ]);

        $this->actingAs($member)->getJson("/api/attachments/{$attachment->id}/content")
            ->assertForbidden();

        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonMissing(['body' => 'Comentario de tarjeta privada'])
            ->assertJsonFragment(['body' => 'Una invitación independiente']);

        $this->actingAs($owner)->get("/api/attachments/{$attachment->id}/content")
            ->assertOk();
    }

    public function test_card_notifications_disappear_after_builtin_role_view_is_revoked(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $member = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Proyecto']);
        ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $member->id, 'role' => 'lector',
        ]);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Tablero']);
        $board->createDefaultColumns();
        $card = Card::create([
            'board_id' => $board->id, 'column_id' => $board->columns()->firstOrFail()->id,
            'title' => 'Card pública', 'is_internal' => false,
        ]);
        AppNotification::create([
            'user_id' => $member->id, 'card_id' => $card->id,
            'kind' => 'comment', 'body' => 'Mensaje asociado al proyecto',
        ]);

        $this->actingAs($member)->getJson('/api/notifications')
            ->assertOk()->assertJsonFragment(['body' => 'Mensaje asociado al proyecto']);

        \Illuminate\Support\Facades\DB::table('workspace_role_settings')->insert([
            'workspace_id' => $workspace->id, 'role_key' => 'lector',
            'permissions' => json_encode(['cards.comment']),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->getJson('/api/notifications')
            ->assertOk()->assertJsonMissing(['body' => 'Mensaje asociado al proyecto']);
    }
}
