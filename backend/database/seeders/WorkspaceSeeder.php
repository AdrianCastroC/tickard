<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Seeder;

class WorkspaceSeeder extends Seeder
{
    public function run(): void
    {
        $ana = User::where('email', 'ana@gestor.test')->firstOrFail();
        $luis = User::where('email', 'luis@gestor.test')->firstOrFail();
        $marta = User::where('email', 'marta@gestor.test')->firstOrFail();
        $elena = User::where('email', 'elena@gestor.test')->firstOrFail();

        $anaWorkspace = Workspace::createInitialFor($ana);
        Workspace::createInitialFor($luis);
        Workspace::createInitialFor($marta);
        Workspace::createInitialFor($elena);

        $anaWorkspace->update([
            'name' => 'Altaris',
        ]);

        foreach ([$luis, $marta, $elena] as $member) {
            $anaWorkspace->memberships()->firstOrCreate([
                'user_id' => $member->id,
                'role' => 'member',
            ]);
        }
    }
}