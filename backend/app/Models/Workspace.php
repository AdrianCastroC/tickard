<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Workspace extends Model
{
    protected $fillable = ['name', 'owner_id', 'plan'];

    public const PLAN_FREE = 'free';
    public const PLAN_BASE = 'base';
    public const PLAN_PRO = 'pro';
    public const PLAN_BUSINESS = 'business';

    public static function createInitialFor(User $user): self
    {
        $workspace = $user->ownedWorkspaces()->first();
        if ($workspace) {
            return $workspace;
        }

        $workspace = self::create([
            'name' => 'Mi espacio',
            'owner_id' => $user->id,
            'plan' => self::PLAN_FREE,
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
