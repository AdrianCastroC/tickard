<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Seeder;

class TeamSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $ana = User::where('email', 'ana@gestor.test')->firstOrFail();
        $luis = User::where('email', 'luis@gestor.test')->firstOrFail();
        $marta = User::where('email', 'marta@gestor.test')->firstOrFail();
        $workspace = $ana->workspaces()->where('name', 'Altaris')->firstOrFail();
        $development = Department::create(['workspace_id' => $workspace->id, 'name' => 'Desarrollo']);
        $development->members()->sync([$ana->id, $luis->id]);
        $product = Team::create(['workspace_id' => $workspace->id, 'name' => 'Producto']);
        $product->members()->sync([$ana->id, $luis->id]);
        $design = Team::create(['workspace_id' => $workspace->id, 'name' => 'Diseño']);
        $design->members()->sync([$marta->id]);
    }
}
