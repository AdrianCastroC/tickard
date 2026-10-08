<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CardDependency extends Model
{
    protected $fillable = ['predecessor_card_id', 'successor_card_id', 'type'];

    public function predecessor(): BelongsTo
    {
        return $this->belongsTo(Card::class, 'predecessor_card_id');
    }

    public function successor(): BelongsTo
    {
        return $this->belongsTo(Card::class, 'successor_card_id');
    }
}
