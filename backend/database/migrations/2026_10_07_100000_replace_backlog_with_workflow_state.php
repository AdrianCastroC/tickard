<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('columns', function (Blueprint $table) {
            $table->string('workflow_state', 20)->default('pending')->after('position');
        });

        Schema::table('cards', function (Blueprint $table) {
            $table->timestamp('completed_at')->nullable()->after('started_at');
        });

        $defaultStates = [
            'backlog' => 'backlog',
            'por hacer' => 'pending',
            'en progreso' => 'in_progress',
            'en revisión' => 'review',
            'en revision' => 'review',
            'completado' => 'done',
        ];

        DB::table('columns')->orderBy('id')->each(function (object $column) use ($defaultStates): void {
            $name = mb_strtolower(trim($column->name));
            $state = $column->is_backlog
                ? 'backlog'
                : ($defaultStates[$name] ?? 'pending');

            DB::table('columns')
                ->where('id', $column->id)
                ->update(['workflow_state' => $state]);
        });

        Schema::table('columns', function (Blueprint $table) {
            $table->dropColumn('is_backlog');
        });
    }

    public function down(): void
    {
        Schema::table('columns', function (Blueprint $table) {
            $table->boolean('is_backlog')->default(false)->after('position');
        });

        DB::table('columns')
            ->where('workflow_state', 'backlog')
            ->update(['is_backlog' => true]);

        Schema::table('cards', function (Blueprint $table) {
            $table->dropColumn('completed_at');
        });

        Schema::table('columns', function (Blueprint $table) {
            $table->dropColumn('workflow_state');
        });
    }
};
