<?php

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        User::query()->eachById(function (User $user) {
            Workspace::createInitialFor($user);
        });
    }

    public function down(): void
    {
        // The schema does not identify which "Mi espacio" records this backfill created.
        // Keep the data on rollback rather than risking deletion of a user's workspace.
    }
};
