<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->text('description')->nullable();
            $table->string('status', 12)->default('active');
            $table->string('icon', 20)->default('layers');
        });
        Schema::create('department_team', function (Blueprint $table) {
            $table->foreignId('department_id')->constrained()->cascadeOnDelete();
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->primary(['department_id', 'team_id']);
        });
        Schema::create('department_project', function (Blueprint $table) {
            $table->foreignId('department_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->primary(['department_id', 'project_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('department_project');
        Schema::dropIfExists('department_team');
        Schema::table('departments', function (Blueprint $table) {
            $table->dropColumn(['description', 'status', 'icon']);
        });
    }
};
