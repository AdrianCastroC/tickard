<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkspaceInvitation extends Model
{
    protected $fillable = [
        'workspace_id', 'project_id', 'project_role', 'custom_role_id', 'recipient_user_id',
        'invited_by', 'email', 'token_hash', 'max_uses', 'used_count',
        'expires_at', 'revoked_at', 'status', 'responded_at',
        'client_company_name', 'client_type', 'client_sector', 'client_description',
    ];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return ['responded_at' => 'datetime', 'expires_at' => 'datetime',
            'revoked_at' => 'datetime', 'used_count' => 'integer', 'max_uses' => 'integer'];
    }

    public function customRole(): BelongsTo { return $this->belongsTo(WorkspaceCustomRole::class, 'custom_role_id'); }
    public function workspace(): BelongsTo { return $this->belongsTo(Workspace::class); }
    public function project(): BelongsTo { return $this->belongsTo(Project::class); }
    public function recipient(): BelongsTo { return $this->belongsTo(User::class, 'recipient_user_id'); }
    public function inviter(): BelongsTo { return $this->belongsTo(User::class, 'invited_by'); }

    public function scopeVisible($query)
    {
        return $query->whereNotNull('recipient_user_id')
            ->whereNull('revoked_at')
            ->where(fn ($q) => $q->where('status', '!=', 'accepted')
                ->orWhere('responded_at', '>', now()->subDays(5)));
    }
}
