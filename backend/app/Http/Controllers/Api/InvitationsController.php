<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\ApiController;
use App\Models\AppNotification;
use App\Models\Board;
use App\Models\BoardCategory;
use App\Models\Card;
use App\Models\CardAttachment;
use App\Models\CardChecklistItem;
use App\Models\CardModule;
use App\Models\ClientCompany;
use App\Models\Column;
use App\Models\Comment;
use App\Models\Department;
use App\Models\Invitation;
use App\Models\Label;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Team;
use App\Models\User;
use App\Support\CardPresenter;
use App\Support\Notifier;
use App\Support\ProjectAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class InvitationsController extends ApiController
{
public function showInvitation(string $token)
    {
        $invitation = Invitation::with('project.clientCompany')->where('token', $token)->whereNull('accepted_at')->firstOrFail();

        return [
            'email' => $invitation->email,
            'name' => $invitation->name,
            'role' => $invitation->role,
            'project' => $invitation->project->name,
            'client' => $invitation->project->clientCompany->name,
        ];
    }

public function acceptInvitation(Request $request, string $token)
    {
        $invitation = Invitation::with('project')->where('token', $token)->whereNull('accepted_at')->firstOrFail();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $user = DB::transaction(function () use ($invitation, $data) {
            $user = User::firstOrCreate(
                ['email' => $invitation->email],
                [
                    'name' => $data['name'],
                    'password' => $data['password'],
                    'client_company_id' => $invitation->role === 'cliente' ? $invitation->project->client_company_id : null,
                ],
            );

            if (! $user->wasRecentlyCreated) {
                $user->update(['name' => $data['name'], 'password' => $data['password']]);
            }

            ProjectMember::updateOrCreate(
                ['project_id' => $invitation->project_id, 'user_id' => $user->id],
                ['role' => $invitation->role],
            );

            $invitation->update(['accepted_at' => now()]);

            return $user;
        });

        return [
            'token' => $user->createToken('api')->plainTextToken,
            'user' => $this->profile($user),
        ];
    }
}
