<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CardChecklistItem extends Model
{
    protected $fillable = ['card_id', 'card_module_id', 'body', 'is_done', 'due_date', 'completed_at', 'position'];

    protected function casts(): array
    {
        return [
            'is_done' => 'boolean',
            'due_date' => 'date',
            'completed_at' => 'datetime',
        ];
    }

    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(CardModule::class, 'card_module_id');
    }

    public function assignees(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }
}
