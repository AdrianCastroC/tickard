<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Workspace;
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

        $workspace->update([
            'name' => $data['name'],
        ]);

        return response()->json([
            'id' => $workspace->id,
            'name' => $workspace->name,
            'role' => 'owner',
            'plan' => $workspace->effectivePlan(),
        ]);
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