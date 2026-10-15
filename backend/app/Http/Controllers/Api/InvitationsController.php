<?php

namespace App\Http\Controllers\Api;

use App\Models\Project;
use Illuminate\Http\Request;

class InvitationsController extends ApiController
{
    // Retired in V1. Invitations are now sent to registered accounts and
    // accepted or rejected from the authenticated user's inbox.
    public function invite(Request $request, Project $project)
    {
        abort(410, 'Usa las invitaciones de Workspace o Personal del proyecto.');
    }

    public function showInvitation(string $token)
    {
        abort(410, 'Los enlaces antiguos de invitación ya no están disponibles.');
    }

    public function acceptInvitation(Request $request, string $token)
    {
        abort(410, 'Los enlaces antiguos de invitación ya no están disponibles.');
    }
}
