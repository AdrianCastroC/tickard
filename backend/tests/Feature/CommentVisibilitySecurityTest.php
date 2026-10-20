<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\ClientCompany;
use App\Models\Comment;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceCustomRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommentVisibilitySecurityTest extends TestCase
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
        $company = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Empresa']);
        $workspace->memberships()->create([
            'user_id' => $client->id, 'role' => 'client', 'client_company_id' => $company->id,
        ]);
        $project = Project::create([
            'workspace_id' => $workspace->id, 'name' => 'Proyecto',
            'client_company_id' => $company->id, 'client_access_enabled' => true,
        ]);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $client->id, 'role' => 'cliente']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Trabajo']);
        $board->createDefaultColumns();
        $card = Card::create([
            'board_id' => $board->id, 'column_id' => $board->columns()->firstOrFail()->id,
            'title' => 'Tarjeta pública', 'is_internal' => false, 'created_by' => $owner->id,
        ]);

        return [$owner, $client, $workspace, $project, $card];
    }

    public function test_client_cannot_delete_or_react_after_thread_becomes_internal(): void
    {
        [$owner, $client, $workspace, $project, $card] = $this->fixture();

        $root = Comment::create([
            'card_id' => $card->id, 'user_id' => $client->id,
            'body' => 'Tema público', 'is_internal' => false,
        ]);
        $reply = Comment::create([
            'card_id' => $card->id, 'parent_id' => $root->id,
            'user_id' => $client->id, 'body' => 'Respuesta', 'is_internal' => false,
        ]);

        $this->actingAs($client)->postJson("/api/comments/{$reply->id}/reactions", [
            'type' => 'like',
        ])->assertOk();

        $root->update(['is_internal' => true]);

        $this->postJson("/api/comments/{$reply->id}/reactions", [
            'type' => 'love',
        ])->assertNotFound();
        $this->deleteJson("/api/comments/{$reply->id}")->assertNotFound();
        $this->postJson("/api/cards/{$card->id}/comments", [
            'body' => 'Nueva respuesta', 'parent_id' => $reply->id,
        ])->assertForbidden();

        $this->assertDatabaseHas('comments', ['id' => $reply->id]);
    }

    public function test_comment_permissions_alone_do_not_grant_access_without_project_view(): void
    {
        [$owner, $client, $workspace, $project, $card] = $this->fixture();
        $member = User::factory()->create(['is_admin' => false]);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $custom = WorkspaceCustomRole::create([
            'workspace_id' => $workspace->id, 'scope' => 'project',
            'name' => 'Solo comentar', 'permissions' => ['cards.comment'], 'enabled' => true,
        ]);
        ProjectMember::create([
            'project_id' => $project->id, 'user_id' => $member->id,
            'role' => 'lector', 'custom_role_id' => $custom->id,
        ]);
        $comment = Comment::create([
            'card_id' => $card->id, 'user_id' => $member->id,
            'body' => 'Histórico', 'is_internal' => true,
        ]);

        $this->actingAs($member)->postJson("/api/cards/{$card->id}/comments", [
            'body' => 'No autorizado',
        ])->assertForbidden();
        $this->postJson("/api/comments/{$comment->id}/reactions", [
            'type' => 'like',
        ])->assertForbidden();
        $this->deleteJson("/api/comments/{$comment->id}")->assertForbidden();
        $this->patchJson("/api/comments/{$comment->id}/visibility", [
            'is_internal' => false,
        ])->assertForbidden();

        $this->assertDatabaseHas('comments', [
            'id' => $comment->id, 'body' => 'Histórico', 'is_internal' => true,
        ]);
    }

    public function test_client_can_still_comment_and_react_to_visible_thread(): void
    {
        [$owner, $client, $workspace, $project, $card] = $this->fixture();
        $this->actingAs($client)->postJson("/api/cards/{$card->id}/comments", [
            'body' => 'Consulta pública',
        ])->assertCreated()->assertJsonPath('is_internal', false);
        $comment = Comment::where('card_id', $card->id)->firstOrFail();

        $this->postJson("/api/comments/{$comment->id}/reactions", [
            'type' => 'like',
        ])->assertOk();
        $this->deleteJson("/api/comments/{$comment->id}")->assertNoContent();
    }
}
