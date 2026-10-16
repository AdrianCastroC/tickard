<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Department extends Model
{
    protected $fillable = ['workspace_id', 'name', 'lead_user_id', 'description', 'status', 'icon', 'image_path'];

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function teams(): BelongsToMany
    {
        return $this->belongsToMany(Team::class, 'department_team');
    }

    public function projects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'department_project');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }
}