<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureVerifiedEmail
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->email_verified_at !== null, 403,
            'Verifica tu dirección de correo antes de acceder a Tickard.');
        return $next($request);
    }
}
