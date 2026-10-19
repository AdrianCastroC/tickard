<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkspaceCustomRole extends Model
{
    protected $fillable = ['workspace_id', 'scope', 'name', 'description', 'permissions', 'enabled'];

    protected function casts(): array
    {
        return ['permissions' => 'array', 'enabled' => 'boolean'];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }
}
