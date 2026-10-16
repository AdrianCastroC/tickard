<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // Existing Workspaces retain Clientes; new ones explicitly opt in.
        Schema::table('workspaces', function (Blueprint $table) {
            $table->boolean('show_clients')->default(true);
        });
        Schema::table('projects', function (Blueprint $table) {
            $table->foreignId('client_company_id')->nullable()->change();
        });
    }
    public function down(): void
    {
        if (DB::table('projects')->whereNull('client_company_id')->exists()) {
            throw new \RuntimeException('Asocia los proyectos sin cliente antes de revertir la migración.');
        }
        Schema::table('projects', function (Blueprint $table) {
            $table->foreignId('client_company_id')->nullable(false)->change();
        });
        Schema::table('workspaces', fn (Blueprint $table) => $table->dropColumn('show_clients'));
    }
};
