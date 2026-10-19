<?php

namespace Database\Seeders;

use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Seeder;

class ProjectSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $ana = User::where('email', 'ana@gestor.test')->firstOrFail();
        $luis = User::where('email', 'luis@gestor.test')->firstOrFail();
        $marta = User::where('email', 'marta@gestor.test')->firstOrFail();
        $elena = User::where('email', 'elena@gestor.test')->firstOrFail();
        $workspace = $ana->workspaces()->where('name', 'Altaris')->firstOrFail();
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Norte Digital']);
        $elena->update(['client_company_id' => $client->id]);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Portal de clientes', 'client_company_id' => $client->id]);
        foreach ([[$ana, 'responsable'], [$luis, 'editor'], [$marta, 'lector'], [$elena, 'cliente']] as [$user, $role]) {
            $project->members()->create(['user_id' => $user->id, 'role' => $role]);
        }
        foreach ([['Frontend', 'bosque'], ['Backend', 'bambu'], ['Diseño', 'ciruela']] as [$name, $tone]) {
            $project->labels()->create(['name' => $name, 'tone' => $tone]);
        }
        $board = $project->boards()->create(['name' => 'Entrega marzo', 'position' => 0]);
        $board->createDefaultColumns();
    }
}
