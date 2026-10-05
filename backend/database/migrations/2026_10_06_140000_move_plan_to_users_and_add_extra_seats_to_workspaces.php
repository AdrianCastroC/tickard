<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('plan')
                ->default('free')
                ->after('is_admin');
        });

        Schema::table('workspaces', function (Blueprint $table) {
            $table->unsignedInteger('extra_seats')
                ->default(0)
                ->after('owner_id');
        });

        $planPriority = [
            'free' => 0,
            'base' => 1,
            'pro' => 2,
            'business' => 3,
        ];

        $workspaces = DB::table('workspaces')
            ->select('owner_id', 'plan')
            ->get()
            ->groupBy('owner_id');

        foreach ($workspaces as $ownerId => $ownedWorkspaces) {
            $plan = $ownedWorkspaces
                ->pluck('plan')
                ->sortByDesc(fn ($plan) => $planPriority[$plan] ?? 0)
                ->first();

            DB::table('users')
                ->where('id', $ownerId)
                ->update([
                    'plan' => $plan ?? 'free',
                ]);
        }

        Schema::table('workspaces', function (Blueprint $table) {
            $table->dropColumn('plan');
        });
    }

    public function down(): void
    {
        Schema::table('workspaces', function (Blueprint $table) {
            $table->string('plan')
                ->default('free')
                ->after('owner_id');
        });

        DB::table('workspaces')
            ->orderBy('id')
            ->each(function ($workspace) {
                $plan = DB::table('users')
                    ->where('id', $workspace->owner_id)
                    ->value('plan');

                DB::table('workspaces')
                    ->where('id', $workspace->id)
                    ->update([
                        'plan' => $plan ?? 'free',
                    ]);
            });

        Schema::table('workspaces', function (Blueprint $table) {
            $table->dropColumn('extra_seats');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('plan');
        });
    }
};