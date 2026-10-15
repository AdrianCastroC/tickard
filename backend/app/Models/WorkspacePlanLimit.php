<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkspacePlanLimit extends Model
{
    protected $fillable = ['workspace_id', 'max_projects', 'max_members', 'max_storage_mb'];

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }
}
