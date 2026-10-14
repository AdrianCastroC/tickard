<?php

namespace App\Http\Controllers\Api;

use App\Models\CardAttachment;
use App\Models\Project;
use App\Models\ProjectFile;
use App\Models\Workspace;
use App\Support\ProjectAccess;
use App\Support\ProjectFileStorage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProjectFilesController extends ApiController
{
    public function index(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::canView($request->user(), $project), 403);
        $role = ProjectAccess::role($request->user(), $project);

        $general = ProjectFile::query()
            ->where('project_id', $project->id)
            ->with('user')
            ->get()
            ->map(fn (ProjectFile $file) => $this->presentProjectFile($file));

        $attachments = CardAttachment::query()
            ->whereHas('card.board', fn ($query) => $query->where('project_id', $project->id))
            ->when($role === 'cliente', fn ($query) => $query->whereHas('card', fn ($card) => $card
                ->where('is_internal', false)->whereNull('archived_at')))
            ->with(['user', 'card.board'])
            ->get()
            ->map(fn (CardAttachment $file) => ProjectFileStorage::presentCard($file));

        $workspace = $project->workspace()->with('owner')->firstOrFail();
        return response()->json([
            'files' => $general->concat($attachments)->sortByDesc('created_at')->values(),
            'storage' => [
                'workspace_id' => $workspace->id,
                'workspace_name' => $workspace->name,
                'used_bytes' => ProjectFileStorage::usedBytes($workspace),
                'limit_bytes' => ProjectFileStorage::limitBytes($workspace),
            ],
            'can_upload' => ProjectAccess::canEditCards($request->user(), $project),
            'can_manage' => ProjectAccess::canManage($request->user(), $project),
        ]);
    }

    public function store(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $project), 403);
        $data = $request->validate([
            'file' => ['required', 'file', 'max:'.ProjectFileStorage::MAX_FILE_KB],
        ]);

        $file = $data['file'];
        ProjectFileStorage::validateUpload($file);
        $path = 'project-files/'.$project->id.'/'.Str::uuid().'.'.strtolower($file->getClientOriginalExtension());
        $stored = false;

        try {
            $entry = DB::transaction(function () use ($project, $request, $file, $path, &$stored) {
                $workspace = Workspace::whereKey($project->workspace_id)->lockForUpdate()->firstOrFail();
                ProjectFileStorage::assertRoom($workspace, $file->getSize() ?: 0);
                $stored = $file->storeAs(dirname($path), basename($path), 'local') !== false;
                abort_unless($stored, 500, 'No se pudo guardar el archivo.');
                return ProjectFile::create([
                    'project_id' => $project->id,
                    'user_id' => $request->user()->id,
                    'original_name' => $file->getClientOriginalName(),
                    'disk_path' => $path,
                    'mime_type' => ProjectFileStorage::mime($file),
                    'size' => $file->getSize() ?: 0,
                ]);
            });

            return response()->json($this->presentProjectFile($entry->load('user')), 201);
        } catch (\Throwable $exception) {
            if ($stored) Storage::disk('local')->delete($path);
            throw $exception;
        }
    }

    public function destroy(Request $request, ProjectFile $projectFile)
    {
        $project = $projectFile->project;
        abort_unless(ProjectAccess::canEditCards($request->user(), $project), 403);
        abort_unless(
            ProjectAccess::canManage($request->user(), $project) || $projectFile->user_id === $request->user()->id,
            403
        );
        Storage::disk('local')->delete($projectFile->disk_path);
        $projectFile->delete();

        return response()->noContent();
    }

    public function content(Request $request, ProjectFile $projectFile)
    {
        abort_unless(ProjectAccess::canView($request->user(), $projectFile->project), 403);
        return ProjectFileStorage::serve($projectFile->disk_path, $projectFile->mime_type, $projectFile->original_name);
    }

    public function cardContent(Request $request, CardAttachment $attachment)
    {
        $attachment->loadMissing('card.board.project');
        $project = $attachment->card->board->project;
        $role = ProjectAccess::role($request->user(), $project);
        abort_unless($role !== null, 403);
        if ($role === 'cliente') {
            abort_if($attachment->card->is_internal || $attachment->card->archived_at !== null, 404);
        }

        return ProjectFileStorage::serve($attachment->disk_path, $attachment->mime_type, $attachment->original_name);
    }

    private function presentProjectFile(ProjectFile $file): array
    {
        return [
            'key' => 'general-'.$file->id, 'id' => $file->id, 'origin' => 'general',
            'name' => $file->original_name, 'mime_type' => $file->mime_type,
            'size' => (int) $file->size, 'description' => $file->description,
            'url' => '/api/project-files/'.$file->id.'/content',
            'created_at' => $file->created_at?->toIso8601String(),
            'user_id' => $file->user_id, 'author' => $file->user?->name,
            'avatar_url' => $file->user?->avatarUrl(),
            'board_id' => null, 'board_name' => null, 'card_id' => null, 'card_title' => null,
        ];
    }
}
