<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Models\WorkspaceInvitation;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('invitations:prune', function () {
    $count = WorkspaceInvitation::where('status', 'accepted')
        ->where('responded_at', '<=', now()->subDays(5))->delete();
    $this->info("Invitaciones aceptadas eliminadas: {$count}");
})->purpose('Borrar las invitaciones aceptadas hace más de cinco días');

Schedule::command('invitations:prune')->daily();
