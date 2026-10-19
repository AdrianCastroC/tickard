<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('workspace_custom_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('scope', 16);
            $table->string('name', 80);
            $table->string('description', 255)->nullable();
            $table->json('permissions');
            $table->timestamps();
            $table->unique(['workspace_id', 'scope', 'name']);
        });
        Schema::table('project_members', function (Blueprint $table) {
            $table->foreignId('custom_role_id')->nullable()
                ->constrained('workspace_custom_roles')->restrictOnDelete();
        });
        Schema::table('workspace_members', function (Blueprint $table) {
            $table->foreignId('custom_role_id')->nullable()
                ->constrained('workspace_custom_roles')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('project_members', fn (Blueprint $table) => $table->dropConstrainedForeignId('custom_role_id'));
        Schema::table('workspace_members', fn (Blueprint $table) => $table->dropConstrainedForeignId('custom_role_id'));
        Schema::dropIfExists('workspace_custom_roles');
    }
};
