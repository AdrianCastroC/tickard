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
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'first_name', 'last_name', 'nickname', 'email', 'password', 'is_admin', 'plan', 'client_company_id', 'theme', 'avatar_path', 'notify_in_app', 'notify_email'])]
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
     * Every user gets a stable six-digit public discriminator, separate from
     * the database primary key. A unique DB index enforces uniqueness.
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

            if (! $user->nickname) {
                $user->nickname = self::defaultNickname($user->first_name);
            }
        });

        static::creating(function (self $user): void {
            if ($user->public_id) return;

            for ($attempt = 0; $attempt < 50; $attempt++) {
                $candidate = (string) random_int(100000, 999999);
                if (! self::where('public_id', $candidate)->exists()) {
                    $user->public_id = $candidate;
                    return;
                }
            }
            throw new \RuntimeException('No se pudo asignar un identificador público único.');
        });
    }

    public static function splitName(?string $name): array
    {
        $parts = preg_split('/\\s+/u', trim((string) $name), 2);
        return [$parts[0] ?: 'Usuario', $parts[1] ?? null];
    }

    public static function defaultNickname(string $firstName): string
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
        $nick = \Illuminate\Support\Str::slug($this->nickname ?: $this->name, '-');

        return ($nick ?: 'usuario').'#'.$this->public_id;
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
            'public_id' => $this->public_id,
            'nickname' => $this->nickname,
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
