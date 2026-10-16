<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'first_name', 'last_name', 'email', 'password', 'is_admin', 'plan', 'client_company_id', 'theme', 'avatar_path', 'notify_in_app', 'notify_email'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const PLAN_FREE = 'free';
    public const PLAN_BASE = 'base';
    public const PLAN_PRO = 'pro';
    public const PLAN_BUSINESS = 'business';

    /**
     * A permanent public handle is generated once at registration. It is
     * stored in users.public_handle and never follows display-name edits.
     */
    protected static function booted(): void
    {
        static::saving(function (self $user): void {
            if ($user->isDirty('first_name') || $user->isDirty('last_name')) {
                $user->first_name = trim((string) $user->first_name);
                $user->last_name = trim((string) $user->last_name) ?: null;
                $user->name = trim($user->first_name.' '.($user->last_name ?? ''));
            } elseif ($user->isDirty('name') || ! $user->first_name) {
                [$user->first_name, $user->last_name] = self::splitName($user->name);
            }
        });

        static::created(function (self $user): void {
            $prefix = self::initialHandlePrefix($user->first_name);
            $handle = $prefix.'#'.str_pad((string) $user->id, 5, '0', STR_PAD_LEFT);
            // Bypass events only for first-time assignment following INSERT:
            // subsequent application-level modifications are forbidden.
            $user->forceFill(['public_handle' => $handle])->saveQuietly();
        });

        static::updating(function (self $user): void {
            if ($user->isDirty('public_handle')) {
                throw ValidationException::withMessages([
                    'public_handle' => 'El ID de la cuenta es permanente.',
                ]);
            }
        });
    }

    public static function splitName(?string $name): array
    {
        $parts = preg_split('/\\s+/u', trim((string) $name), 2);
        return [$parts[0] ?: 'Usuario', $parts[1] ?? null];
    }

    public static function initialHandlePrefix(string $firstName): string
    {
        return substr(\Illuminate\Support\Str::slug($firstName, '-'), 0, 30) ?: 'usuario';
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'notify_in_app' => 'boolean',
            'notify_email' => 'boolean',
        ];
    }

    public function clientCompany(): BelongsTo
    {
        return $this->belongsTo(ClientCompany::class);
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(ProjectMember::class);
    }

    public function ownedWorkspaces(): HasMany
    {
        return $this->hasMany(Workspace::class, 'owner_id');
    }

    public function workspaceMemberships(): HasMany
    {
        return $this->hasMany(WorkspaceMember::class);
    }

    public function workspaces(): BelongsToMany
    {
        return $this->belongsToMany(Workspace::class, 'workspace_members')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function teams(): BelongsToMany
    {
        return $this->belongsToMany(Team::class);
    }

    public function departments(): BelongsToMany
    {
        return $this->belongsToMany(Department::class);
    }

    public function publicHandle(): string
    {
        return (string) $this->public_handle;
    }

    public function avatarUrl(): ?string
    {
        return $this->avatar_path ? '/storage/'.$this->avatar_path : null;
    }

    public function toApi(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'handle' => $this->publicHandle(),
            'email' => $this->email,
            'is_admin' => $this->is_admin,
            'plan' => $this->plan,
            'theme' => $this->theme,
            'avatar_url' => $this->avatarUrl(),
            'notify_in_app' => $this->notify_in_app,
            'notify_email' => $this->notify_email,
            'client_company' => $this->clientCompany?->name,
        ];
    }
}
