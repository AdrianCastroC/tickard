<?php

namespace App\Support;

use App\Models\CardAttachment;
use App\Models\Project;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Illuminate\Support\Str;

class ProjectFileStorage
{
    public const MAX_FILE_KB = 10240;
    public const FREE_WORKSPACE_QUOTA_BYTES = 200 * 1024 * 1024;
    public const WORKSPACE_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;
    public const PRO_ACCOUNT_QUOTA_BYTES = 20 * 1024 * 1024 * 1024;

    /** Only small, supported documents and images; the server detects the MIME. */
    public const EXTENSIONS = [
        'jpg' => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png' => ['image/png'],
        'webp' => ['image/webp'],
        'pdf' => ['application/pdf'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        'txt' => ['text/plain'],
    ];

    public static function validateUpload(UploadedFile $file): void
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $mime = $file->getMimeType();
        if (! isset(self::EXTENSIONS[$extension])) {
            throw ValidationException::withMessages(['file' => 'Solo se admiten JPG, PNG, WebP, PDF, DOCX, XLSX y TXT.']);
        }

        // PHP fileinfo often identifies legitimate Office Open XML documents as ZIP.
        // Check the ZIP structure instead of trusting the client-provided MIME.
        if (in_array($extension, ['docx', 'xlsx'], true)) {
            $required = $extension === 'docx' ? 'word/document.xml' : 'xl/workbook.xml';
            $valid = in_array($mime, [self::EXTENSIONS[$extension][0], 'application/zip', 'application/octet-stream'], true);
            if ($valid && class_exists(\ZipArchive::class)) {
                $zip = new \ZipArchive();
                $valid = $zip->open($file->getRealPath()) === true;
                if ($valid) {
                    $valid = $zip->locateName('[Content_Types].xml') !== false
                        && $zip->locateName($required) !== false;
                    $zip->close();
                }
            } elseif ($valid) {
                // Fallback for PHP runtimes without ext-zip (files are max 10 MB).
                $bytes = file_get_contents($file->getRealPath());
                $valid = $bytes !== false && str_starts_with($bytes, 'PK')
                    && str_contains($bytes, '[Content_Types].xml')
                    && str_contains($bytes, $required);
            }
            if ($valid) return;
        } elseif (in_array($mime, self::EXTENSIONS[$extension], true)) {
            return;
        }

        throw ValidationException::withMessages(['file' => 'El contenido no coincide con un formato permitido.']);
    }

    public static function mime(UploadedFile $file): string
    {
        return self::EXTENSIONS[strtolower($file->getClientOriginalExtension())][0];
    }

    public static function usedBytes(Workspace $workspace): int
    {
        $projectFiles = DB::table('project_files')
            ->join('projects', 'projects.id', '=', 'project_files.project_id')
            ->where('projects.workspace_id', $workspace->id)
            ->sum('project_files.size');

        $cardFiles = DB::table('card_attachments')
            ->join('cards', 'cards.id', '=', 'card_attachments.card_id')
            ->join('boards', 'boards.id', '=', 'cards.board_id')
            ->join('projects', 'projects.id', '=', 'boards.project_id')
            ->where('projects.workspace_id', $workspace->id)
            ->sum('card_attachments.size');

        return (int) $projectFiles + (int) $cardFiles;
    }

    public static function usedBytesForProject(Project $project): int
    {
        $files = DB::table('project_files')->where('project_id', $project->id)->sum('size');
        $attachments = DB::table('card_attachments')
            ->join('cards', 'cards.id', '=', 'card_attachments.card_id')
            ->join('boards', 'boards.id', '=', 'cards.board_id')
            ->where('boards.project_id', $project->id)->sum('card_attachments.size');
        return (int) $files + (int) $attachments;
    }

    /** The unreserved Workspace quota is split between automatic projects. */
    public static function projectLimitBytes(Project $project, ?int $workspaceLimit = null): ?int
    {
        if ($project->storage_allocation_mb !== null) {
            return (int) $project->storage_allocation_mb * 1024 * 1024;
        }
        $workspace = $project->workspace;
        $workspaceLimit ??= self::limitBytes($workspace);
        if ($workspaceLimit === null) return null;
        $projects = $workspace->projects()->get(['id', 'storage_allocation_mb']);
        $reserved = (int) $projects->sum('storage_allocation_mb');
        $automatic = max(1, $projects->whereNull('storage_allocation_mb')->count());
        // Divide bytes, not rounded-down megabytes, to avoid losing usable space.
        return intdiv(max(0, $workspaceLimit - $reserved * 1024 * 1024), $automatic);
    }

