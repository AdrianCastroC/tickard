<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    protected $fillable = [
        'workspace_id',
        'storage_allocation_mb',
        'client_company_id',
        'client_access_enabled',
        'name',
        'image_path',
        'description',
        'show_description',
        'show_assignee',
        'show_due_date',
        'show_priority',
        'show_labels',
        'show_comments',
    ];

    protected function casts(): array
    {
        return [
            'storage_allocation_mb' => 'integer',
            'client_access_enabled' => 'boolean',
            'show_description' => 'boolean',
            'show_assignee' => 'boolean',
            'show_due_date' => 'boolean',
            'show_priority' => 'boolean',
            'show_labels' => 'boolean',
            'show_comments' => 'boolean',
        ];
    }

    public function clientCompany(): BelongsTo
    {
        return $this->belongsTo(ClientCompany::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(ProjectMember::class);
    }

    public function teams(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Team::class, 'project_team')->withTimestamps();
    }

    public function calendarEvents(): HasMany
    {
        return $this->hasMany(CalendarEvent::class);
    }

    public function boards(): HasMany
    {
        return $this->hasMany(Board::class)->orderBy('position');
    }

    public function labels(): HasMany
    {
        return $this->hasMany(Label::class);
    }
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }
}
