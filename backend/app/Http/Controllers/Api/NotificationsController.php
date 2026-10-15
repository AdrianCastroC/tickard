<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\User;
use App\Support\ProjectAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NotificationsController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $workspaceIds = $user->workspaces()->pluck('workspaces.id')->map(fn ($id) => (int) $id)->all();
        $notes = AppNotification::query()
            ->where('user_id', $user->id)
            ->with('card.board.project.workspace')
            ->latest('id')->limit(60)->get();

        return $notes->filter(function (AppNotification $note) use ($user, $workspaceIds) {
            if (! $note->card_id) return true;
            $card = $note->card;
            $project = $card?->board?->project;
            if (! $project || ! in_array((int) $project->workspace_id, $workspaceIds, true)
                || $card->archived_at !== null) return false;
            $role = ProjectAccess::role($user, $project);
            return $role !== null && ($role !== 'cliente' || ! $card->is_internal);
        })->map(function (AppNotification $note) {
            $card = $note->card;
            $project = $card?->board?->project;
            return [
                'id' => $note->id,
                'body' => $note->body,
                'kind' => $note->kind,
                'read_at' => $note->read_at?->toIso8601String(),
                'created_at' => $note->created_at?->toIso8601String(),
                'card' => $card && $project ? [
                    'id' => $card->id,
                    'board_id' => $card->board_id,
                    'project_id' => $project->id,
                    'workspace_id' => $project->workspace_id,
                ] : null,
            ];
        })->values();
    }

    public function read(Request $request, AppNotification $notification)
    {
        abort_unless((int) $notification->user_id === (int) $request->user()->id, 404);
        $notification->update(['read_at' => $notification->read_at ?? now()]);
        return response()->noContent();
    }

    public function readAll(Request $request)
    {
        AppNotification::query()->where('user_id', $request->user()->id)
            ->whereNull('read_at')->update(['read_at' => now()]);
        return response()->noContent();
    }
}
