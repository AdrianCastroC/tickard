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
            $table->boolean('is_backlog')->default(false)->after('position');
        });

        Schema::table('cards', function (Blueprint $table) {
            $table->date('start_date')->nullable()->after('description');
            $table->timestamp('started_at')->nullable()->after('due_date');
        });

        /*
         * Identifica el Backlog existente de cada Board.
         *
         * Prioridad:
         * 1. Una columna llamada "Backlog".
         * 2. Si no existe, la primera columna del Board.
         */
        $boardIds = DB::table('boards')->pluck('id');

        foreach ($boardIds as $boardId) {
            $backlogId = DB::table('columns')
                ->where('board_id', $boardId)
                ->where('name', 'Backlog')
                ->orderBy('position')
                ->orderBy('id')
                ->value('id');

            if (! $backlogId) {
                $backlogId = DB::table('columns')
                    ->where('board_id', $boardId)
                    ->orderBy('position')
                    ->orderBy('id')
                    ->value('id');
            }

            if ($backlogId) {
                DB::table('columns')
                    ->where('id', $backlogId)
                    ->update([
                        'is_backlog' => true,
                        'position' => 0,
                    ]);
            }
        }

        /*
         * Las Cards existentes solo tenían fecha de vencimiento.
         * La interpretamos como una planificación de un único día.
         */
        DB::table('cards')
            ->whereNotNull('due_date')
            ->update([
                'start_date' => DB::raw('due_date'),
            ]);
    }

    public function down(): void
    {
        Schema::table('cards', function (Blueprint $table) {
            $table->dropColumn([
                'start_date',
                'started_at',
            ]);
        });

        Schema::table('columns', function (Blueprint $table) {
            $table->dropColumn('is_backlog');
        });
    }
};