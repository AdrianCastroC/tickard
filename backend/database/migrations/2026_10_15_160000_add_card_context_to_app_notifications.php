<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('app_notifications', function (Blueprint $table) {
            $table->foreignId('card_id')->nullable()->after('user_id')->constrained('cards')->nullOnDelete();
            $table->string('kind', 20)->default('general')->after('body');
            $table->index(['user_id', 'read_at', 'id']);
        });
    }

    public function down(): void
    {
        Schema::table('app_notifications', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'read_at', 'id']);
            $table->dropForeign(['card_id']);
            $table->dropColumn(['card_id', 'kind']);
        });
    }
};
