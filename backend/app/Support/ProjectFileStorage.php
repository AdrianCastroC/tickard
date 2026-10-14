<?php

namespace App\Support;

use App\Models\CardAttachment;
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

    public static function limitBytes(Workspace $workspace): ?int
    {
        // Plan quotas are per Workspace. Free/Base/Pro have no numeric
        // storage allowance configured yet; Business can override it in DB.
        if ($workspace->effectivePlan() !== \App\Models\User::PLAN_BUSINESS) {
            return null;
        }
        $limit = DB::table('workspace_plan_limits')
            ->where('workspace_id', $workspace->id)->value('max_storage_mb');
        return $limit === null ? null : (int) $limit * 1024 * 1024;
    }

    public static function assertRoom(Workspace $workspace, int $additionalBytes): void
    {
        $limit = self::limitBytes($workspace);
        if ($limit !== null && self::usedBytes($workspace) + $additionalBytes > $limit) {
            throw ValidationException::withMessages([
                'file' => 'Se ha alcanzado el límite de almacenamiento del Workspace.',
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
