<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->string('professional_phone', 30)->nullable());
        Schema::table('client_companies', function (Blueprint $table) {
            $table->string('client_type', 20)->default('company');
            $table->string('sector', 120)->nullable();
            $table->text('description')->nullable();
            $table->string('status', 12)->default('active');
            $table->foreignId('primary_contact_user_id')->nullable()
                ->constrained('users')->nullOnDelete();
        });
    }
    public function down(): void
    {
        Schema::table('client_companies', function (Blueprint $table) {
            $table->dropConstrainedForeignId('primary_contact_user_id');
            $table->dropColumn(['client_type', 'sector', 'description', 'status']);
        });
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('professional_phone'));
    }
};
