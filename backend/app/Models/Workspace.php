<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Workspace extends Model
{
    protected $fillable = [
        'name',
        'owner_id',
        'extra_seats',
    ];

    protected function casts(): array
    {
        return [
            'extra_seats' => 'integer',
        ];
    }

    public static function createInitialFor(User $user): self
    {
        $workspace = $user->ownedWorkspaces()->first();

        if ($workspace) {
            return $workspace;
        }

        $workspace = self::create([
            'name' => 'Mi espacio',
            'owner_id' => $user->id,
            'extra_seats' => 0,
        ]);

        $workspace->memberships()->create([
            'user_id' => $user->id,
            'role' => 'owner',
        ]);

        return $workspace;
    }

    public function effectivePlan(): string
    {
        return $this->owner?->plan ?? User::PLAN_FREE;
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

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    public function teams(): HasMany
    {
        return $this->hasMany(Team::class);
    }

    public function departments(): HasMany
    {
        return $this->hasMany(Department::class);
    }

    public function clientCompanies(): HasMany
    {
        return $this->hasMany(ClientCompany::class);
    }

    public function planLimits(): HasOne
    {
        return $this->hasOne(WorkspacePlanLimit::class);
    }
}