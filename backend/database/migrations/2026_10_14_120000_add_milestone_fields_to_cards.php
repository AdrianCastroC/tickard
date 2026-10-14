<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cards', function (Blueprint $table) {
            $table->boolean('is_milestone')->default(false)->after('is_internal');
            $table->boolean('milestone_auto_complete')->default(true)->after('is_milestone');
        });
    }

    public function down(): void
    {
        Schema::table('cards', function (Blueprint $table) {
            $table->dropColumn(['is_milestone', 'milestone_auto_complete']);
        });
    }
};
