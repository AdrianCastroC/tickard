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
        // Nullable during INSERT because the numeric primary key is not yet
        // known. The User::created hook populates this before create() returns.
        Schema::table('users', function (Blueprint $table) {
            $table->string('public_handle', 96)->nullable()->after('last_name');
        });

        // Preserve the exact handles users already shared, including legacy
        // custom prefixes. Never derive existing handles from today's name.
        DB::table('users')->orderBy('id')->chunkById(200, function ($users) {
            foreach ($users as $user) {
                $prefix = Str::slug($user->nickname ?: $user->name, '-') ?: 'usuario';
                $handle = $prefix.'#'.str_pad((string) $user->id, 5, '0', STR_PAD_LEFT);
                DB::table('users')->where('id', $user->id)->update([
                    'public_handle' => $handle,
                ]);
            }
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unique('public_handle');
            $table->dropColumn('nickname');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('nickname', 30)->nullable()->after('name');
        });
        DB::table('users')->orderBy('id')->chunkById(200, function ($users) {
            foreach ($users as $user) {
                DB::table('users')->where('id', $user->id)->update([
                    'nickname' => Str::beforeLast((string) $user->public_handle, '#'),
                ]);
            }
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['public_handle']);
            $table->dropColumn('public_handle');
        });
    }
};
