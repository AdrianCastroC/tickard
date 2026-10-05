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
}