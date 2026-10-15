<?php

namespace App\Http\Controllers\Api;

use App\Models\Invitation;
use App\Models\Project;
use App\Models\ProjectMember;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InvitationsController extends ApiController
{
    // Legacy project invitation links are still readable, but new invitations
    // should be issued at Workspace level, then assign project membership.
    public function invite(Request $request, Project $project)
    {
        abort(422, 'Invita primero al usuario desde Miembros e invitaciones del Workspace.');
    }

    public function showInvitation(string $token)
    {
        $invitation = Invitation::with('project.clientCompany')
            ->where('token', $token)->whereNull('accepted_at')->firstOrFail();

        abort_if(! $invitation->project, 410, 'Esta invitación ya no está disponible.');

        return response()->json([
            'kind' => 'project',
            'email' => $invitation->email,
            'project' => $invitation->project->name,
            'client' => $invitation->project->clientCompany?->name,
        ]);
    }

    public function acceptInvitation(Request $request, string $token)
    {
        // Never set the existing account's name or password from an invitation.
        // Require the user to authenticate independently with the invited email.
        $user = $request->user();
        $projectId = DB::transaction(function () use ($token, $user) {
            $invitation = Invitation::with('project')->where('token', $token)
                ->whereNull('accepted_at')->lockForUpdate()->firstOrFail();
            abort_unless(Str::lower(trim($user->email)) === Str::lower(trim($invitation->email)),
                403, 'Debes iniciar sesión con la cuenta del correo invitado.');
            abort_if(! $invitation->project, 410);

            // Project access is independent of the Workspace's membership.
            // Existing legacy invites may be for external client roles.
            ProjectMember::firstOrCreate(
                ['project_id' => $invitation->project_id, 'user_id' => $user->id],
                ['role' => $invitation->role]
            );
            $invitation->update(['accepted_at' => now()]);
            return $invitation->project_id;
        });

        return response()->json(['project_id' => $projectId]);
    }
}
