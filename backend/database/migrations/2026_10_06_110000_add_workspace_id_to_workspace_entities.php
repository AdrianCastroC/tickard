<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->foreignId('workspace_id')
                ->after('id')
                ->constrained()
                ->cascadeOnDelete();
        });

        Schema::table('teams', function (Blueprint $table) {
            $table->foreignId('workspace_id')
                ->after('id')
                ->constrained()
                ->cascadeOnDelete();
        });

        Schema::table('departments', function (Blueprint $table) {
            $table->foreignId('workspace_id')
                ->after('id')
                ->constrained()
                ->cascadeOnDelete();
        });

        Schema::table('client_companies', function (Blueprint $table) {
            $table->foreignId('workspace_id')
                ->after('id')
                ->constrained()
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropConstrainedForeignId('workspace_id');
        });

        Schema::table('teams', function (Blueprint $table) {
            $table->dropConstrainedForeignId('workspace_id');
        });

        Schema::table('departments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('workspace_id');
        });

        Schema::table('client_companies', function (Blueprint $table) {
            $table->dropConstrainedForeignId('workspace_id');
        });
    }
};