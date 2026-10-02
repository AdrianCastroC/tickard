<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Board extends Model
{
    protected $fillable = ['project_id', 'name', 'position', 'revision'];

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

    public function touchRevision(): void
    {
        $this->increment('revision');
    }

    public static function defaultColumnNames(): array
    {
        return ['Backlog', 'Por hacer', 'En progreso', 'En revisión', 'Completado'];
    }

    public function cards(): HasMany
    {
        return $this->hasMany(Card::class);
    }
}
