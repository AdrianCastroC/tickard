<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\Board;
use App\Models\BoardCategory;
use App\Models\Card;
use App\Models\CardAttachment;
use App\Models\CardChecklistItem;
use App\Models\CardModule;
use App\Models\ClientCompany;
use App\Models\Column;
use App\Models\Comment;
use App\Models\Department;
use App\Models\Invitation;
use App\Models\Label;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Team;
use App\Models\User;
use App\Support\CardPresenter;
use App\Support\Notifier;
use App\Support\ProjectAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class GestorController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'El correo o la contraseña no coinciden.',
            ]);
        }

        return [
            'token' => $user->createToken('api')->plainTextToken,
            'user' => $this->profile($user),
        ];
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    public function me(Request $request)
    {
        return $this->profile($request->user());
    }

    public function updateMe(Request $request)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'theme' => ['sometimes', Rule::in(['light', 'dark', 'system'])],
            'notify_in_app' => ['sometimes', 'boolean'],
            'notify_email' => ['sometimes', 'boolean'],
            'current_password' => ['required_with:password', 'current_password'],
            'password' => ['sometimes', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $request->user();
        $payload = collect($data)->except(['current_password', 'password', 'password_confirmation'])->all();
        if (! empty($data['password'])) {
            $payload['password'] = $data['password'];
        }
        $user->update($payload);

        return $this->profile($user->fresh());
    }

    public function updateAvatar(Request $request)
    {
        $data = $request->validate([
            'avatar' => ['required', 'image', 'max:5120'],
        ]);

        $user = $request->user();
        if ($user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
        }

        $path = $data['avatar']->store('avatars/'.$user->id, 'public');
        $user->update(['avatar_path' => $path]);

        return $this->profile($user->fresh());
    }

    public function notifications(Request $request)
    {
        return AppNotification::where('user_id', $request->user()->id)->latest()->limit(20)->get()->map(fn ($item) => [
            'id' => $item->id,
            'body' => $item->body,
            'read_at' => $item->read_at,
        ]);
    }

    public function readNotifications(Request $request)
    {
        AppNotification::where('user_id', $request->user()->id)->whereNull('read_at')->update(['read_at' => now()]);

        return response()->noContent();
    }

    public function storeProject(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'client_name' => ['required', 'string', 'max:120'],
        ]);

        $project = DB::transaction(function () use ($data) {
            $client = ClientCompany::create(['name' => $data['client_name']]);
            $project = Project::create([
                'name' => $data['name'],
                'client_company_id' => $client->id,
            ]);
            $board = $project->boards()->create(['name' => 'General', 'position' => 0]);
            foreach (Board::defaultColumnNames() as $position => $name) {
                $board->columns()->create(['name' => $name, 'position' => $position]);
            }

            return $project->load('clientCompany', 'boards');
        });

        return response()->json($this->projectSummary($project, 'responsable'), 201);
    }

    public function storeBoard(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::canManage($request->user(), $project), 403);
        $data = $request->validate(['name' => ['required', 'string', 'max:120']]);
        $position = ((int) $project->boards()->max('position')) + 1;

        $board = DB::transaction(function () use ($project, $data, $position) {
            $board = $project->boards()->create([
                'name' => $data['name'],
                'position' => $position,
            ]);
            foreach (Board::defaultColumnNames() as $index => $name) {
                $board->columns()->create(['name' => $name, 'position' => $index]);
            }

            return $board;
        });

        return response()->json(['id' => $board->id, 'name' => $board->name], 201);
    }

    public function storeColumn(Request $request, Board $board)
    {
        abort_unless(ProjectAccess::canManage($request->user(), $board->project), 403);
        $data = $request->validate(['name' => ['required', 'string', 'max:80']]);
        $position = ((int) $board->columns()->max('position')) + 1;
        $column = $board->columns()->create([
            'name' => $data['name'],
            'position' => $position,
        ]);
        $board->touchRevision();

        return response()->json([
            'id' => $column->id,
            'name' => $column->name,
            'position' => $column->position,
        ], 201);
    }

    public function updateColumn(Request $request, Column $column)
    {
        abort_unless(ProjectAccess::canManage($request->user(), $column->board->project), 403);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'color' => ['sometimes', 'nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ]);
        abort_unless($data !== [], 422);
        $column->update($data);
        $column->board->touchRevision();

        return response()->json([
            'id' => $column->id,
            'name' => $column->name,
            'color' => $column->color,
            'position' => $column->position,
        ]);
    }

    public function moveColumn(Request $request, Column $column)
    {
        abort_unless(ProjectAccess::canManage($request->user(), $column->board->project), 403);
        $data = $request->validate(['position' => ['required', 'integer', 'min:0']]);
        $board = $column->board;

        DB::transaction(function () use ($board, $column, $data) {
            $columns = $board->columns()->where('id', '!=', $column->id)->orderBy('position')->get();
            $position = min($data['position'], $columns->count());
            $columns->splice($position, 0, [$column]);
            foreach ($columns as $index => $item) {
                $item->position = $index;
                $item->save();
            }
            $board->touchRevision();
        });

        return response()->noContent();
    }

    public function destroyColumn(Request $request, Column $column)
    {
        abort_unless(ProjectAccess::canManage($request->user(), $column->board->project), 403);

        if ($column->cards()->whereNull('archived_at')->exists()) {
            throw ValidationException::withMessages([
                'column' => 'Vacía la columna antes de borrarla.',
            ]);
        }

        $board = $column->board;
        $column->delete();
        $board->touchRevision();

        return response()->noContent();
    }

    public function storeCategory(Request $request, Board $board)
    {
        abort_unless(ProjectAccess::canManage($request->user(), $board->project), 403);
        $data = $request->validate(['name' => ['required', 'string', 'max:80']]);
        $position = ((int) $board->categories()->max('position')) + 1;
        $category = $board->categories()->create([
            'name' => $data['name'],
            'position' => $position,
        ]);
        $board->touchRevision();

        return response()->json([
            'id' => $category->id,
            'name' => $category->name,
            'position' => $category->position,
        ], 201);
    }

    public function updateCategory(Request $request, BoardCategory $category)
    {
        abort_unless(ProjectAccess::canManage($request->user(), $category->board->project), 403);
        $data = $request->validate(['name' => ['required', 'string', 'max:80']]);
        $category->update(['name' => $data['name']]);
        $category->board->touchRevision();

        return response()->json([
            'id' => $category->id,
            'name' => $category->name,
            'position' => $category->position,
        ]);
    }

    public function destroyCategory(Request $request, BoardCategory $category)
    {
        abort_unless(ProjectAccess::canManage($request->user(), $category->board->project), 403);
        $board = $category->board;
        $category->delete();
        $board->touchRevision();

        return response()->noContent();
    }

    public function updateProject(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::canManage($request->user(), $project), 403);

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

    public function showBoard(Request $request, Board $board)
    {
        $project = $board->project()->with('clientCompany', 'labels', 'members.user')->first();
        $role = ProjectAccess::role($request->user(), $project);
        abort_unless($role, 403);

        $board->load([
            'categories',
            'columns.cards' => fn ($query) => $query->whereNull('archived_at')->with(['creator', 'assignees', 'teams.members', 'labels', 'comments.user', 'comments.reactions', 'activities.user', 'checklistItems.assignees', 'modules.checklistItems.assignees', 'attachments'])->orderBy('position'),
        ]);

        $columns = $board->columns->map(function (Column $column) use ($request, $project, $role) {
            $cards = $column->cards
                ->filter(fn (Card $card) => $role !== 'cliente' || ! $card->is_internal)
                ->map(fn (Card $card) => CardPresenter::make($card, $request->user(), $project, $role))
                ->values();

            return [
                'id' => $column->id,
                'name' => $column->name,
                'color' => $column->color,
                'position' => $column->position,
                'cards' => $cards,
            ];
        });

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
            'members' => $project->members->map(fn (ProjectMember $member) => [
                'id' => $member->user->id,
                'name' => $member->user->name,
                'role' => $member->role,
            ])->values(),
            'labels' => $project->labels->map(fn (Label $label) => [
                'id' => $label->id,
                'name' => $label->name,
                'tone' => $label->tone,
            ])->values(),
            'categories' => $board->categories->map(fn (BoardCategory $category) => [
                'id' => $category->id,
                'name' => $category->name,
                'position' => $category->position,
            ])->values(),
            'teams' => $role === 'cliente' ? [] : Team::orderBy('name')->get(['id', 'name']),
            'columns' => $columns,
        ];
    }

    public function storeCard(Request $request, Board $board)
    {
        $project = $board->project;
        abort_unless(ProjectAccess::canEditCards($request->user(), $project), 403);

        $data = $request->validate([
            'column_id' => ['required', 'integer'],
            'category_id' => ['nullable', 'integer'],
            'title' => ['required', 'string', 'max:180'],
            'description' => ['nullable', 'string'],
            'due_date' => ['nullable', 'date'],
            'priority' => ['sometimes', Rule::in(['baja', 'media', 'alta', 'urgente'])],
            'color' => ['sometimes', 'nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'assignee_ids' => ['sometimes', 'array'],
            'assignee_ids.*' => ['integer'],
            'team_ids' => ['sometimes', 'array'],
            'team_ids.*' => ['integer'],
            'label_ids' => ['sometimes', 'array'],
            'label_ids.*' => ['integer'],
        ]);

        $column = Column::where('board_id', $board->id)->findOrFail($data['column_id']);
        $categoryId = null;
        if (! empty($data['category_id'])) {
            $categoryId = BoardCategory::where('board_id', $board->id)->whereKey($data['category_id'])->value('id');
            abort_unless($categoryId, 422);
        }
        $position = Card::where('column_id', $column->id)->whereNull('archived_at')->count();

        $card = Card::create([
            'board_id' => $board->id,
            'column_id' => $column->id,
            'category_id' => $categoryId,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'position' => $position,
            'is_internal' => true,
            'priority' => $data['priority'] ?? 'media',
            'color' => $data['color'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        $allowed = $project->members()->whereIn('role', ['responsable', 'editor', 'lector'])->pluck('user_id');
        $assignees = collect($data['assignee_ids'] ?? [])->intersect($allowed);
        $card->assignees()->sync($assignees);
        $labels = Label::where('project_id', $project->id)->whereIn('id', $data['label_ids'] ?? [])->pluck('id');
        $card->labels()->sync($labels);
        foreach (User::whereIn('id', $assignees)->get() as $assignee) {
            Notifier::send($assignee, 'Te han asignado «'.$card->title.'».');
        }
        $this->syncCardTeams($card, $project, $data['team_ids'] ?? [], $assignees, $request->user());

        $card->activities()->create([
            'user_id' => $request->user()->id,
            'type' => 'created',
            'meta' => ['title' => $card->title],
        ]);
        $board->touchRevision();

        return response()->json(['id' => $card->id], 201);
    }

    public function updateCard(Request $request, Card $card)
    {
        $project = $card->board->project;
        abort_unless(ProjectAccess::canEditCards($request->user(), $project), 403);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:180'],
            'description' => ['nullable', 'string'],
            'due_date' => ['nullable', 'date'],
            'priority' => ['sometimes', Rule::in(['baja', 'media', 'alta', 'urgente'])],
            'is_internal' => ['sometimes', 'boolean'],
            'category_id' => ['sometimes', 'nullable', 'integer'],
            'color' => ['sometimes', 'nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'assignee_ids' => ['sometimes', 'array'],
            'assignee_ids.*' => ['integer'],
            'team_ids' => ['sometimes', 'array'],
            'team_ids.*' => ['integer'],
            'label_ids' => ['sometimes', 'array'],
            'label_ids.*' => ['integer'],
        ]);

        $previous = $card->assignees()->pluck('users.id');
        $fields = collect($data)->except(['assignee_ids', 'team_ids', 'label_ids', 'category_id'])->all();
        if (array_key_exists('category_id', $data)) {
            if ($data['category_id'] === null) {
                $fields['category_id'] = null;
            } else {
                $categoryId = BoardCategory::where('board_id', $card->board_id)->whereKey($data['category_id'])->value('id');
                abort_unless($categoryId, 422);
                $fields['category_id'] = $categoryId;
            }
        }
        $card->update($fields);

        if (array_key_exists('is_internal', $data) && $data['is_internal'] === true) {
            $card->comments()->where('is_internal', false)->update(['is_internal' => true]);
        }

        $notified = collect();

        if (array_key_exists('assignee_ids', $data)) {
            $allowed = $project->members()->whereIn('role', ['responsable', 'editor', 'lector'])->pluck('user_id');
            $ids = collect($data['assignee_ids'])->intersect($allowed)->all();
            $card->assignees()->sync($ids);
            $notified = collect($ids)->diff($previous);
            foreach (User::whereIn('id', $notified)->get() as $assignee) {
                Notifier::send($assignee, 'Te han asignado «'.$card->title.'».');
            }
            $card->activities()->create([
                'user_id' => $request->user()->id,
                'type' => 'assigned',
                'meta' => ['ids' => $ids],
            ]);
        }

        if (array_key_exists('team_ids', $data)) {
            $this->syncCardTeams($card, $project, $data['team_ids'], $notified, $request->user());
        }

        if (array_key_exists('label_ids', $data)) {
            $ids = Label::where('project_id', $project->id)->whereIn('id', $data['label_ids'])->pluck('id');
            $card->labels()->sync($ids);
        }

        $card->board->touchRevision();

        return response()->noContent();
    }

    public function moveCard(Request $request, Card $card)
    {
        $project = $card->board->project;
        abort_unless(ProjectAccess::canEditCards($request->user(), $project), 403);

        $data = $request->validate([
            'column_id' => ['required', 'integer'],
            'position' => ['required', 'integer', 'min:0'],
        ]);

        $column = Column::where('board_id', $card->board_id)->findOrFail($data['column_id']);
        $from = $card->column_id;

        DB::transaction(function () use ($card, $column, $data, $request, $from) {
            $card->column_id = $column->id;
            $card->save();
            $this->resequence($column->id, $card, $data['position']);
            if ($from !== $column->id) {
                $this->resequence($from, null, 0);
                $card->activities()->create([
                    'user_id' => $request->user()->id,
                    'type' => 'moved',
                    'meta' => ['column' => $column->name],
                ]);
            }
            $card->board->touchRevision();
        });

        return response()->noContent();
    }

    public function archiveCard(Request $request, Card $card)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $card->board->project), 403);
        $card->update(['archived_at' => now()]);
        $card->board->touchRevision();

        return response()->noContent();
    }

    public function destroyCard(Request $request, Card $card)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $card->board->project), 403);
        $board = $card->board;
        $card->delete();
        $board->touchRevision();

        return response()->noContent();
    }

    public function storeModule(Request $request, Card $card)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $card->board->project), 403);
        $data = $request->validate([
            'type' => ['required', 'in:'.implode(',', CardModule::TYPES)],
            'title' => ['nullable', 'string', 'max:120'],
        ]);

        if (in_array($data['type'], CardModule::SINGLETON_TYPES, true)) {
            abort_if($card->modules()->where('type', $data['type'])->exists(), 422, 'Ese módulo ya está en la tarjeta.');
        }

        $title = $data['title'] ?? null;
        if ($data['type'] === CardModule::TYPE_CHECKLIST) {
            $title = $title ?: 'Checklist';
        } else {
            $title = null;
        }

        $position = ((int) $card->modules()->max('position')) + 1;
        $module = $card->modules()->create([
            'type' => $data['type'],
            'title' => $title,
            'position' => $position,
        ]);
        $module->load(['checklistItems.assignees']);
        $card->board->touchRevision();

        return response()->json(CardPresenter::module($module), 201);
    }

    public function updateModule(Request $request, CardModule $module)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $module->card->board->project), 403);
        abort_unless($module->type === CardModule::TYPE_CHECKLIST, 422, 'Solo se puede renombrar un checklist.');
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
        ]);
        $module->update(['title' => $data['title']]);
        $module->load(['checklistItems.assignees']);
        $module->card->board->touchRevision();

        return response()->json(CardPresenter::module($module));
    }

    public function destroyModule(Request $request, CardModule $module)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $module->card->board->project), 403);
        $board = $module->card->board;
        $module->delete();
        $board->touchRevision();

        return response()->noContent();
    }

    public function reorderModules(Request $request, Card $card)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $card->board->project), 403);
        $data = $request->validate([
            'ordered_ids' => ['required', 'array', 'min:1'],
            'ordered_ids.*' => ['integer'],
        ]);

        $owned = $card->modules()->pluck('id')->all();
        $ordered = collect($data['ordered_ids'])->unique()->values();
        abort_unless($ordered->count() === count($owned) && $ordered->diff($owned)->isEmpty(), 422);

        foreach ($ordered as $index => $id) {
            CardModule::whereKey($id)->where('card_id', $card->id)->update(['position' => $index + 1]);
        }

        $card->board->touchRevision();

        return response()->json(['ok' => true]);
    }

    public function storeChecklistItem(Request $request, Card $card)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $card->board->project), 403);
        $data = $request->validate([
            'body' => ['required', 'string', 'max:240'],
            'module_id' => ['required', 'integer'],
        ]);

        $module = $card->modules()->whereKey($data['module_id'])->where('type', CardModule::TYPE_CHECKLIST)->firstOrFail();
        $position = ((int) $module->checklistItems()->max('position')) + 1;
        $item = $module->checklistItems()->create([
            'card_id' => $card->id,
            'body' => $data['body'],
            'position' => $position,
        ]);
        $item->load('assignees');
        $card->board->touchRevision();

        return response()->json(CardPresenter::checklistItem($item), 201);
    }

    public function updateChecklistItem(Request $request, CardChecklistItem $item)
    {
        $project = $item->card->board->project;
        abort_unless(ProjectAccess::canEditCards($request->user(), $project), 403);
        $data = $request->validate([
            'body' => ['sometimes', 'string', 'max:240'],
            'is_done' => ['sometimes', 'boolean'],
            'due_date' => ['sometimes', 'nullable', 'date', 'after_or_equal:today'],
            'assignee_ids' => ['sometimes', 'array'],
            'assignee_ids.*' => ['integer'],
        ]);

        if (array_key_exists('due_date', $data) && $data['due_date'] !== null) {
            $cardDue = $item->card->due_date?->toDateString();
            if ($cardDue) {
                abort_if($data['due_date'] > $cardDue, 422, 'La fecha del checklist no puede ser posterior al vencimiento de la tarea.');
            }
        }

        $fields = collect($data)->except(['assignee_ids'])->all();
        if ($fields !== []) {
            $item->update($fields);
        }

        if (array_key_exists('assignee_ids', $data)) {
            $allowed = $project->members()->whereIn('role', ['responsable', 'editor', 'lector'])->pluck('user_id');
            $ids = collect($data['assignee_ids'])->intersect($allowed)->all();
            $item->assignees()->sync($ids);
        }

        $item->load('assignees');
        $item->card->board->touchRevision();

        return response()->json(CardPresenter::checklistItem($item));
    }

    public function reorderChecklist(Request $request, Card $card)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $card->board->project), 403);
        $data = $request->validate([
            'module_id' => ['required', 'integer'],
            'ordered_ids' => ['required', 'array', 'min:1'],
            'ordered_ids.*' => ['integer'],
        ]);

        $module = $card->modules()->whereKey($data['module_id'])->where('type', CardModule::TYPE_CHECKLIST)->firstOrFail();
        $owned = $module->checklistItems()->pluck('id')->all();
        $ordered = collect($data['ordered_ids'])->unique()->values();
        abort_unless($ordered->count() === count($owned) && $ordered->diff($owned)->isEmpty(), 422);

        foreach ($ordered as $index => $id) {
            CardChecklistItem::whereKey($id)->where('card_module_id', $module->id)->update(['position' => $index + 1]);
        }

        $card->board->touchRevision();

        return response()->json(['ok' => true]);
    }

    public function destroyChecklistItem(Request $request, CardChecklistItem $item)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $item->card->board->project), 403);
        $board = $item->card->board;
        $item->delete();
        $board->touchRevision();

        return response()->noContent();
    }

    public function storeAttachment(Request $request, Card $card)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $card->board->project), 403);

        $data = $request->validate([
            'file' => ['required', 'file', 'max:20480'],
        ]);

        /** @var \Illuminate\Http\UploadedFile $file */
        $file = $data['file'];
        $safe = Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)) ?: 'archivo';
        $ext = $file->getClientOriginalExtension();
        $name = $safe.($ext ? '.'.$ext : '');
        $path = $file->storeAs(
            'card-attachments/'.$card->id,
            Str::uuid()->toString().'_'.$name,
            'public'
        );

        $attachment = $card->attachments()->create([
            'user_id' => $request->user()->id,
            'original_name' => $file->getClientOriginalName(),
            'disk_path' => $path,
            'mime_type' => $file->getClientMimeType(),
            'size' => $file->getSize() ?: 0,
        ]);

        $card->board->touchRevision();

        return response()->json(CardPresenter::attachment($attachment), 201);
    }

    public function destroyAttachment(Request $request, CardAttachment $attachment)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $attachment->card->board->project), 403);

        $board = $attachment->card->board;
        Storage::disk('public')->delete($attachment->disk_path);
        $attachment->delete();
        $board->touchRevision();

        return response()->noContent();
    }

    public function storeComment(Request $request, Card $card)
    {
        $project = $card->board->project()->with('members.user')->first();
        $role = ProjectAccess::role($request->user(), $project);
        abort_unless($role && ProjectAccess::canComment($request->user(), $project), 403);
        abort_if($role === 'cliente' && $card->is_internal, 404);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
            'parent_id' => ['nullable', 'integer', 'exists:comments,id'],
        ]);

        $parent = null;
        if (! empty($data['parent_id'])) {
            $parent = Comment::where('card_id', $card->id)->whereKey($data['parent_id'])->firstOrFail();
            abort_if($parent->depth() >= 5, 422, 'Solo se permiten 5 niveles de respuesta.');
        }

        if ($parent) {
            $root = $parent->root();
            abort_if($role === 'cliente' && $root->is_internal, 403);
            $internal = (bool) $root->is_internal;
            $parentId = $parent->id;
        } else {
            // New threads: team = internal by default; client = always visible.
            $internal = $role !== 'cliente';
            $parentId = null;
        }

        $comment = $card->comments()->create([
            'parent_id' => $parentId,
            'user_id' => $request->user()->id,
            'body' => $data['body'],
            'is_internal' => $internal,
        ]);

        $card->activities()->create([
            'user_id' => $request->user()->id,
            'type' => 'commented',
            'meta' => ['internal' => $internal, 'parent_id' => $parentId],
        ]);
        $card->board->touchRevision();

        $card->loadMissing('assignees', 'teams.members');
        $recipients = $card->assignees->merge($card->teams->flatMap->members);
        if ($role === 'cliente') {
            $responsables = $project->members->where('role', 'responsable')->map->user;
            $recipients = $recipients->merge($responsables);
        }

        foreach ($recipients->unique('id') as $recipient) {
            if ($recipient->id !== $request->user()->id && (! $internal || $role !== 'cliente')) {
                Notifier::send($recipient, $request->user()->name.' comentó en «'.$card->title.'».');
            }
        }

        return response()->json(CardPresenter::comment($comment->load(['user', 'reactions']), $request->user()), 201);
    }

    public function destroyComment(Request $request, Comment $comment)
    {
        abort_unless($comment->user_id === $request->user()->id, 403);

        $project = $comment->card->board->project;
        $role = ProjectAccess::role($request->user(), $project);
        abort_unless($role && ProjectAccess::canComment($request->user(), $project), 403);

        abort_if($comment->replies()->exists(), 422, 'No se puede borrar un comentario con respuestas.');

        $board = $comment->card->board;
        $comment->delete();
        $board->touchRevision();

        return response()->noContent();
    }

    public function updateCommentVisibility(Request $request, Comment $comment)
    {
        abort_unless($comment->parent_id === null, 422, 'Solo se puede cambiar la visibilidad del hilo.');
        abort_unless($comment->user_id === $request->user()->id, 403);

        $project = $comment->card->board->project;
        $role = ProjectAccess::role($request->user(), $project);
        abort_unless($role && $role !== 'cliente', 403);

        $data = $request->validate([
            'is_internal' => ['required', 'boolean'],
        ]);

        $internal = (bool) $data['is_internal'];
        $comment->update(['is_internal' => $internal]);
        $descendantIds = $comment->descendantIds();
        if ($descendantIds !== []) {
            Comment::whereIn('id', $descendantIds)->update(['is_internal' => $internal]);
        }

        $comment->card->board->touchRevision();

        return response()->json(CardPresenter::comment($comment->load(['user', 'reactions']), $request->user()));
    }

    public function reactToComment(Request $request, Comment $comment)
    {
        $card = $comment->card;
        $project = $card->board->project;
        $role = ProjectAccess::role($request->user(), $project);
        abort_unless($role && ProjectAccess::canComment($request->user(), $project), 403);
        abort_if($role === 'cliente' && ($card->is_internal || $comment->is_internal), 404);

        $data = $request->validate([
            'type' => ['required', Rule::in(['like', 'love', 'kiss', 'encantado'])],
        ]);

        $existing = $comment->reactions()->where('user_id', $request->user()->id)->first();
        if ($existing && $existing->type === $data['type']) {
            $existing->delete();
        } elseif ($existing) {
            $existing->update(['type' => $data['type']]);
        } else {
            $comment->reactions()->create([
                'user_id' => $request->user()->id,
                'type' => $data['type'],
            ]);
        }

        $card->board->touchRevision();

        return response()->json(CardPresenter::comment($comment->fresh(['user', 'reactions']), $request->user()));
    }

    public function storeLabel(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $project), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:40'],
            'tone' => ['required', Rule::in(['bosque', 'bambu', 'niebla', 'tinta', 'ciruela', 'arena'])],
        ]);

        $label = $project->labels()->create($data);

        return response()->json($label, 201);
    }

    public function invite(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::canManage($request->user(), $project), 403);

        $data = $request->validate([
            'email' => ['required', 'email'],
            'name' => ['nullable', 'string', 'max:120'],
            'role' => ['required', Rule::in(['responsable', 'editor', 'lector', 'cliente'])],
        ]);

        $invitation = Invitation::create([
            'email' => $data['email'],
            'name' => $data['name'] ?? null,
            'token' => Str::random(40),
            'project_id' => $project->id,
            'role' => $data['role'],
            'invited_by' => $request->user()->id,
        ]);

        $link = rtrim((string) config('app.frontend_url'), '/').'/invitar/'.$invitation->token;
        \Illuminate\Support\Facades\Mail::raw(
            'Te han invitado a '.$project->name.'. Abre '.$link,
            function ($message) use ($data) {
                $message->to($data['email'])->subject('Invitación al gestor de tareas');
            },
        );

        return response()->json(['link' => $link], 201);
    }

    public function showInvitation(string $token)
    {
        $invitation = Invitation::with('project.clientCompany')->where('token', $token)->whereNull('accepted_at')->firstOrFail();

        return [
            'email' => $invitation->email,
            'name' => $invitation->name,
            'role' => $invitation->role,
            'project' => $invitation->project->name,
            'client' => $invitation->project->clientCompany->name,
        ];
    }

    public function acceptInvitation(Request $request, string $token)
    {
        $invitation = Invitation::with('project')->where('token', $token)->whereNull('accepted_at')->firstOrFail();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $user = DB::transaction(function () use ($invitation, $data) {
            $user = User::firstOrCreate(
                ['email' => $invitation->email],
                [
                    'name' => $data['name'],
                    'password' => $data['password'],
                    'client_company_id' => $invitation->role === 'cliente' ? $invitation->project->client_company_id : null,
                ],
            );

            if (! $user->wasRecentlyCreated) {
                $user->update(['name' => $data['name'], 'password' => $data['password']]);
            }

            ProjectMember::updateOrCreate(
                ['project_id' => $invitation->project_id, 'user_id' => $user->id],
                ['role' => $invitation->role],
            );

            $invitation->update(['accepted_at' => now()]);

            return $user;
        });

        return [
            'token' => $user->createToken('api')->plainTextToken,
            'user' => $this->profile($user),
        ];
    }

    public function teams(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);

        return [
            'teams' => Team::with('members:id,name')->orderBy('name')->get()->map(fn (Team $team) => [
                'id' => $team->id,
                'name' => $team->name,
                'members' => $team->members->map(fn (User $member) => [
                    'id' => $member->id,
                    'name' => $member->name,
                ])->values(),
            ])->values(),
            'people' => User::whereNull('client_company_id')->orderBy('name')->get(['id', 'name']),
        ];
    }

    public function storeTeam(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer'],
        ]);

        $team = Team::create(['name' => $data['name']]);
        $team->members()->sync($this->internalIds($data['member_ids'] ?? []));

        return response()->json(['id' => $team->id], 201);
    }

    public function updateTeam(Request $request, Team $team)
    {
        abort_unless($request->user()->is_admin, 403);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer'],
        ]);

        if (array_key_exists('name', $data)) {
            $team->update(['name' => $data['name']]);
        }
        if (array_key_exists('member_ids', $data)) {
            $team->members()->sync($this->internalIds($data['member_ids']));
        }
        Board::query()->increment('revision');

        return response()->noContent();
    }

    public function destroyTeam(Request $request, Team $team)
    {
        abort_unless($request->user()->is_admin, 403);
        $team->delete();
        Board::query()->increment('revision');

        return response()->noContent();
    }

    public function departments(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);

        return [
            'departments' => Department::with('members:id,name')->orderBy('name')->get()->map(fn (Department $department) => [
                'id' => $department->id,
                'name' => $department->name,
                'members' => $department->members->map(fn (User $member) => [
                    'id' => $member->id,
                    'name' => $member->name,
                ])->values(),
            ])->values(),
            'people' => User::whereNull('client_company_id')->orderBy('name')->get(['id', 'name']),
        ];
    }

    public function storeDepartment(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer'],
        ]);

        $department = Department::create(['name' => $data['name']]);
        $department->members()->sync($this->internalIds($data['member_ids'] ?? []));

        return response()->json(['id' => $department->id], 201);
    }

    public function updateDepartment(Request $request, Department $department)
    {
        abort_unless($request->user()->is_admin, 403);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer'],
        ]);

        if (array_key_exists('name', $data)) {
            $department->update(['name' => $data['name']]);
        }
        if (array_key_exists('member_ids', $data)) {
            $department->members()->sync($this->internalIds($data['member_ids']));
        }

        return response()->noContent();
    }

    public function destroyDepartment(Request $request, Department $department)
    {
        abort_unless($request->user()->is_admin, 403);
        $department->delete();

        return response()->noContent();
    }

    public function clients(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);

        return ClientCompany::withCount(['projects', 'users'])->orderBy('name')->get()->map(fn (ClientCompany $client) => [
            'id' => $client->id,
            'name' => $client->name,
            'projects_count' => $client->projects_count,
            'people_count' => $client->users_count,
        ])->values();
    }

    public function storeClient(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);
        $data = $request->validate(['name' => ['required', 'string', 'max:120']]);
        $client = ClientCompany::create(['name' => $data['name']]);

        return response()->json(['id' => $client->id], 201);
    }

    private function internalIds(array $ids): array
    {
        return User::whereNull('client_company_id')->whereIn('id', $ids)->pluck('id')->all();
    }

    private function syncCardTeams(Card $card, Project $project, array $teamIds, $alreadyNotified, User $actor): void
    {
        $ids = Team::whereIn('id', $teamIds)->pluck('id');
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
                Notifier::send($member, 'Han asignado «'.$card->title.'» a tu equipo.');
            }
        }

        $card->activities()->create([
            'user_id' => $actor->id,
            'type' => 'assigned',
            'meta' => ['teams' => $ids->values()],
        ]);
    }

    private function profile(User $user): array
    {
        $user->load('clientCompany', 'memberships.project.clientCompany', 'memberships.project.boards');

        $projects = Project::with(['clientCompany', 'boards'])->get()->filter(
            fn (Project $project) => ProjectAccess::canView($user, $project)
        )->map(fn (Project $project) => $this->projectSummary($project, ProjectAccess::role($user, $project)))->values();

        $unread = AppNotification::where('user_id', $user->id)->whereNull('read_at')->count();

        return [
            'user' => $user->toApi(),
            'unread' => $unread,
            'projects' => $projects,
        ];
    }

    private function projectSummary(Project $project, ?string $role): array
    {
        return [
            'id' => $project->id,
            'name' => $project->name,
            'client_name' => $project->clientCompany->name,
            'role' => $role,
            'boards' => $project->boards->map(fn (Board $board) => [
                'id' => $board->id,
                'name' => $board->name,
            ])->values(),
        ];
    }

    private function resequence(int $columnId, ?Card $moving, int $position): void
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
