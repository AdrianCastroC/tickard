<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('workspace_invitations', function (Blueprint $table) {
            $table->foreignId('custom_role_id')->nullable()
                ->constrained('workspace_custom_roles')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('workspace_invitations', fn (Blueprint $table) => $table->dropConstrainedForeignId('custom_role_id'));
    }
};
