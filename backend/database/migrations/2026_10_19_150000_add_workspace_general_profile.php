<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('workspaces', function (Blueprint $table) {
            $table->string('description', 500)->nullable();
            $table->string('website_url', 255)->nullable();
            $table->string('contact_email', 255)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('workspaces', fn (Blueprint $table) => $table->dropColumn(['description', 'website_url', 'contact_email']));
    }
};
