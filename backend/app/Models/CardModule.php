<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CardModule extends Model
{
    public const TYPE_CHECKLIST = 'checklist';

    public const TYPE_FILES = 'files';

    public const TYPE_COMMENTS = 'comments';

    public const TYPES = [
        self::TYPE_CHECKLIST,
        self::TYPE_FILES,
        self::TYPE_COMMENTS,
    ];

    public const SINGLETON_TYPES = [
        self::TYPE_FILES,
        self::TYPE_COMMENTS,
    ];

    protected $fillable = [
        'card_id',
        'type',
        'title',
        'position',
    ];

    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
    }

    public function checklistItems(): HasMany
    {
        return $this->hasMany(CardChecklistItem::class)->orderBy('position');
    }
}
