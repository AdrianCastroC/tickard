<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectMember extends Model
{
    protected $fillable = ['project_id', 'user_id', 'role', 'custom_role_id'];

    public function customRole(): BelongsTo
    {
        return $this->belongsTo(WorkspaceCustomRole::class, 'custom_role_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
