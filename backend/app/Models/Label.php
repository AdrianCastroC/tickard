<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Label extends Model
{
    protected $fillable = ['project_id', 'name', 'tone'];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
