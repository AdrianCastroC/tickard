<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new \RuntimeException('Los datos y contraseñas de demostración solo pueden sembrarse en entornos locales o de prueba.');
        }
        $this->call([
            UserSeeder::class,
            WorkspaceSeeder::class,
            ProjectSeeder::class,
            TeamSeeder::class,
            CardSeeder::class,

            // Proyecto completo para pruebas de Nébula Mobile, Gantt y KPIs.
            NebulaMobileDemoSeeder::class,
            // Identity assets from docs/: safe to reapply without recreating projects.
            DemoBrandAssetsSeeder::class,
        ]);
    }
}
