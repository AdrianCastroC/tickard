<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('workspace_role_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('role_key', 40);
            $table->boolean('enabled')->default(true);
            $table->timestamps();
            $table->unique(['workspace_id', 'role_key']);
        });
        Schema::table('workspace_custom_roles', function (Blueprint $table) {
            $table->boolean('enabled')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('workspace_custom_roles', fn (Blueprint $table) => $table->dropColumn('enabled'));
        Schema::dropIfExists('workspace_role_settings');
    }
};
