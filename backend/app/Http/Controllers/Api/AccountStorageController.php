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

    public function workspace(Request $request, Workspace $workspace)
    {
        $member = $workspace->memberships()->where('user_id', $request->user()->id)->exists();
        abort_unless($member && \App\Support\WorkspacePersonnelGuard::canConfigure($request, $workspace), 403);

        $projects = $workspace->projects()->orderBy('name')->get(['id', 'name']);
        $counts = DB::table('project_files')
            ->whereIn('project_id', $projects->pluck('id'))
            ->selectRaw('project_id, SUM(size) as bytes')->groupBy('project_id')->pluck('bytes', 'project_id');
        $attachments = DB::table('card_attachments')
            ->join('cards', 'cards.id', '=', 'card_attachments.card_id')
            ->join('boards', 'boards.id', '=', 'cards.board_id')
            ->whereIn('boards.project_id', $projects->pluck('id'))
            ->selectRaw('boards.project_id, SUM(card_attachments.size) as bytes')
            ->groupBy('boards.project_id')->pluck('bytes', 'boards.project_id');

        return response()->json([
            'used_bytes' => ProjectFileStorage::usedBytes($workspace),
            'limit_bytes' => ProjectFileStorage::limitBytes($workspace),
            'is_account_shared' => $workspace->effectivePlan() === User::PLAN_PRO,
            'can_allocate' => $workspace->owner_id === $request->user()->id,
            'projects' => $projects->map(fn ($project) => [
                'id' => $project->id, 'name' => $project->name,
                'used_bytes' => (int) ($counts[$project->id] ?? 0) + (int) ($attachments[$project->id] ?? 0),
                'allocation_mb' => $project->storage_allocation_mb,
            ])->values(),
        ]);
    }

    public function updateWorkspace(Request $request, Workspace $workspace)
    {
        abort_unless((int) $workspace->owner_id === (int) $request->user()->id, 403);
        $data = $request->validate([
            'allocations' => ['required', 'array'],
            'allocations.*' => ['nullable', 'integer', 'min:0'],
        ]);
        DB::transaction(function () use ($request, $workspace, $data) {
            User::query()->whereKey($workspace->owner_id)->lockForUpdate()->firstOrFail();
            $projects = $workspace->projects()->lockForUpdate()->get();
            $requested = $data['allocations'];
            $ids = $projects->pluck('id')->map(fn ($id) => (string) $id)->all();
            if (count($requested) !== count($ids)
                || array_diff(array_keys($requested), $ids)
                || array_diff($ids, array_keys($requested))) {
                throw ValidationException::withMessages(['allocations' => 'Debes incluir todos los proyectos de este Workspace.']);
            }
            $limit = ProjectFileStorage::limitBytes($workspace);
            $manual = collect($requested)->filter(fn ($mb) => $mb !== null);
            $reserved = (int) $manual->sum() * 1024 * 1024;
            if ($limit !== null && $reserved > $limit) {
                throw ValidationException::withMessages(['allocations' => 'Las cuotas superan el almacenamiento del Workspace.']);
            }
            $automaticCount = count($ids) - $manual->count();
            $automaticLimit = $limit !== null && $automaticCount > 0
                ? intdiv($limit - $reserved, $automaticCount) : null;
            foreach ($projects as $project) {
                $value = $requested[(string) $project->id];
                $effective = $value === null ? $automaticLimit : (int) $value * 1024 * 1024;
                if ($effective !== null && ProjectFileStorage::usedBytesForProject($project) > $effective) {
                    throw ValidationException::withMessages([
                        'allocations' => 'El proyecto '.$project->name.' utiliza más espacio del asignado.',
                    ]);
                }
            }
            foreach ($projects as $project) {
                $project->update(['storage_allocation_mb' => $requested[(string) $project->id]]);
            }
        });
        return $this->workspace($request, $workspace);
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
                ProjectFileStorage::assertProjectsFit($workspace, $effectiveMb * 1024 * 1024);
            }
            foreach ($owned as $workspace) {
                $workspace->update(['storage_allocation_mb' => $requested[(string) $workspace->id]]);
            }
        });

        return $this->index($request);
    }
}
