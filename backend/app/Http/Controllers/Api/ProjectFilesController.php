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
use Illuminate\Validation\ValidationException;

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
        $accountLimit = ProjectFileStorage::accountLimitBytes($workspace);

        return response()->json([
            'files' => $general->concat($attachments)->sortByDesc('created_at')->values(),
            'storage' => [
                'workspace_id' => $workspace->id,
                'workspace_name' => $workspace->name,
                'used_bytes' => ProjectFileStorage::usedBytes($workspace),
                'limit_bytes' => ProjectFileStorage::limitBytes($workspace),
                'account_used_bytes' => $accountLimit !== null
                    ? ProjectFileStorage::usedBytesForOwner((int) $workspace->owner_id) : null,
                'account_limit_bytes' => $accountLimit,
            ],
            'can_upload' => ProjectAccess::canUpload($request->user(), $project),
            'can_manage' => ProjectAccess::canManage($request->user(), $project),
        ]);
    }

    /**
     * Produce one ZIP for a multi-selection, including original Card attachments.
     * Resolve every id within this project and under the requesting user's
     * visibility rules; a forged id must never expose another project's files.
     */
    public function downloadSelected(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::canView($request->user(), $project), 403);

        $data = $request->validate([
            'files' => ['required', 'array', 'min:1', 'max:200'],
            'files.*.origin' => ['required', 'in:general,card'],
            'files.*.id' => ['required', 'integer', 'min:1'],
        ]);

        if (! class_exists(\ZipArchive::class)) {
            return response()->json([
                'message' => 'La descarga múltiple requiere la extensión ZIP de PHP en el servidor.',
            ], 503);
        }

        $requested = collect($data['files'])->unique(fn ($item) => $item['origin'].'-'.$item['id'])->values();
        $generalIds = $requested->where('origin', 'general')->pluck('id')->all();
        $cardIds = $requested->where('origin', 'card')->pluck('id')->all();

        $generals = ProjectFile::query()
            ->where('project_id', $project->id)
            ->whereIn('id', $generalIds)
            ->get()->keyBy('id');

        $role = ProjectAccess::role($request->user(), $project);
        $attachments = CardAttachment::query()
            ->whereIn('id', $cardIds)
            ->whereHas('card.board', fn ($query) => $query->where('project_id', $project->id))
            ->when($role === 'cliente', fn ($query) => $query->whereHas('card', fn ($card) => $card
                ->where('is_internal', false)->whereNull('archived_at')))
            ->get()->keyBy('id');

        // First validate the whole selection, then write the archive. There are
        // no partial ZIPs when an entry is missing, hidden or exceeds the cap.
        $entries = [];
        $totalBytes = 0;
        $usedNames = [];
        foreach ($requested as $item) {
            $file = $item['origin'] === 'general'
                ? $generals->get($item['id'])
                : $attachments->get($item['id']);
            abort_unless($file !== null, 404, 'Uno de los archivos no existe o no está disponible.');

            abort_unless(Storage::disk('local')->exists($file->disk_path), 404, 'El archivo no está en el disco.');
            $totalBytes += (int) $file->size;
            if ($totalBytes > 512 * 1024 * 1024) {
                throw ValidationException::withMessages([
                    'files' => 'La descarga ZIP no puede superar 512 MB. Selecciona menos archivos.',
                ]);
            }

            // Only flat filenames (no ZIP traversal); distinguish duplicates.
            $name = basename(str_replace('\\', '/', $file->original_name));
            $name = preg_replace('/[\x00-\x1F\x7F]/', '_', $name) ?: 'archivo';
            $name = trim($name, ". \t\n\r\0\x0B") ?: 'archivo';
            $base = pathinfo($name, PATHINFO_FILENAME) ?: 'archivo';
            $extension = pathinfo($name, PATHINFO_EXTENSION);
            $candidate = $name;
            $suffix = 2;
            while (isset($usedNames[mb_strtolower($candidate)])) {
                $candidate = $base.' ('.$suffix++.')'.($extension !== '' ? '.'.$extension : '');
            }
            $usedNames[mb_strtolower($candidate)] = true;
            $entries[] = [
                'path' => Storage::disk('local')->path($file->disk_path),
                'name' => $candidate,
            ];
        }

        $temporary = tempnam(sys_get_temp_dir(), 'tickard_zip_');
        abort_if($temporary === false, 500, 'No se pudo preparar la descarga.');

        $archive = new \ZipArchive();
        $opened = false;
        try {
            $opened = $archive->open($temporary, \ZipArchive::OVERWRITE) === true;
            if (! $opened) {
                abort(500, 'No se pudo crear el archivo ZIP.');
            }
            foreach ($entries as $entry) {
                if (! $archive->addFile($entry['path'], $entry['name'])) {
                    abort(500, 'No se pudo añadir un archivo al ZIP.');
                }
            }
            if (! $archive->close()) {
                $opened = false;
                abort(500, 'No se pudo finalizar el ZIP.');
            }
            $opened = false;
        } catch (\Throwable $exception) {
            if ($opened) {
                $archive->close();
            }
            @unlink($temporary);
            throw $exception;
        }

        return response()->download(
            $temporary,
            'tickard-archivos-'.$project->id.'-'.now()->format('Ymd-His').'.zip',
            [
                'Content-Type' => 'application/zip',
                'Cache-Control' => 'private, no-store',
                'X-Content-Type-Options' => 'nosniff',
            ]
        )->deleteFileAfterSend(true);
    }

    public function store(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::canUpload($request->user(), $project), 403);
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
        abort_unless(ProjectAccess::canUpload($request->user(), $project), 403);
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
