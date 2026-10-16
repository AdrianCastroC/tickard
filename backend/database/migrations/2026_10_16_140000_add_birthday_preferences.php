<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Store only day and month, never the birth year.
            $table->char('birthday_month_day', 5)->nullable();
            $table->boolean('share_birthday')->default(false);
        });
        Schema::table('workspaces', function (Blueprint $table) {
            $table->boolean('show_birthdays')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('workspaces', fn (Blueprint $table) => $table->dropColumn('show_birthdays'));
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['birthday_month_day', 'share_birthday']);
        });
    }
};
