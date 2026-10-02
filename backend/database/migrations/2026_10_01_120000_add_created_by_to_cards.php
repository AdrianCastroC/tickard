<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cards', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->after('color')->constrained('users')->nullOnDelete();
        });

        $created = DB::table('activities')
            ->where('type', 'created')
            ->whereNotNull('user_id')
            ->orderBy('id')
            ->get(['card_id', 'user_id']);

        foreach ($created->groupBy('card_id') as $cardId => $rows) {
            DB::table('cards')
                ->where('id', $cardId)
                ->whereNull('created_by')
                ->update(['created_by' => $rows->first()->user_id]);
        }
    }

    public function down(): void
    {
        Schema::table('cards', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
        });
    }
};
