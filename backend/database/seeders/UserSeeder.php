<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new \RuntimeException('Los datos y contraseñas de demostración solo pueden sembrarse en entornos locales o de prueba.');
        }
        User::create([
            'first_name' => 'Ana',
            'last_name' => 'Ruiz',
            'email' => 'ana@gestor.test',
            'password' => 'password',
            'is_admin' => true,
            'plan' => User::PLAN_PRO,
        ]);

        User::create([
            'first_name' => 'Luis',
            'last_name' => 'Pérez',
            'email' => 'luis@gestor.test',
            'password' => 'password',
            'plan' => User::PLAN_BASE,
        ]);

        User::create([
            'first_name' => 'Marta',
            'last_name' => 'Gil',
            'email' => 'marta@gestor.test',
            'password' => 'password',
            'plan' => User::PLAN_FREE,
        ]);

        User::create([
            'first_name' => 'Elena',
            'last_name' => 'Soto',
            'email' => 'elena@gestor.test',
            'password' => 'password',
            'plan' => User::PLAN_FREE,
        ]);
    }
}