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
                ->when($isClient, fn ($query) => $query
                    ->where('client_access_enabled', true)
                    ->where('client_company_id', WorkspaceClientAccess::companyId($user, $workspace)))
                ->when($isClient && (! $workspace->show_clients || ! $user->email_verified_at),
                    fn ($query) => $query->whereRaw('1 = 0'))
                ->count();

        return response()->json([
            'id' => $workspace->id,
            'name' => $workspace->name,
            'image_url' => $workspace->image_path ? '/storage/'.$workspace->image_path : null,
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
            'dashboard' => $this->overviewDashboard($workspace, $user, $canSeeOrganization, $isClient),
        ]);
    }


    /**
     * Compact dashboard: all queries are bounded to this Workspace and to
     * project/card permissions. Return real data only (no artificial examples).
     */
    private function overviewDashboard(Workspace $workspace, \App\Models\User $user, bool $canSeeOrganization, bool $isClient): array
    {
        $projectsQuery = $workspace->projects()
            ->when(! $canSeeOrganization, fn ($query) => $query
                ->whereHas('members', fn ($members) => $members->where('user_id', $user->id)))
            ->when($isClient, fn ($query) => $query
                ->where('client_access_enabled', true)
                ->where('client_company_id', WorkspaceClientAccess::companyId($user, $workspace)))
            ->when($isClient && (! $workspace->show_clients || ! $user->email_verified_at),
                fn ($query) => $query->whereRaw('1 = 0'));

        $projectIds = (clone $projectsQuery)->pluck('projects.id')->all();

        $cards = fn () => DB::table('cards')
            ->join('boards', 'boards.id', '=', 'cards.board_id')
            ->join('columns', 'columns.id', '=', 'cards.column_id')
            ->join('projects', 'projects.id', '=', 'boards.project_id')
            ->where('projects.workspace_id', $workspace->id)
            ->whereIn('projects.id', $projectIds)
            ->whereNull('cards.archived_at')
            ->when($isClient, fn ($query) => $query->where('cards.is_internal', false))
            ->when(! $canSeeOrganization, fn ($query) => $query->whereExists(function ($assigned) use ($user) {
                $assigned->selectRaw('1')->from('card_user')
                    ->whereColumn('card_user.card_id', 'cards.id')
                    ->where('card_user.user_id', $user->id);
            }));

        $totals = $cards()->selectRaw('COUNT(*) as total')
            ->selectRaw("COALESCE(SUM(CASE WHEN columns.workflow_state = 'done' THEN 1 ELSE 0 END), 0) as completed")
            ->first();

        $counts = $cards()->select('projects.id as project_id')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("COALESCE(SUM(CASE WHEN columns.workflow_state = 'done' THEN 1 ELSE 0 END), 0) as completed")
            ->selectRaw('MAX(cards.due_date) as latest_due_date')
            ->groupBy('projects.id')->get()->keyBy('project_id');

        // A short roster is sufficient for dashboard cards; don't expose
        // assignees to client accounts when the project disables that field.
        $roster = DB::table('project_members')
            ->join('projects', 'projects.id', '=', 'project_members.project_id')
            ->join('users', 'users.id', '=', 'project_members.user_id')
            ->where('projects.workspace_id', $workspace->id)
            ->whereIn('projects.id', $projectIds)
            ->where(function ($query) use ($isClient) {
                if ($isClient) {
                    $query->where('projects.show_assignee', true);
                }
            })
            ->orderBy('users.name')->orderBy('users.id')
            ->get(['project_members.project_id', 'users.id', 'users.name', 'users.avatar_path'])
            ->groupBy('project_id');

        $recentProjects = (clone $projectsQuery)
            ->orderByDesc('projects.updated_at')->orderByDesc('projects.id')
            ->limit(6)->get(['projects.id', 'projects.name', 'projects.description', 'projects.updated_at'])
            ->map(fn ($project) => [
                'id' => $project->id,
                'name' => $project->name,
                'description' => $project->description,
                'total' => (int) ($counts->get($project->id)?->total ?? 0),
                'completed' => (int) ($counts->get($project->id)?->completed ?? 0),
                'latest_due_date' => $counts->get($project->id)?->latest_due_date,
                'member_count' => $roster->get($project->id)?->count() ?? 0,
                'members' => ($roster->get($project->id) ?? collect())->take(3)
                    ->map(fn ($member) => [
                        'id' => $member->id, 'name' => $member->name,
                        'avatar_url' => $member->avatar_path ? '/storage/'.$member->avatar_path : null,
                    ])->values(),
            ])->values();

        $tasks = $cards()
            ->select('cards.id', 'cards.title', 'cards.due_date',
                'boards.id as board_id', 'projects.id as project_id', 'projects.name as project_name',
                'columns.workflow_state')
            ->where('columns.workflow_state', '<>', 'done')
            ->where('columns.workflow_state', '<>', 'backlog')
            ->orderByRaw('CASE WHEN cards.due_date IS NULL THEN 1 ELSE 0 END')
            ->orderBy('cards.due_date')->orderBy('cards.id')->limit(7)->get()
            ->map(fn ($task) => [
                'id' => $task->id, 'title' => $task->title,
                'board_id' => $task->board_id, 'project_id' => $task->project_id,
                'project_name' => $task->project_name, 'due_date' => $task->due_date,
                'state' => $task->workflow_state,
            ])->values();

        $activity = DB::table('activities')
            ->join('cards', 'cards.id', '=', 'activities.card_id')
            ->join('boards', 'boards.id', '=', 'cards.board_id')
            ->join('projects', 'projects.id', '=', 'boards.project_id')
            ->leftJoin('users', 'users.id', '=', 'activities.user_id')
            ->where('projects.workspace_id', $workspace->id)
            ->whereIn('projects.id', $projectIds)
            ->whereNull('cards.archived_at')
            ->when($isClient, fn ($query) => $query->where('cards.is_internal', false))
            ->when(! $canSeeOrganization, fn ($query) => $query->whereExists(function ($assigned) use ($user) {
                $assigned->selectRaw('1')->from('card_user')
                    ->whereColumn('card_user.card_id', 'cards.id')
                    ->where('card_user.user_id', $user->id);
            }))
            ->select('activities.id', 'activities.type', 'activities.meta', 'activities.created_at',
                'cards.id as card_id', 'cards.title as card_title',
                'boards.id as board_id', 'projects.id as project_id', 'projects.name as project_name',
                'users.id as user_id', 'users.name as user_name', 'users.avatar_path')
            ->orderByDesc('activities.id')->limit(40)->get()
            ->filter(function ($event) {
                if ($event->type !== 'commented') return true;
                $meta = json_decode($event->meta ?? '{}', true);
                return ! ($meta['internal'] ?? false);
            })->take(6)->map(fn ($event) => [
                'id' => $event->id, 'type' => $event->type,
                'card_id' => $event->card_id, 'card_title' => $event->card_title,
                'board_id' => $event->board_id, 'project_id' => $event->project_id,
                'project_name' => $event->project_name,
                'user_name' => $event->user_name ?? 'Sistema',
                'user_id' => $event->user_id,
                'avatar_url' => $event->avatar_path ? '/storage/'.$event->avatar_path : null,
                'created_at' => $event->created_at,
            ])->values();

        if (! $canSeeOrganization) {
            return [
                'cards' => ['total' => (int) $totals->total, 'completed' => (int) $totals->completed],
                'projects' => $recentProjects, 'tasks' => $tasks, 'activity' => $activity,
                'members' => [], 'teams' => [], 'departments' => [], 'clients' => [],
            ];
        }

        $members = $workspace->memberships()->with('user')->orderBy('id')->get()
            ->filter(fn ($member) => $member->user !== null
                && $member->role !== 'client'
                && ! WorkspaceClientAccess::isClient($member->user, $workspace))
            ->take(8)->map(fn ($member) => [
                'id' => $member->user->id, 'name' => $member->user->name,
                'avatar_url' => $member->user->avatarUrl(),
            ])->values();

        $teams = DB::table('teams')
            ->leftJoin('team_user', 'team_user.team_id', '=', 'teams.id')
            ->where('teams.workspace_id', $workspace->id)
            ->groupBy('teams.id', 'teams.name')
            ->orderBy('teams.name')->limit(6)
            ->get(['teams.id', 'teams.name', DB::raw('COUNT(team_user.user_id) as members')]);

        $departments = DB::table('departments')
            ->leftJoin('department_user', 'department_user.department_id', '=', 'departments.id')
            ->where('departments.workspace_id', $workspace->id)
            ->groupBy('departments.id', 'departments.name')
            ->orderBy('departments.name')->limit(6)
            ->get(['departments.id', 'departments.name', DB::raw('COUNT(department_user.user_id) as members')]);

        $clients = $workspace->show_clients
            ? DB::table('client_companies')->leftJoin('projects', 'projects.client_company_id', '=', 'client_companies.id')
                ->where('client_companies.workspace_id', $workspace->id)
                ->groupBy('client_companies.id', 'client_companies.name', 'client_companies.image_path')
                ->orderBy('client_companies.name')->limit(5)
                ->get(['client_companies.id', 'client_companies.name', 'client_companies.image_path', DB::raw('COUNT(projects.id) as projects')])
                ->map(fn ($client) => [
                    'id' => $client->id,
                    'name' => $client->name,
                    'projects' => $client->projects,
                    'image_url' => $client->image_path ? '/storage/'.$client->image_path : null,
                ])
            : collect();

        return [
            'cards' => ['total' => (int) $totals->total, 'completed' => (int) $totals->completed],
            'projects' => $recentProjects, 'tasks' => $tasks, 'activity' => $activity,
            'members' => $members, 'teams' => $teams, 'departments' => $departments, 'clients' => $clients,
        ];
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