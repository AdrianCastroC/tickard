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
                'is_backlog' => true,
            ],
            [
                'name' => 'Por hacer',
                'is_backlog' => false,
            ],
            [
                'name' => 'En progreso',
                'is_backlog' => false,
            ],
            [
                'name' => 'En revisión',
                'is_backlog' => false,
            ],
            [
                'name' => 'Completado',
                'is_backlog' => false,
            ],
        ];
    }

    public function createDefaultColumns(): void
    {
        foreach (self::defaultColumns() as $position => $column) {
            $this->columns()->create([
                'name' => $column['name'],
                'position' => $position,
                'is_backlog' => $column['is_backlog'],
            ]);
        }
    }
}