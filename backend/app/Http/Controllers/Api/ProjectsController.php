<?php

namespace App\Http\Controllers\Api;

use App\Models\Board;
use App\Models\BoardCategory;
use App\Models\Card;
use App\Models\ClientCompany;
use App\Models\Column;
use App\Models\Invitation;
use App\Models\Label;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\CardPresenter;
use App\Support\ProjectAccess;
use App\Support\ProjectFileStorage;
use App\Support\WorkspacePersonnelGuard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\File;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProjectsController extends ApiController
{
    public function storeProject(Request $request)
    {
        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'client_name' => ['nullable', 'string', 'max:120'],
            'client_company_id' => ['nullable', 'integer'],
            'client_access_enabled' => ['sometimes', 'boolean'],
            'image' => ['nullable', File::types(['jpg', 'jpeg', 'png', 'webp'])->max(2048)],
            'show_description' => ['sometimes', 'boolean'],
            'show_assignee' => ['sometimes', 'boolean'],
            'show_due_date' => ['sometimes', 'boolean'],
            'show_priority' => ['sometimes', 'boolean'],
            'show_labels' => ['sometimes', 'boolean'],
            'show_comments' => ['sometimes', 'boolean'],
        ]);

        $workspace = Workspace::whereKey($data['workspace_id'])
            ->whereHas('members', fn ($query) => $query->where('users.id', $request->user()->id)
            )
            ->firstOrFail();

        abort_unless(WorkspacePersonnelGuard::canManage($request, $workspace, 'workspace.projects'), 403);

        $imagePath = null;
        try {
        $project = DB::transaction(function () use ($data, $workspace, $request, &$imagePath) {
            $client = null;
            if ($workspace->show_clients) {
                if (! empty($data['client_company_id'])) {
                    $client = ClientCompany::where('workspace_id', $workspace->id)
                        ->findOrFail($data['client_company_id']);
                } elseif (filled($data['client_name'] ?? null)) {
                    $client = ClientCompany::where('workspace_id', $workspace->id)
                        ->where('name', trim($data['client_name']))->first();
                    abort_unless($client, 422, 'La empresa debe existir y tener un representante antes de asociarla al proyecto.');
                }
            } elseif (! empty($data['client_company_id']) || filled($data['client_name'] ?? null)) {
                abort(422, 'Activa el módulo Clientes antes de asociar una empresa.');
            }

            $project = Project::create([
                'workspace_id' => $workspace->id,
                'name' => $data['name'],
                'description' => trim($data['description'] ?? '') ?: null,
                'client_company_id' => $client?->id,
                'client_access_enabled' => (bool) ($data['client_access_enabled'] ?? false) && $client !== null,
                'show_description' => $data['show_description'] ?? true,
                'show_assignee' => $data['show_assignee'] ?? true,
                'show_due_date' => $data['show_due_date'] ?? true,
                'show_priority' => $data['show_priority'] ?? true,
                'show_labels' => $data['show_labels'] ?? true,
                'show_comments' => $data['show_comments'] ?? true,
            ]);

            if ($request->hasFile('image')) {
                $imagePath = $request->file('image')->store(
                    "workspace-entities/{$workspace->id}/projects/{$project->id}", 'public'
                );
                $project->update(['image_path' => $imagePath]);
            }

            $board = $project->boards()->create([
                'name' => 'General',
                'position' => 0,
            ]);

            $board->createDefaultColumns();

            return $project->load('clientCompany', 'boards');
        });

        } catch (\Throwable $e) {
            if ($imagePath) Storage::disk('public')->delete($imagePath);
            throw $e;
        }

        return response()->json(
            $this->projectSummary($project, 'responsable', $request->user()),
            201
        );
    }

    public function deleteProject(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::has($request->user(), $project, 'project.delete'), 403);

        $data = $request->validate([
            'confirmation_name' => ['required', 'string'],
        ]);

        abort_unless(
            $data['confirmation_name'] === $project->name,
            422,
            'El nombre del proyecto no coincide.'
        );

        $paths = ProjectFileStorage::pathsForProject($project);
        $project->delete();
        ProjectFileStorage::purgePaths($paths);

        return response()->noContent();
    }

    public function storeBoard(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::canManageBoards($request->user(), $project), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
        ]);

        $position = ((int) $project->boards()->max('position')) + 1;

        $board = DB::transaction(function () use ($project, $data, $position) {
            $board = $project->boards()->create([
                'name' => $data['name'],
                'position' => $position,
            ]);

            $board->createDefaultColumns();

            return $board;
        });

        return response()->json([
            'id' => $board->id,
            'name' => $board->name,
        ], 201);
    }

    public function deleteBoard(Request $request, Board $board)
    {
        abort_unless(
            ProjectAccess::canManageBoards($request->user(), $board->project),
            403
        );

        $hasCards = $board->cards()->exists();

        if ($hasCards) {
            $data = $request->validate([
                'confirmation_name' => ['required', 'string'],
            ]);

            abort_unless(
                $data['confirmation_name'] === $board->name,
                422,
                'El nombre del tablero no coincide.'
            );
        }

        $paths = ProjectFileStorage::pathsForBoard($board);
        $board->delete();
        ProjectFileStorage::purgePaths($paths);

        return response()->noContent();
    }

    public function uploadProjectImage(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::canManage($request->user(), $project), 403);
        $request->validate([
            'image' => ['required', File::types(['jpg', 'jpeg', 'png', 'webp'])->max(2048)],
        ]);

        $old = $project->image_path;
        $path = $request->file('image')->store(
            "workspace-entities/{$project->workspace_id}/projects/{$project->id}",
            'public'
        );
        try {
            $project->update(['image_path' => $path]);
        } catch (\Throwable $e) {
            Storage::disk('public')->delete($path);
            throw $e;
        }
        if ($old) Storage::disk('public')->delete($old);

        return response()->json(['image_url' => '/storage/'.$path]);
    }

    public function deleteProjectImage(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::canManage($request->user(), $project), 403);
        $old = $project->image_path;
        $project->update(['image_path' => null]);
        if ($old) Storage::disk('public')->delete($old);
        return response()->noContent();
    }

    public function projectSettings(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::canManage($request->user(), $project), 403);

        $workspace = $project->workspace;

        return response()->json([
            'id' => $project->id,
            'name' => $project->name,
            'image_url' => $project->image_path ? '/storage/'.$project->image_path : null,
            'description' => $project->description,
            'client_company_id' => $project->client_company_id,
            'client_access_enabled' => (bool) $project->client_access_enabled,
            'workspace_clients_enabled' => (bool) $workspace->show_clients,
            'clients' => $workspace->show_clients
                ? $workspace->clientCompanies()->orderBy('name')->get(['id', 'name'])
                : [],
            'visibility' => [
                'description' => (bool) $project->show_description,
                'assignee' => (bool) $project->show_assignee,
                'due_date' => (bool) $project->show_due_date,
                'priority' => (bool) $project->show_priority,
                'labels' => (bool) $project->show_labels,
                'comments' => (bool) $project->show_comments,
            ],
        ]);
    }

    public function updateProject(Request $request, Project $project)
    {
        abort_unless(
            ProjectAccess::canManage($request->user(), $project),
            403
        );

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'show_description' => ['sometimes', 'boolean'],
            'show_assignee' => ['sometimes', 'boolean'],
            'show_due_date' => ['sometimes', 'boolean'],
            'show_priority' => ['sometimes', 'boolean'],
            'show_labels' => ['sometimes', 'boolean'],
            'show_comments' => ['sometimes', 'boolean'],
            'client_company_id' => ['sometimes', 'nullable', 'integer'],
            'client_access_enabled' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('description', $data)) {
            $data['description'] = trim($data['description'] ?? '') ?: null;
        }
        if (array_key_exists('name', $data)) {
            $data['name'] = trim($data['name']);
            abort_if($data['name'] === '', 422, 'El nombre del proyecto no puede estar vacío.');
        }

        if (array_key_exists('client_company_id', $data) || array_key_exists('client_access_enabled', $data)) {
            $workspace = $project->workspace;
            $clientId = array_key_exists('client_company_id', $data)
                ? $data['client_company_id'] : $project->client_company_id;
            $enabled = array_key_exists('client_access_enabled', $data)
                ? $data['client_access_enabled'] : $project->client_access_enabled;
            abort_if($enabled && (! $workspace->show_clients || ! $clientId), 422,
                'Para permitir acceso de clientes, selecciona primero una empresa y habilita Clientes en el Workspace.');
            if ($clientId !== null) {
                abort_unless($workspace->clientCompanies()->whereKey($clientId)->exists(), 422,
                    'La empresa seleccionada no pertenece a este Workspace.');
            }
            if ($clientId !== $project->client_company_id && $project->client_access_enabled) {
                abort(422, 'Desactiva el acceso de clientes antes de cambiar la empresa.');
            }
        }
        $project->update($data);

        return $project->fresh();
    }

    public function storeLabel(Request $request, Project $project)
    {
        abort_unless(
            ProjectAccess::canEditCards($request->user(), $project),
            403
        );

        $data = $request->validate([
            'name' => ['required', 'string', 'max:40'],
            'tone' => [
                'required',
                Rule::in([
                    'bosque',
                    'bambu',
                    'niebla',
                    'tinta',
                    'ciruela',
                    'arena',
                ]),
            ],
        ]);

        $label = $project->labels()->create($data);

        return response()->json($label, 201);
    }

    public function invite(Request $request, Project $project)
    {
        abort_unless(
            ProjectAccess::canManage($request->user(), $project),
            403
        );

        $data = $request->validate([
            'email' => ['required', 'email'],
            'name' => ['nullable', 'string', 'max:120'],
            'role' => [
                'required',
                Rule::in([
                    'responsable',
                    'editor',
                    'lector',
                    'cliente',
                ]),
            ],
        ]);

        abort_if($data['role'] === 'cliente' && (! $project->client_access_enabled || ! $project->workspace->show_clients || ! $project->client_company_id), 422,
            'Activa primero el acceso de clientes a este proyecto.');
        $invitation = Invitation::create([
            'email' => $data['email'],
            'name' => $data['name'] ?? null,
            'token' => Str::random(40),
            'project_id' => $project->id,
            'role' => $data['role'],
            'invited_by' => $request->user()->id,
        ]);

        $link = rtrim(
            (string) config('app.frontend_url'),
            '/'
        ).'/invitar/'.$invitation->token;

        Mail::raw(
            'Te han invitado a '.$project->name.'. Abre '.$link,
            function ($message) use ($data) {
                $message
                    ->to($data['email'])
                    ->subject('Invitación al gestor de tareas');
            },
        );

        return response()->json([
            'link' => $link,
        ], 201);
    }

    public function showBoard(Request $request, Board $board)
    {
        $project = $board
            ->project()
            ->with(
                'clientCompany',
                'labels',
                'members.user'
            )
            ->first();

        $role = ProjectAccess::role(
            $request->user(),
            $project
        );

        abort_unless($role, 403);

        // Project Gantt only needs scheduling fields. Avoid hydrating comments,
        // reactions, activities and full checklist payloads on every board.
        $compactGantt = $request->boolean('gantt');
        $compactCalendar = $request->boolean('calendar');
        // The calendar has a dedicated compact payload. Non-admins receive
        // only Cards explicitly assigned to their user. Project responsables
        // can see the entire project even without a global admin flag.
        $relations = $compactCalendar ? [
            'creator',
            'assignees',
        ] : ($compactGantt ? [
            'creator',
            'assignees',
            'teams',
            'labels',
            'attachments',
            'checklistItems',
            'modules.checklistItems',
            'predecessorDependencies.predecessor.board',
            'successorDependencies.successor.board',
        ] : [
            'creator',
            'assignees',
            'teams.members',
            'labels',
            'comments.user',
            'comments.reactions',
            'activities.user',
            'checklistItems.assignees',
            'modules.checklistItems.assignees',
            'attachments',
            'predecessorDependencies.predecessor.column',
            'successorDependencies.successor.column',
        ]);
        $board->load([
            'categories',
            'columns.cards' => fn ($query) => $query
                ->whereNull('archived_at')
                ->when($compactCalendar && ! $request->user()->is_admin && $role !== 'responsable',
                    fn ($scoped) => $scoped->whereHas('assignees',
                        fn ($assigned) => $assigned->where('users.id', $request->user()->id)))
                ->with($relations)
                ->orderBy('position'),
        ]);

        $columns = $board->columns->map(
            function (Column $column) use ($request, $project, $role, $compactGantt, $compactCalendar) {
                $cards = $column->cards
                    ->filter(
                        fn (Card $card) => $role !== 'cliente' || ! $card->is_internal
                    )
                    ->map(
                        fn (Card $card) => $compactCalendar
                            ? CardPresenter::calendar($card, $request->user(), $project, $role)
                            : ($compactGantt
                                ? CardPresenter::gantt($card, $request->user(), $project, $role)
                                : CardPresenter::make($card, $request->user(), $project, $role))
                    )
                    ->values();

                return [
                    'id' => $column->id,
                    'name' => $column->name,
                    'color' => $column->color,
                    'position' => $column->position,
                    'workflow_state' => $column->workflow_state,
                    'cards' => $cards,
                ];
            }
        );

        return [
            'revision' => $board->revision,
            'view' => 'kanban',
            'role' => $role,
            'permissions' => ProjectAccess::permissions($request->user(), $project),

            'board' => [
                'id' => $board->id,
                'name' => $board->name,
                'project_id' => $project->id,
                'project_name' => $project->name,
                'client_name' => $project->clientCompany?->name,
                'client_access_enabled' => (bool) $project->client_access_enabled,
            ],

            'visibility' => [
                'description' => $project->show_description,
                'assignee' => $project->show_assignee,
                'due_date' => $project->show_due_date,
                'priority' => $project->show_priority,
                'labels' => $project->show_labels,
                'comments' => $project->show_comments,
            ],

            'members' => $project->members
                ->map(
                    fn (ProjectMember $member) => [
                        'id' => $member->user->id,
                        'name' => $member->user->name,
                        'role' => $member->role,
                        'avatar_url' => $member->user->avatarUrl(),
                    ]
                )
                ->values(),

            'labels' => $project->labels
                ->map(
                    fn (Label $label) => [
                        'id' => $label->id,
                        'name' => $label->name,
                        'tone' => $label->tone,
                    ]
                )
                ->values(),

            'categories' => $board->categories
                ->map(
                    fn (BoardCategory $category) => [
                        'id' => $category->id,
                        'name' => $category->name,
                        'position' => $category->position,
                    ]
                )
                ->values(),

            'teams' => $role === 'cliente'
                ? []
                : Team::where(
                    'workspace_id',
                    $project->workspace_id
                )
                    ->orderBy('name')
                    ->get(['id', 'name']),

            'columns' => $columns,
        ];
    }
}
