<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $fallbackUserId = DB::table('users')->orderBy('id')->value('id');
        if (! $fallbackUserId) {
            return;
        }

        // Prefer the "created" activity author when available.
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

        // Any remaining cards without author get the oldest user (should be rare).
        DB::table('cards')
            ->whereNull('created_by')
            ->update(['created_by' => $fallbackUserId]);

        Schema::table('cards', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
        });

        Schema::table('cards', function (Blueprint $table) {
            $table->unsignedBigInteger('created_by')->nullable(false)->change();
            $table->foreign('created_by')->references('id')->on('users')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('cards', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
        });

        Schema::table('cards', function (Blueprint $table) {
            $table->unsignedBigInteger('created_by')->nullable()->change();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
        });
    }
};
