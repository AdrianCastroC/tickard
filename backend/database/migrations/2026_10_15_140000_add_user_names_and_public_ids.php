<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        // Legacy name stays as a display field for the existing UI/API.
        Schema::table('users', function (Blueprint $table) {
            $table->string('first_name', 120)->nullable()->after('name');
            $table->string('last_name', 120)->nullable()->after('first_name');
            $table->char('public_id', 6)->nullable()->after('nickname');
        });

        // Deterministic, collision-free backfill. Preserve existing IDs and
        // custom nicknames; shorten only the previous auto-generated nickname.
        $next = 100000;
        DB::table('users')->orderBy('id')->chunkById(200, function ($users) use (&$next) {
            foreach ($users as $user) {
                if ($next > 999999) {
                    throw new RuntimeException('Se ha agotado el espacio de identificadores públicos de 6 cifras.');
                }
                $parts = preg_split('/\\s+/u', trim((string) $user->name), 2);
                $first = $parts[0] ?: 'Usuario';
                $last = $parts[1] ?? null;
                $previousAutoNickname = substr(Str::slug($user->name, '-'), 0, 30) ?: 'usuario';
                $newNickname = substr(Str::slug($first, '-'), 0, 30) ?: 'usuario';

                $updates = [
                    'first_name' => $first,
                    'last_name' => $last,
                    'public_id' => (string) $next++,
                ];
                if (! $user->nickname || $user->nickname === $previousAutoNickname) {
                    $updates['nickname'] = $newNickname;
                }
                DB::table('users')->where('id', $user->id)->update($updates);
            }
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unique('public_id');
            $table->string('first_name', 120)->nullable(false)->change();
            $table->char('public_id', 6)->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['public_id']);
            $table->dropColumn(['first_name', 'last_name', 'public_id']);
        });
    }
};
