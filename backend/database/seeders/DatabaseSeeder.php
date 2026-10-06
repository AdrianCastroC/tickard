<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            WorkspaceSeeder::class,
            ProjectSeeder::class,
            TeamSeeder::class,
            CardSeeder::class,

            // Proyecto completo para pruebas de Gantt y KPIs.
            GanttDemoSeeder::class,
        ]);
    }
}
