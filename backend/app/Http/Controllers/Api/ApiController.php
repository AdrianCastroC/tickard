<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\Board;
use App\Models\Card;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Team;
use App\Models\User;
use App\Support\Notifier;
use App\Support\ProjectAccess;
use App\Models\Workspace;

class ApiController extends Controller
{
protected function internalIds(array $ids): array
    {
        return User::whereNull('client_company_id')->whereIn('id', $ids)->pluck('id')->all();
    }

    protected function syncCardTeams(Card $card, Project $project, array $teamIds, $alreadyNotified, User $actor): void
    {
        $ids = Team::where('workspace_id', $project->workspace_id)->whereIn('id', $teamIds)->pluck('id');
        $previous = $card->teams()->pluck('teams.id');
        $card->teams()->sync($ids);

        $next = $ids->map(fn ($id) => (int) $id)->sort()->values()->all();
        $before = $previous->map(fn ($id) => (int) $id)->sort()->values()->all();
        if ($next === $before) {
            return;
        }

        $added = $ids->diff($previous);
        if ($added->isNotEmpty()) {
            $projectUserIds = $project->members()->whereIn('role', ['responsable', 'editor', 'lector'])->pluck('user_id');
            $members = User::whereHas('teams', fn ($query) => $query->whereIn('teams.id', $added))
                ->whereIn('id', $projectUserIds)
                ->get();
            foreach ($members as $member) {
                if (collect($alreadyNotified)->contains($member->id)) {
                    continue;
                }
                Notifier::send($member, 'Han asignado «'.$card->title.'» a tu equipo.', $card, 'team');
            }
        }

        $card->activities()->create([
            'user_id' => $actor->id,
            'type' => 'assigned',
            'meta' => ['teams' => $ids->values()],
        ]);
    }

    protected function profile(User $user, ?int $workspaceId = null): array
    {
        $user->load(
            'clientCompany',
            'memberships.project.clientCompany',
            'memberships.project.boards'
        );

        $workspaces = $user->workspaces()
            ->withPivot('role')
            ->orderBy('name')
            ->get();

        $activeWorkspace = $workspaceId
            ? $workspaces->firstWhere('id', $workspaceId)
            : null;

        $activeWorkspace ??= $workspaces->first();

        $projects = $activeWorkspace
            ? Project::with(['clientCompany', 'boards'])
                ->where('workspace_id', $activeWorkspace->id)
                ->get()
                ->filter(
                    fn (Project $project) => ProjectAccess::canView($user, $project)
                )
                ->map(
                    fn (Project $project) => $this->projectSummary(
                        $project,
                        ProjectAccess::role($user, $project)
                    )
                )
                ->values()
            : collect();

        $unread = AppNotification::where('user_id', $user->id)
            ->whereNull('read_at')
            ->count();

        $workspaceList = $workspaces
            ->map(fn (Workspace $workspace) => [
                'id' => $workspace->id,
                'name' => $workspace->name,
                'image_url' => $workspace->image_path ? '/storage/'.$workspace->image_path : null,
                'role' => $workspace->pivot->role,
                'plan' => $workspace->effectivePlan(),
                'show_birthdays' => (bool) $workspace->show_birthdays,
                'show_clients' => (bool) $workspace->show_clients,
            ])
            ->values();

        return [
            'user' => $user->toApi(),
            'unread' => $unread,
            'workspaces' => $workspaceList,
            'projects' => $projects,
        ];
    }

    protected function projectSummary(Project $project, ?string $role): array
    {
        return [
            'id' => $project->id,
            'name' => $project->name,
            'image_url' => $project->image_path ? '/storage/'.$project->image_path : null,
            'workspace_id' => $project->workspace_id,
            'client_company_id' => $project->client_company_id,
            'client_access_enabled' => (bool) $project->client_access_enabled,
            'client_name' => $project->clientCompany?->name,
            'role' => $role,
            'boards' => $project->boards->map(fn (Board $board) => [
                'id' => $board->id,
                'name' => $board->name,
            ])->values(),
        ];
    }

    protected function resequence(int $columnId, ?Card $moving, int $position): void
    {
        $cards = Card::where('column_id', $columnId)
            ->whereNull('archived_at')
            ->when($moving, fn ($query) => $query->where('id', '!=', $moving->id))
            ->orderBy('position')
            ->get()
            ->values();

        if ($moving) {
            $position = min($position, $cards->count());
            $cards->splice($position, 0, [$moving]);
        }

        foreach ($cards as $index => $card) {
            $card->column_id = $columnId;
            $card->position = $index;
            $card->save();
        }
    }
}
