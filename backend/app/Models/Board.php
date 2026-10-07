<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Board extends Model
{
    protected $fillable = [
        'project_id',
        'name',
        'position',
        'revision',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function columns(): HasMany
    {
        return $this->hasMany(Column::class)->orderBy('position');
    }

    public function categories(): HasMany
    {
        return $this->hasMany(BoardCategory::class)->orderBy('position');
    }

    public function cards(): HasMany
    {
        return $this->hasMany(Card::class);
    }

    public function touchRevision(): void
    {
        $this->increment('revision');
    }

    public static function defaultColumns(): array
    {
        return [
            [
                'name' => 'Backlog',
                'workflow_state' => 'backlog',
            ],
            [
                'name' => 'Por hacer',
                'workflow_state' => 'pending',
            ],
            [
                'name' => 'En progreso',
                'workflow_state' => 'in_progress',
            ],
            [
                'name' => 'En revisión',
                'workflow_state' => 'review',
            ],
            [
                'name' => 'Completado',
                'workflow_state' => 'done',
            ],
        ];
    }

    public function createDefaultColumns(): void
    {
        foreach (self::defaultColumns() as $position => $column) {
            $this->columns()->create([
                'name' => $column['name'],
                'position' => $position,
                'workflow_state' => $column['workflow_state'],
            ]);
        }
    }
}