    /** Check all effective project quotas against real usage before shrinking a Workspace. */
    public static function assertProjectsFit(Workspace $workspace, ?int $workspaceLimit): void
    {
        if ($workspaceLimit === null) return;
        $projects = $workspace->projects()->get(['id', 'name', 'workspace_id', 'storage_allocation_mb']);
        $reserved = (int) $projects->sum('storage_allocation_mb') * 1024 * 1024;
        if ($reserved > $workspaceLimit) {
            throw ValidationException::withMessages([
                'allocations' => 'Las cuotas manuales de los proyectos superan la capacidad de '.$workspace->name.'.',
            ]);
        }
        $automaticCount = $projects->whereNull('storage_allocation_mb')->count();
        $automaticLimit = $automaticCount ? intdiv($workspaceLimit - $reserved, $automaticCount) : 0;
        foreach ($projects as $project) {
            $limit = $project->storage_allocation_mb === null
                ? $automaticLimit : (int) $project->storage_allocation_mb * 1024 * 1024;
            if (self::usedBytesForProject($project) > $limit) {
                throw ValidationException::withMessages([
                    'allocations' => 'El proyecto '.$project->name.' supera su cuota con la nueva distribución.',
                ]);
            }
        }
    }

    /** Default quota for each Workspace, based on its owner's plan. */
    public static function limitBytes(Workspace $workspace): ?int
    {
        return match ($workspace->effectivePlan()) {
            User::PLAN_FREE => self::FREE_WORKSPACE_QUOTA_BYTES,
            User::PLAN_BASE => self::WORKSPACE_QUOTA_BYTES,
            User::PLAN_PRO => self::proWorkspaceLimitBytes($workspace),
            User::PLAN_BUSINESS => self::businessLimitBytes($workspace),
            default => self::FREE_WORKSPACE_QUOTA_BYTES,
        };
    }

    /**
     * Explicit allocations are reserved first. Any unallocated capacity is
     * shared equally among Workspaces without a manual allocation.
     */
    private static function proWorkspaceLimitBytes(Workspace $workspace): int
    {
        if ($workspace->storage_allocation_mb !== null) {
            return (int) $workspace->storage_allocation_mb * 1024 * 1024;
        }
        $owned = Workspace::query()->where('owner_id', $workspace->owner_id)->get(['id', 'storage_allocation_mb']);
        $reserved = (int) $owned->sum('storage_allocation_mb');
        $automatic = max(1, $owned->whereNull('storage_allocation_mb')->count());
        return intdiv(max(0, self::PRO_ACCOUNT_QUOTA_BYTES - $reserved * 1024 * 1024), $automatic);
    }

    private static function businessLimitBytes(Workspace $workspace): ?int
    {
        $limit = DB::table('workspace_plan_limits')
            ->where('workspace_id', $workspace->id)
            ->value('max_storage_mb');

        return $limit === null ? null : (int) $limit * 1024 * 1024;
    }

    /** Pro owners share a maximum of 20 GiB across all their own Workspaces. */
    public static function accountLimitBytes(Workspace $workspace): ?int
    {
        return $workspace->effectivePlan() === User::PLAN_PRO
            ? self::PRO_ACCOUNT_QUOTA_BYTES
            : null;
    }

    public static function usedBytesForOwner(int $ownerId): int
    {
        $general = DB::table('project_files')
            ->join('projects', 'projects.id', '=', 'project_files.project_id')
            ->join('workspaces', 'workspaces.id', '=', 'projects.workspace_id')
            ->where('workspaces.owner_id', $ownerId)
            ->sum('project_files.size');

        $attachments = DB::table('card_attachments')
            ->join('cards', 'cards.id', '=', 'card_attachments.card_id')
            ->join('boards', 'boards.id', '=', 'cards.board_id')
            ->join('projects', 'projects.id', '=', 'boards.project_id')
            ->join('workspaces', 'workspaces.id', '=', 'projects.workspace_id')
            ->where('workspaces.owner_id', $ownerId)
            ->sum('card_attachments.size');

        return (int) $general + (int) $attachments;
    }

