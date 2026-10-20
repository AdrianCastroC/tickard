<?php

namespace Tests\Feature;

use App\Models\Board;
use App\Models\Card;
use App\Models\CardAttachment;
use App\Models\Project;
use App\Models\ProjectFile;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PrivateFileAccessSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_direct_file_urls_are_private_to_project_members(): void
    {
        Storage::fake('local');

        $owner = User::factory()->create(['is_admin' => false]);
        $outsider = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::createInitialFor($owner);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Privado']);
        $board = Board::create(['project_id' => $project->id, 'name' => 'General']);
        $board->createDefaultColumns();
        $card = Card::create([
            'board_id' => $board->id,
            'column_id' => $board->columns()->firstOrFail()->id,
            'title' => 'Privado',
        ]);

        Storage::disk('local')->put('project-files/private.txt', 'general secret');
        $general = ProjectFile::create([
            'project_id' => $project->id, 'user_id' => $owner->id,
            'original_name' => 'private.txt', 'disk_path' => 'project-files/private.txt',
            'mime_type' => 'text/plain', 'size' => 14,
        ]);
        Storage::disk('local')->put('card-attachments/private.txt', 'card secret');
        $attachment = CardAttachment::create([
            'card_id' => $card->id, 'user_id' => $owner->id,
            'original_name' => 'private.txt', 'disk_path' => 'card-attachments/private.txt',
            'mime_type' => 'text/plain', 'size' => 11,
        ]);

        foreach ([
            "/api/project-files/{$general->id}/content",
            "/api/attachments/{$attachment->id}/content",
        ] as $url) {
            $this->get($url, ['Accept' => 'application/json'])->assertUnauthorized();
            $this->actingAs($outsider)->get($url, ['Accept' => 'application/json'])
                ->assertForbidden();
            $response = $this->actingAs($owner)->get($url)->assertOk()
                ->assertHeader('X-Content-Type-Options', 'nosniff');
            $cacheControl = $response->headers->get('Cache-Control', '');
            $this->assertStringContainsString('private', $cacheControl);
            $this->assertStringContainsString('no-store', $cacheControl);
            $this->assertStringNotContainsString('public', $cacheControl);
        }

        $this->actingAs($outsider)
            ->getJson("/api/projects/{$project->id}/files")->assertForbidden();
    }
}
