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

class CardDetailsController extends ApiController
{
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
}
