<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The public handle uses the unique users.id primary key, padded to
        // a minimum of five digits. The old independent code is obsolete.
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['public_id']);
            $table->dropColumn('public_id');
        });
    }

    public function down(): void
    {
        // Recreate compatible legacy codes if the migration is rolled back.
        // Original codes cannot be recovered after dropping the column.
        Schema::table('users', function (Blueprint $table) {
            $table->char('public_id', 6)->nullable()->after('nickname');
        });
        $next = 100000;
        DB::table('users')->orderBy('id')->chunkById(200, function ($users) use (&$next) {
            foreach ($users as $user) {
                if ($next > 999999) {
                    throw new RuntimeException('Sin identificadores públicos disponibles para revertir.');
                }
                DB::table('users')->where('id', $user->id)->update([
                    'public_id' => (string) $next++,
                ]);
            }
        });
        Schema::table('users', function (Blueprint $table) {
            $table->unique('public_id');
            $table->char('public_id', 6)->nullable(false)->change();
        });
    }
};
