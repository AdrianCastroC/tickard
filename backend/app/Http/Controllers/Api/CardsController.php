<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\ApiController;
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

class CardsController extends ApiController
{
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
}
