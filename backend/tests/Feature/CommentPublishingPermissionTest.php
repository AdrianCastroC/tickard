<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\Comment;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommentPublishingPermissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_reader_may_comment_but_cannot_publish_thread_to_clients(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $reader = User::factory()->create(['is_admin' => false]);
        $editor = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        foreach ([$reader, $editor] as $person) {
            $workspace->memberships()->create(['user_id' => $person->id, 'role' => 'member']);
        }
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Compartido']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $reader->id, 'role' => 'lector']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $editor->id, 'role' => 'editor']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'Principal']);
        $board->createDefaultColumns();
        $card = Card::create(['board_id' => $board->id,
            'column_id' => $board->columns()->firstOrFail()->id, 'title' => 'Pública']);

        $readerComment = $this->actingAs($reader)->postJson("/api/cards/{$card->id}/comments", [
            'body' => 'Texto interno del lector',
        ])->assertCreated()->json('id');
        $this->patchJson("/api/comments/{$readerComment}/visibility", ['is_internal' => false])
            ->assertForbidden();

        $this->assertDatabaseHas('comments', ['id' => $readerComment, 'is_internal' => true]);

        $editorComment = $this->actingAs($editor)->postJson("/api/cards/{$card->id}/comments", [
            'body' => 'Publicación autorizada',
        ])->assertCreated()->json('id');
        $this->patchJson("/api/comments/{$editorComment}/visibility", ['is_internal' => false])
            ->assertOk()->assertJsonPath('is_internal', false);

        $this->assertDatabaseHas('comments', ['id' => $editorComment, 'is_internal' => false]);
    }
}
