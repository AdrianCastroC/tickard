<?php

namespace App\Support;

use App\Models\Card;
use App\Models\Project;
use App\Models\Team;
use App\Models\User;

class CardPresenter
{
    public static function make(Card $card, User $user, Project $project, ?string $role): array
    {
        $client = $role === 'cliente';
        $modules = $card->relationLoaded('modules') ? $card->modules : collect();
        $items = $modules
            ->where('type', 'checklist')
            ->flatMap(fn ($module) => $module->relationLoaded('checklistItems') ? $module->checklistItems : collect());
        if ($items->isEmpty() && $card->relationLoaded('checklistItems')) {
            $items = $card->checklistItems;
        }
        $total = $items->count();
        $done = $items->where('is_done', true)->count();
        $payload = [
            'id' => $card->id,
            'column_id' => $card->column_id,
            'category_id' => $card->category_id,
            'title' => $card->title,
            'position' => $card->position,
            'color' => $card->color,
            'progress' => [
                'done' => $done,
                'total' => $total,
                'percent' => $total === 0 ? 0 : (int) round(($done / $total) * 100),
            ],
        ];

        $creator = $card->relationLoaded('creator')
            ? $card->creator
            : $card->creator()->first();
        if (! $creator && $card->relationLoaded('activities')) {
            $created = $card->activities->firstWhere('type', 'created');
            $creator = $created?->user;
        }
        abort_unless($creator, 500, 'La tarjeta no tiene autor.');
        $payload['creator'] = [
            'id' => $creator->id,
            'name' => $creator->name,
            'avatar_url' => $creator->avatarUrl(),
        ];

        if (! $client) {
            $payload['is_internal'] = $card->is_internal;
            $payload['priority'] = $card->priority;
            $payload['description'] = $card->description;
            $payload['start_date'] = $card->start_date?->toDateString();
            $payload['due_date'] = $card->due_date?->toDateString();
            $payload['started_at'] = $card->started_at?->toIso8601String();
            $payload['completed_at'] = $card->completed_at?->toIso8601String();
            $payload['assignees'] = $card->assignees->map(fn (User $assignee) => [
                'id' => $assignee->id,
                'name' => $assignee->name,
                'avatar_url' => $assignee->avatarUrl(),
            ])->values();
            $payload['teams'] = $card->teams->map(fn (Team $team) => [
                'id' => $team->id,
                'name' => $team->name,
                'member_ids' => $team->members->pluck('id')->values(),
            ])->values();
            $payload['labels'] = $card->labels->map(fn ($label) => [
                'id' => $label->id,
                'name' => $label->name,
                'tone' => $label->tone,
            ])->values();
            $payload['modules'] = $modules->map(fn ($module) => self::module($module))->values();
            $payload['checklist'] = $items->map(fn ($item) => self::checklistItem($item))->values();
            $payload['attachments'] = self::attachments($card);
            $payload['comments'] = $card->comments->map(fn ($comment) => self::comment($comment, $user))->values();
            $payload['activities'] = $card->activities->sortBy('id')->map(fn ($activity) => [
                'id' => $activity->id,
                'type' => $activity->type,
                'meta' => $activity->meta,
                'author' => $activity->user?->name,
            ])->values();

            return $payload;
        }

        if ($project->show_description) {
            $payload['description'] = $card->description;
        }
        if ($project->show_due_date) {
            $payload['start_date'] = $card->start_date?->toDateString();
            $payload['due_date'] = $card->due_date?->toDateString();
        }
        if ($project->show_priority) {
            $payload['priority'] = $card->priority;
        }
        if ($project->show_assignee) {
            $payload['assignees'] = $card->assignees->map(fn (User $assignee) => [
                'id' => $assignee->id,
                'name' => $assignee->name,
                'avatar_url' => $assignee->avatarUrl(),
            ])->values();
            $payload['teams'] = $card->teams->map(fn (Team $team) => [
                'id' => $team->id,
                'name' => $team->name,
            ])->values();
        }
        if ($project->show_labels) {
            $payload['labels'] = $card->labels->map(fn ($label) => [
                'id' => $label->id,
                'name' => $label->name,
                'tone' => $label->tone,
            ])->values();
        }

        $attachments = self::attachments($card);
        if ($attachments->isNotEmpty()) {
            $payload['attachments'] = $attachments;
        }

        $visibleModules = $modules->filter(function ($module) use ($project, $attachments) {
            if ($module->type === 'comments') {
                return (bool) $project->show_comments;
            }
            if ($module->type === 'files') {
                return $attachments->isNotEmpty();
            }

            return false;
        });
        $payload['modules'] = $visibleModules->map(fn ($module) => self::module($module))->values();

        if ($project->show_comments) {
            $payload['comments'] = $card->comments
                ->where('is_internal', false)
                ->map(fn ($comment) => self::comment($comment, $user))->values();
        }

        return $payload;
    }

    public static function module($module): array
    {
        $payload = [
            'id' => $module->id,
            'type' => $module->type,
            'title' => $module->title,
            'position' => (int) $module->position,
        ];

        if ($module->type === 'checklist') {
            $items = $module->relationLoaded('checklistItems') ? $module->checklistItems : collect();
            $total = $items->count();
            $done = $items->where('is_done', true)->count();
            $payload['checklist'] = $items->map(fn ($item) => self::checklistItem($item))->values();
            $payload['progress'] = [
                'done' => $done,
                'total' => $total,
                'percent' => $total === 0 ? 0 : (int) round(($done / $total) * 100),
            ];
        }

        return $payload;
    }

    public static function comment($comment, ?User $viewer = null): array
    {
        $reactions = $comment->relationLoaded('reactions') ? $comment->reactions : collect();
        $mine = $viewer
            ? $reactions->firstWhere('user_id', $viewer->id)?->type
            : null;

        return [
            'id' => $comment->id,
            'parent_id' => $comment->parent_id,
            'body' => $comment->body,
            'is_internal' => (bool) $comment->is_internal,
            'author_id' => $comment->user_id,
            'author' => $comment->user->name,
            'created_at' => $comment->created_at?->toIso8601String(),
            'reactions' => [
                'like' => $reactions->where('type', 'like')->count(),
                'love' => $reactions->where('type', 'love')->count(),
                'kiss' => $reactions->where('type', 'kiss')->count(),
                'encantado' => $reactions->where('type', 'encantado')->count(),
                'mine' => $mine,
            ],
        ];
    }

    public static function checklistItem($item): array
    {
        $assignees = $item->relationLoaded('assignees') ? $item->assignees : collect();

        return [
            'id' => $item->id,
            'module_id' => $item->card_module_id,
            'body' => $item->body,
            'is_done' => (bool) $item->is_done,
            'due_date' => $item->due_date?->toDateString(),
            'position' => (int) $item->position,
            'assignees' => $assignees->map(fn (User $assignee) => [
                'id' => $assignee->id,
                'name' => $assignee->name,
                'avatar_url' => $assignee->avatarUrl(),
            ])->values(),
        ];
    }

    public static function attachment($attachment): array
    {
        return [
            'id' => $attachment->id,
            'name' => $attachment->original_name,
            'url' => $attachment->url(),
            'mime_type' => $attachment->mime_type,
            'size' => (int) $attachment->size,
            'is_image' => $attachment->isImage(),
        ];
    }

    public static function attachments(Card $card)
    {
        $items = $card->relationLoaded('attachments') ? $card->attachments : collect();

        return $items->map(fn ($attachment) => self::attachment($attachment))->values();
    }
}
