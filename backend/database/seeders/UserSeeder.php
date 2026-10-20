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
            'email_verified_at' => now(),
            'is_admin' => true,
            'plan' => User::PLAN_PRO,
        ]);

        User::create([
            'first_name' => 'Luis',
            'last_name' => 'Pérez',
            'email' => 'luis@gestor.test',
            'password' => 'password',
            'email_verified_at' => now(),
            'plan' => User::PLAN_BASE,
        ]);

        User::create([
            'first_name' => 'Marta',
            'last_name' => 'Gil',
            'email' => 'marta@gestor.test',
            'password' => 'password',
            'email_verified_at' => now(),
            'plan' => User::PLAN_FREE,
        ]);

        User::create([
            'first_name' => 'Elena',
            'last_name' => 'Soto',
            'email' => 'elena@gestor.test',
            'password' => 'password',
            'email_verified_at' => now(),
            'plan' => User::PLAN_FREE,
        ]);
        // email_verified_at is intentionally not mass assignable. Demo accounts
        // are explicitly verified, and this seeder is blocked in production.
        User::whereIn('email', [
            'ana@gestor.test', 'luis@gestor.test',
            'marta@gestor.test', 'elena@gestor.test',
        ])->update(['email_verified_at' => now()]);
    }
}