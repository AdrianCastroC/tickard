<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void {
        Schema::table('users', function (Blueprint $table) {
            $table->string('nickname', 30)->nullable()->after('name');
        });
        DB::table('users')->chunkById(200, function ($users) {
            foreach ($users as $user) {
                DB::table('users')->where('id', $user->id)->update([
                    'nickname' => substr(Str::slug($user->name, '-'), 0, 30) ?: 'usuario',
                ]);
            }
        });
        Schema::table('workspace_invitations', function (Blueprint $table) {
            $table->foreignId('recipient_user_id')->nullable()->after('invited_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->after('workspace_id')->constrained('projects')->cascadeOnDelete();
            $table->string('project_role', 20)->nullable();
            $table->string('status', 20)->default('pending');
            $table->timestamp('responded_at')->nullable();
            $table->index(['recipient_user_id', 'status']);
        });
        // Retire legacy email/link invitations; they must not grant membership in V1.
        DB::table('workspace_invitations')->whereNull('recipient_user_id')->whereNull('revoked_at')->update(['revoked_at' => now()]);
    }

    public function down(): void {
        Schema::table('workspace_invitations', function (Blueprint $table) {
            $table->dropForeign(['recipient_user_id']);
            $table->dropForeign(['project_id']);
            $table->dropIndex(['recipient_user_id', 'status']);
            $table->dropColumn(['recipient_user_id', 'project_id', 'project_role', 'status', 'responded_at']);
        });
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('nickname'));
    }
};
