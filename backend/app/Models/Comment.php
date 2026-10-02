<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Comment extends Model
{
    protected $fillable = ['card_id', 'parent_id', 'user_id', 'body', 'is_internal'];

    protected function casts(): array
    {
        return [
            'is_internal' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('id');
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(CommentReaction::class);
    }

    public function depth(): int
    {
        $depth = 0;
        $current = $this;
        while ($current->parent_id) {
            $depth++;
            $current->loadMissing('parent');
            if (! $current->parent) {
                break;
            }
            $current = $current->parent;
        }

        return $depth;
    }

    public function descendantIds(): array
    {
        $ids = [];
        $frontier = [$this->id];
        while ($frontier !== []) {
            $batch = self::query()->whereIn('parent_id', $frontier)->pluck('id')->all();
            $ids = array_merge($ids, $batch);
            $frontier = $batch;
        }

        return $ids;
    }

    public function root(): self
    {
        $current = $this;
        while ($current->parent_id) {
            $current->loadMissing('parent');
            if (! $current->parent) {
                break;
            }
            $current = $current->parent;
        }

        return $current;
    }
}
