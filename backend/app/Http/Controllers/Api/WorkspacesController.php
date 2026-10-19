<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Workspace;
use App\Support\WorkspaceClientAccess;
use App\Support\WorkspaceLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkspacesController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            WorkspaceLimits::canCreateWorkspace($user),
            403,
            'Has alcanzado el límite de workspaces de tu plan.'
        );

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]);

        $workspace = DB::transaction(function () use ($user, $data) {
            $workspace = Workspace::create([
                'name' => $data['name'],
                'owner_id' => $user->id,
                'extra_seats' => 0,
                'show_clients' => false,
            ]);

            $workspace->memberships()->create([
                'user_id' => $user->id,
                'role' => 'owner',
            ]);

            return $workspace;
        });

        return response()->json([
            'id' => $workspace->id,
            'name' => $workspace->name,
            'role' => 'owner',
            'plan' => $workspace->effectivePlan(),
        ], 201);
    }


    /**
     * Workspace-scoped overview. Internal organization totals are deliberately
     * hidden from client and non-manager accounts.
     */
    public function overview(Request $request, Workspace $workspace): JsonResponse
    {
        $user = $request->user();
        $membership = $workspace->memberships()
            ->where('user_id', $user->id)->first();
        abort_unless($membership !== null, 403);

        $isClient = $membership->role === 'client'
            || WorkspaceClientAccess::isClient($user, $workspace);
        $isOwner = (int) $workspace->owner_id === (int) $user->id;
        $canSeeOrganization = ! $isClient && (
            $isOwner || $membership->role === 'admin' || $user->is_admin
        );

        $projectsCount = $canSeeOrganization
            ? $workspace->projects()->count()
            : $workspace->projects()
                ->whereHas('members', fn ($query) =>
                    $query->where('user_id', $user->id))
                ->count();

        return response()->json([
            'id' => $workspace->id,
            'name' => $workspace->name,
            'role' => $membership->role,
            'plan' => $workspace->effectivePlan(),
            'can_manage' => $isOwner,
            'can_view_personnel' => $canSeeOrganization,
            'show_birthdays' => (bool) $workspace->show_birthdays,
            'show_clients' => (bool) $workspace->show_clients,
            'can_delete' => $isOwner && $user->ownedWorkspaces()->count() > 1,
            'stats' => [
                'projects' => $projectsCount,
                'members' => $canSeeOrganization ? $workspace->memberships()->count() : null,
                'departments' => $canSeeOrganization ? $workspace->departments()->count() : null,
                'teams' => $canSeeOrganization ? $workspace->teams()->count() : null,
                'clients' => $canSeeOrganization && $workspace->show_clients
                    ? $workspace->clientCompanies()->count() : null,
            ],
        ]);
    }

    public function update(Request $request, Workspace $workspace): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $workspace->owner_id === $user->id,
            403,
            'Solo el propietario puede editar este workspace.'
        );

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]);

        $name = trim($data['name']);
        abort_if($name === '', 422, 'El nombre del Workspace no puede estar vacío.');

        $workspace->update([
            'name' => $name,
        ]);

        return response()->json([
            'id' => $workspace->id,
            'name' => $workspace->name,
            'role' => 'owner',
            'plan' => $workspace->effectivePlan(),
        ]);
    }

    public function updateBirthdaySettings(Request $request, Workspace $workspace): JsonResponse
    {
        abort_unless(
            (int) $workspace->owner_id === (int) $request->user()->id,
            403,
            'Solo el propietario puede configurar este Workspace.'
        );

        $data = $request->validate(['show_birthdays' => ['required', 'boolean']]);
        $workspace->update(['show_birthdays' => $data['show_birthdays']]);

        return response()->json(['id' => $workspace->id, 'show_birthdays' => (bool) $workspace->show_birthdays]);
    }

    public function updateClientSettings(Request $request, Workspace $workspace): JsonResponse
    {
        abort_unless((int) $workspace->owner_id === (int) $request->user()->id, 403,
            'Solo el propietario puede configurar este Workspace.');
        $data = $request->validate(['show_clients' => ['required', 'boolean']]);
        $workspace->update(['show_clients' => $data['show_clients']]);
        return response()->json(['id' => $workspace->id, 'show_clients' => (bool) $workspace->show_clients]);
    }

    public function destroy(Request $request, Workspace $workspace): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $workspace->owner_id === $user->id,
            403,
            'Solo el propietario puede eliminar este workspace.'
        );

        abort_if(
            $user->ownedWorkspaces()->count() <= 1,
            422,
            'No puedes eliminar tu único workspace.'
        );

        $data = $request->validate([
            'confirmation_name' => ['required', 'string'],
        ]);

        abort_unless(
            $data['confirmation_name'] === $workspace->name,
            422,
            'El nombre de confirmación no coincide.'
        );

        $workspace->delete();

        return response()->json([
            'message' => 'Workspace eliminado correctamente.',
        ]);
    }
}