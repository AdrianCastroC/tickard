<?php

namespace App\Support;

use App\Models\AppNotification;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

class Notifier
{
    public static function send(User $user, string $body): void
    {
        if ($user->notify_in_app) {
            AppNotification::create([
                'user_id' => $user->id,
                'body' => $body,
            ]);
        }

        if ($user->notify_email) {
            Mail::raw($body, function ($message) use ($user) {
                $message->to($user->email)->subject('Gestor de tareas');
            });
        }
    }
}
