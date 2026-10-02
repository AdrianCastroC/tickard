<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('card_checklist_items', function (Blueprint $table) {
            $table->date('due_date')->nullable()->after('is_done');
        });

        Schema::create('card_checklist_item_user', function (Blueprint $table) {
            $table->foreignId('card_checklist_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['card_checklist_item_id', 'user_id'], 'checklist_item_user_primary');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('card_checklist_item_user');

        Schema::table('card_checklist_items', function (Blueprint $table) {
            $table->dropColumn('due_date');
        });
    }
};
