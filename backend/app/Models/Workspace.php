<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Workspace extends Model
{
    protected $fillable = ['name', 'owner_id'];

    public static function createInitialFor(User $user): self
    {
        $workspace = $user->ownedWorkspaces()->first();
        if ($workspace) {
            return $workspace;
        }

        $workspace = self::create([
            'name' => 'Mi espacio',
            'owner_id' => $user->id,
        ]);
        $workspace->memberships()->create([
            'user_id' => $user->id,
            'role' => 'owner',
        ]);

        return $workspace;
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(WorkspaceMember::class);
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'workspace_members')
            ->withPivot('role')
            ->withTimestamps();
    }
}
