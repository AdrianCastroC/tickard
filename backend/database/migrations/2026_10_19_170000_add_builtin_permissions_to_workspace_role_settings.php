<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('workspace_role_settings', function (Blueprint $table): void {
            $table->json('permissions')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('workspace_role_settings', function (Blueprint $table): void {
            $table->dropColumn('permissions');
        });
    }
};