    /** Must run inside the upload transaction so row locks are held until commit. */
    public static function assertRoom(Workspace $workspace, int $additionalBytes, ?Project $project = null): void
    {
        // Synchronize quota checks across uploads to different Workspaces owned
        // by the same user. Both upload controllers call this in a transaction.
        // Lock the owner BEFORE any aggregate query to avoid stale snapshots.
        $owner = User::query()->whereKey($workspace->owner_id)->lockForUpdate()->firstOrFail();
        $workspace->setRelation('owner', $owner);

        $limit = self::limitBytes($workspace);
        if ($limit !== null && self::usedBytes($workspace) + $additionalBytes > $limit) {
            throw ValidationException::withMessages([
                'file' => 'Se ha alcanzado la cuota de almacenamiento de este Workspace.',
            ]);
        }

        if ($project !== null) {
            abort_unless((int) $project->workspace_id === (int) $workspace->id, 422);
            // Refresh after taking the owner lock: quotas may change between requests.
            $project->refresh();
            $projectLimit = self::projectLimitBytes($project, $limit);
            if ($projectLimit !== null && self::usedBytesForProject($project) + $additionalBytes > $projectLimit) {
                throw ValidationException::withMessages([
                    'file' => 'Se ha alcanzado la cuota de almacenamiento de este proyecto.',
                ]);
            }
        }

        $accountLimit = self::accountLimitBytes($workspace);
        if ($accountLimit === null) {
            return;
        }

        if (self::usedBytesForOwner((int) $workspace->owner_id) + $additionalBytes > $accountLimit) {
            throw ValidationException::withMessages([
                'file' => 'La cuenta Pro ha alcanzado su límite total de 20 GB. Libera espacio en alguno de tus Workspaces.',
            ]);
        }
    }

    /** Remember disk paths before deleting rows that may cascade in the database. */
    public static function pathsForProject(\App\Models\Project $project): array
    {
        $general = \App\Models\ProjectFile::where('project_id', $project->id)->pluck('disk_path')->all();
        $cards = CardAttachment::whereHas('card.board', fn ($query) => $query->where('project_id', $project->id))
            ->pluck('disk_path')->all();
        return array_merge($general, $cards);
    }

    public static function pathsForBoard(\App\Models\Board $board): array
    {
        return CardAttachment::whereHas('card', fn ($query) => $query->where('board_id', $board->id))
            ->pluck('disk_path')->all();
    }

    public static function pathsForColumn(\App\Models\Column $column): array
    {
        return CardAttachment::whereHas('card', fn ($query) => $query->where('column_id', $column->id))
            ->pluck('disk_path')->all();
    }

    public static function purgePaths(array $paths): void
    {
        if ($paths) Storage::disk('local')->delete($paths);
    }

    public static function presentCard(CardAttachment $file): array
    {
        return [
            'key' => 'card-'.$file->id, 'id' => $file->id, 'origin' => 'card',
            'name' => $file->original_name, 'mime_type' => $file->mime_type,
            'size' => (int) $file->size,
            'url' => '/api/attachments/'.$file->id.'/content',
            'description' => null, 'created_at' => $file->created_at?->toIso8601String(),
            'user_id' => $file->user_id, 'author' => $file->user?->name,
            'avatar_url' => $file->user?->avatarUrl(),
            'board_id' => $file->card?->board_id, 'board_name' => $file->card?->board?->name,
            'card_id' => $file->card_id, 'card_title' => $file->card?->title,
        ];
    }

    public static function serve(string $path, ?string $mime, string $name)
    {
        abort_unless(Storage::disk('local')->exists($path), 404);
        $inline = in_array($mime, ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain'], true);
        $disposition = HeaderUtils::makeDisposition(
            $inline ? 'inline' : 'attachment',
            basename($name),
            Str::ascii(basename($name)) ?: 'archivo'
        );

        return response()->file(Storage::disk('local')->path($path), [
            'Content-Type' => $mime ?: 'application/octet-stream',
            'Content-Disposition' => $disposition,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }
}
