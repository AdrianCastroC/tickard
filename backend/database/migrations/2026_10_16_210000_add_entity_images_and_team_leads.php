<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->string('image_path')->nullable();
        });
        Schema::table('teams', function (Blueprint $table) {
            $table->foreignId('lead_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('image_path')->nullable();
        });
        Schema::table('client_companies', function (Blueprint $table) {
            $table->string('image_path')->nullable();
            $table->string('icon', 20)->default('building');
        });

        // Repair legacy entities with no manager: prefer existing member, then Workspace owner.
        foreach (DB::table('departments')->join('workspaces', 'workspaces.id', '=', 'departments.workspace_id')
            ->select('departments.id', 'departments.lead_user_id', 'workspaces.owner_id')->get() as $department) {
            $lead = $department->lead_user_id
                ?: DB::table('department_user')->where('department_id', $department->id)
                    ->orderBy('user_id')->value('user_id');
            $lead ??= $department->owner_id;
            DB::table('department_user')->insertOrIgnore(['department_id' => $department->id, 'user_id' => $lead]);
            DB::table('departments')->where('id', $department->id)->update(['lead_user_id' => $lead]);
        }
        foreach (DB::table('teams')->join('workspaces', 'workspaces.id', '=', 'teams.workspace_id')
            ->select('teams.id', 'workspaces.owner_id')->get() as $team) {
            $lead = DB::table('team_user')->where('team_id', $team->id)->orderBy('user_id')->value('user_id')
                ?? $team->owner_id;
            DB::table('team_user')->insertOrIgnore(['team_id' => $team->id, 'user_id' => $lead]);
            DB::table('teams')->where('id', $team->id)->update(['lead_user_id' => $lead]);
        }
    }

    public function down(): void
    {
        Schema::table('client_companies', fn (Blueprint $table) => $table->dropColumn(['image_path', 'icon']));
        Schema::table('teams', function (Blueprint $table) {
            $table->dropConstrainedForeignId('lead_user_id');
            $table->dropColumn('image_path');
        });
        Schema::table('departments', fn (Blueprint $table) => $table->dropColumn('image_path'));
    }
};
