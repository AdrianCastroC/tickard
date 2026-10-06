<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::create([
            'name' => 'Ana Ruiz',
            'email' => 'ana@gestor.test',
            'password' => 'password',
            'is_admin' => true,
            'plan' => User::PLAN_PRO,
        ]);

        User::create([
            'name' => 'Luis Pérez',
            'email' => 'luis@gestor.test',
            'password' => 'password',
            'plan' => User::PLAN_BASE,
        ]);

        User::create([
            'name' => 'Marta Gil',
            'email' => 'marta@gestor.test',
            'password' => 'password',
            'plan' => User::PLAN_FREE,
        ]);

        User::create([
            'name' => 'Elena Soto',
            'email' => 'elena@gestor.test',
            'password' => 'password',
            'plan' => User::PLAN_FREE,
        ]);
    }
}