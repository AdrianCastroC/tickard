<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Card extends Model
{
    protected $fillable = [
        'board_id',
        'column_id',
        'category_id',
        'title',
        'description',
        'start_date',
        'due_date',
        'started_at',
        'priority',
        'color',
        'is_internal',
        'position',
        'archived_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'due_date' => 'date',
            'started_at' => 'datetime',
            'is_internal' => 'boolean',
            'archived_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function column(): BelongsTo
    {
        return $this->belongsTo(Column::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(BoardCategory::class, 'category_id');
    }

    public function board(): BelongsTo
    {
        return $this->belongsTo(Board::class);
    }

    public function assignees(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }

    public function teams(): BelongsToMany
    {
        return $this->belongsToMany(Team::class);
    }

    public function labels(): BelongsToMany
    {
        return $this->belongsToMany(Label::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class)->orderBy('id');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(Activity::class);
    }

    public function checklistItems(): HasMany
    {
        return $this->hasMany(CardChecklistItem::class)->orderBy('position');
    }

    public function modules(): HasMany
    {
        return $this->hasMany(CardModule::class)->orderBy('position');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(CardAttachment::class)->orderBy('id');
    }
}