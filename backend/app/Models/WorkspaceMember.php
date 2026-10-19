<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkspaceMember extends Model
{
    protected $fillable = ['workspace_id', 'user_id', 'role', 'client_company_id', 'job_title', 'custom_role_id'];

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function customRole(): BelongsTo
    {
        return $this->belongsTo(WorkspaceCustomRole::class, 'custom_role_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
