<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClientCompany extends Model
{
    protected $fillable = ['workspace_id', 'name', 'client_type', 'sector', 'description', 'status', 'primary_contact_user_id'];

    public function primaryContact(): BelongsTo
    {
        return $this->belongsTo(User::class, 'primary_contact_user_id');
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}