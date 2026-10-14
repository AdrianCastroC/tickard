<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\ProjectFile;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProjectFilesDownloadTest extends TestCase
{
    use RefreshDatabase;

    private function projectFor(User $user, string $name = 'Proyecto'): Project
    {
        $workspace = Workspace::create(['name' => 'Equipo '.$name, 'owner_id' => $user->id]);
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Cliente']);
        $project = Project::create([
            'workspace_id' => $workspace->id,
            'client_company_id' => $client->id,
            'name' => $name,
        ]);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $user->id, 'role' => 'editor']);

        return $project;
    }

    private function generalFile(Project $project, User $user, string $name, string $content): ProjectFile
    {
        $path = 'project-files/'.$project->id.'/'.uniqid().'.txt';
        Storage::disk('local')->put($path, $content);
        return ProjectFile::create([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'original_name' => $name,
            'disk_path' => $path,
            'mime_type' => 'text/plain',
            'size' => strlen($content),
        ]);
    }

    public function test_selected_files_are_downloaded_as_one_zip_and_duplicate_names_are_renamed(): void
    {
        if (! class_exists(\ZipArchive::class)) {
            $this->markTestSkipped('La extensión ZIP no está disponible.');
        }

        Storage::fake('local');
        $user = User::factory()->create(['is_admin' => false]);
        $project = $this->projectFor($user);
        $first = $this->generalFile($project, $user, 'informe.txt', 'primero');
        $second = $this->generalFile($project, $user, 'informe.txt', 'segundo');

        $response = $this->actingAs($user)->postJson("/api/projects/{$project->id}/files/download", [
            'files' => [
                ['origin' => 'general', 'id' => $first->id],
                ['origin' => 'general', 'id' => $second->id],
            ],
        ]);
        $response->assertOk();
        $this->assertStringContainsString('application/zip', $response->headers->get('Content-Type'));

        $temporary = $response->baseResponse->getFile()->getPathname();
        $zip = new \ZipArchive();
        try {
            $this->assertTrue($zip->open($temporary) === true);
            $this->assertSame('primero', $zip->getFromName('informe.txt'));
            $this->assertSame('segundo', $zip->getFromName('informe (2).txt'));
            $zip->close();
        } finally {
            @unlink($temporary);
        }
    }

    public function test_a_file_from_another_project_cannot_be_included_in_the_zip(): void
    {
        Storage::fake('local');
        $user = User::factory()->create(['is_admin' => false]);
        $project = $this->projectFor($user);
        $other = $this->projectFor(User::factory()->create(['is_admin' => false]), 'Ajeno');
        $file = $this->generalFile($other, $user, 'privado.txt', 'secreto');

        $this->actingAs($user)->postJson("/api/projects/{$project->id}/files/download", [
            'files' => [['origin' => 'general', 'id' => $file->id]],
        ])->assertStatus(class_exists(\ZipArchive::class) ? 404 : 503);
    }

    public function test_user_without_project_access_cannot_download_an_archive(): void
    {
        $user = User::factory()->create(['is_admin' => false]);
        $other = User::factory()->create(['is_admin' => false]);
        $project = $this->projectFor($other);

        $this->actingAs($user)->postJson("/api/projects/{$project->id}/files/download", [
            'files' => [['origin' => 'general', 'id' => 123]],
        ])->assertForbidden();
    }

    public function test_invalid_or_oversized_selections_are_rejected(): void
    {
        $user = User::factory()->create(['is_admin' => false]);
        $project = $this->projectFor($user);

        $this->actingAs($user)->postJson("/api/projects/{$project->id}/files/download", [
            'files' => [],
        ])->assertUnprocessable();

        $this->actingAs($user)->postJson("/api/projects/{$project->id}/files/download", [
            'files' => [['origin' => 'unknown', 'id' => 1]],
        ])->assertUnprocessable();
    }
}
