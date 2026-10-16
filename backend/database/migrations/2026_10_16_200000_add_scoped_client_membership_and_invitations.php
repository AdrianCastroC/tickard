<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('workspace_members', function (Blueprint $table) {
            $table->foreignId('client_company_id')->nullable()->constrained('client_companies')->nullOnDelete();
        });
        Schema::table('workspace_invitations', function (Blueprint $table) {
            $table->string('client_company_name', 120)->nullable();
            $table->string('client_type', 20)->nullable();
            $table->string('client_sector', 120)->nullable();
            $table->text('client_description')->nullable();
        });

        // Migrate existing company memberships without changing the user's global profile.
        DB::table('workspace_members')->join('users', 'users.id', '=', 'workspace_members.user_id')
            ->join('client_companies', 'client_companies.id', '=', 'users.client_company_id')
            ->whereColumn('workspace_members.workspace_id', 'client_companies.workspace_id')
            ->select('workspace_members.id', 'users.client_company_id')
            ->orderBy('workspace_members.id')->chunkById(100, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('workspace_members')->where('id', $row->id)->update([
                        'client_company_id' => $row->client_company_id, 'role' => 'client',
                    ]);
                }
            }, 'workspace_members.id', 'id');
    }

    public function down(): void
    {
        Schema::table('workspace_invitations', function (Blueprint $table) {
            $table->dropColumn(['client_company_name', 'client_type', 'client_sector', 'client_description']);
        });
        Schema::table('workspace_members', function (Blueprint $table) {
            $table->dropConstrainedForeignId('client_company_id');
        });
    }
};
