<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    public function up(): void
    {
        // Previous Card uploads were under public/storage. Move all known files
        // behind the authenticated download endpoint without changing their DB paths.
        DB::table('card_attachments')->orderBy('id')->chunkById(100, function ($attachments) {
            foreach ($attachments as $attachment) {
                $path = $attachment->disk_path;
                if (! Storage::disk('public')->exists($path)) {
                    continue;
                }
                if (! Storage::disk('local')->exists($path)) {
                    $stream = Storage::disk('public')->readStream($path);
                    if ($stream === false) {
                        throw new RuntimeException('No se pudo leer el adjunto '.$attachment->id);
                    }
                    try {
                        if (! Storage::disk('local')->put($path, $stream)) {
                            throw new RuntimeException('No se pudo proteger el adjunto '.$attachment->id);
                        }
                    } finally {
                        fclose($stream);
                    }
                }
                if (! Storage::disk('public')->delete($path)) {
                    throw new RuntimeException('No se pudo retirar el adjunto público '.$attachment->id);
                }
            }
        });
    }

    public function down(): void
    {
        // Never restore attachments to public storage on rollback.
    }
};
