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
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProjectsController extends ApiController
{
    public function storeProject(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);

        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
            'name' => ['required', 'string', 'max:120'],
            'client_name' => ['required', 'string', 'max:120'],
        ]);

        $workspace = Workspace::whereKey($data['workspace_id'])
            ->whereHas('members', fn ($query) => $query->where('users.id', $request->user()->id)
            )
            ->firstOrFail();

        $project = DB::transaction(function () use ($data, $workspace) {
            $client = ClientCompany::create([
                'workspace_id' => $workspace->id,
                'name' => $data['client_name'],
            ]);

            $project = Project::create([
                'workspace_id' => $workspace->id,
                'name' => $data['name'],
                'client_company_id' => $client->id,
            ]);

            $board = $project->boards()->create([
                'name' => 'General',
                'position' => 0,
            ]);

            $board->createDefaultColumns();

            return $project->load('clientCompany', 'boards');
        });

        return response()->json(
            $this->projectSummary($project, 'responsable'),
            201
        );
    }

    public function deleteProject(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::canManage($request->user(), $project), 403);

        $data = $request->validate([
            'confirmation_name' => ['required', 'string'],
        ]);

        abort_unless(
            $data['confirmation_name'] === $project->name,
            422,
            'El nombre del proyecto no coincide.'
        );

        $project->delete();

        return response()->noContent();
    }

    public function storeBoard(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::canManage($request->user(), $project), 403);

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
            ProjectAccess::canManage($request->user(), $board->project),
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

        $board->delete();

        return response()->noContent();
    }

    public function updateProject(Request $request, Project $project)
    {
        abort_unless(
            ProjectAccess::canManage($request->user(), $project),
            403
        );

        $data = $request->validate([
            'show_description' => ['sometimes', 'boolean'],
            'show_assignee' => ['sometimes', 'boolean'],
            'show_due_date' => ['sometimes', 'boolean'],
            'show_priority' => ['sometimes', 'boolean'],
            'show_labels' => ['sometimes', 'boolean'],
            'show_comments' => ['sometimes', 'boolean'],
        ]);

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
        $relations = $compactGantt ? [
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
            'predecessorDependencies.predecessor',
            'successorDependencies.successor',
        ];
        $board->load([
            'categories',
            'columns.cards' => fn ($query) => $query
                ->whereNull('archived_at')
                ->with($relations)
                ->orderBy('position'),
        ]);

        $columns = $board->columns->map(
            function (Column $column) use ($request, $project, $role, $compactGantt) {
                $cards = $column->cards
                    ->filter(
                        fn (Card $card) => $role !== 'cliente' || ! $card->is_internal
                    )
                    ->map(
                        fn (Card $card) => $compactGantt
                            ? CardPresenter::gantt($card, $request->user(), $project, $role)
                            : CardPresenter::make($card, $request->user(), $project, $role)
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

            'board' => [
                'id' => $board->id,
                'name' => $board->name,
                'project_id' => $project->id,
                'project_name' => $project->name,
                'client_name' => $project->clientCompany->name,
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
