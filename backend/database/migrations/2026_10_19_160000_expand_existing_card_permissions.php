<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::table('workspace_custom_roles')->orderBy('id')->chunkById(100, function ($roles): void {
            foreach ($roles as $role) {
                $permissions = json_decode($role->permissions, true);
                if (! is_array($permissions) || ! in_array('cards.edit', $permissions, true)) continue;
                $permissions = array_values(array_unique(array_merge($permissions, [
                    'cards.create', 'cards.delete', 'cards.assign', 'cards.dates', 'cards.state',
                ])));
                DB::table('workspace_custom_roles')->where('id', $role->id)->update([
                    'permissions' => json_encode($permissions),
                ]);
            }
        });
    }

    public function down(): void
    {
        // Existing configured permissions must not be silently discarded on rollback.
    }
};
