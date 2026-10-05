<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspace_plan_limits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')
                ->unique()
                ->constrained()
                ->cascadeOnDelete();

            $table->unsignedInteger('max_projects')->nullable();
            $table->unsignedInteger('max_members')->nullable();
            $table->unsignedBigInteger('max_storage_mb')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workspace_plan_limits');
    }
};