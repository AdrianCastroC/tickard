<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Workspace;
use App\Support\ProjectFileStorage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AccountStorageController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $owned = Workspace::query()->where('owner_id', $user->id)->orderBy('id')->get();
        $isPro = $user->plan === User::PLAN_PRO;
        return response()->json([
            'plan' => $user->plan,
            'can_allocate' => $isPro,
            'account_limit_bytes' => $isPro ? ProjectFileStorage::PRO_ACCOUNT_QUOTA_BYTES : null,
            'account_used_bytes' => ProjectFileStorage::usedBytesForOwner($user->id),
            'workspaces' => $owned->map(fn (Workspace $workspace) => [
                'id' => $workspace->id,
                'name' => $workspace->name,
                'used_bytes' => ProjectFileStorage::usedBytes($workspace),
                'limit_bytes' => ProjectFileStorage::limitBytes($workspace),
                'allocation_mb' => $workspace->storage_allocation_mb,
            ])->values(),
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();
        abort_unless($user->plan === User::PLAN_PRO, 403,
            'La distribución de la cuota compartida está disponible en Pro.');
        $data = $request->validate([
            'allocations' => ['required', 'array'],
            'allocations.*' => ['nullable', 'integer', 'min:0', 'max:20480'],
        ]);
        DB::transaction(function () use ($user, $data) {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $owned = Workspace::query()->where('owner_id', $user->id)->lockForUpdate()->get();
            $requested = $data['allocations'];
            $ids = $owned->pluck('id')->map(fn ($id) => (string) $id)->all();
            if (count($requested) !== count($ids)
                || array_diff(array_keys($requested), $ids)
                || array_diff($ids, array_keys($requested))) {
                throw ValidationException::withMessages(['allocations' => 'Debes incluir únicamente todos tus Workspaces.']);
            }
            $manual = collect($requested)->filter(fn ($mb) => $mb !== null);
            if ($manual->sum() > 20480) {
                throw ValidationException::withMessages(['allocations' => 'Las cuotas asignadas superan los 20 GB.']);
            }
            $automaticCount = count($ids) - $manual->count();
            $automaticMb = $automaticCount > 0 ? intdiv(20480 - $manual->sum(), $automaticCount) : 0;
            foreach ($owned as $workspace) {
                $allocation = $requested[(string) $workspace->id];
                $effectiveMb = $allocation === null ? $automaticMb : (int) $allocation;
                if (ProjectFileStorage::usedBytes($workspace) > $effectiveMb * 1024 * 1024) {
                    throw ValidationException::withMessages([
                        'allocations' => "El Workspace {$workspace->name} utiliza más espacio del que le asignas.",
                    ]);
                }
            }
            foreach ($owned as $workspace) {
                $workspace->update(['storage_allocation_mb' => $requested[(string) $workspace->id]]);
            }
        });

        return $this->index($request);
    }
}
