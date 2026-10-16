<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class UserIdentityTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_assigns_a_permanent_nickname_from_first_name_only(): void
    {
        $base = [
            'first_name' => 'Adrián',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ];

        $this->postJson('/api/register', [
            ...$base, 'last_name' => 'Castro', 'email' => 'adrian-a@example.com',
        ])->assertCreated();

        $this->postJson('/api/register', [
            ...$base, 'last_name' => 'Pérez', 'email' => 'adrian-b@example.com',
        ])->assertCreated();

        $first = User::where('email', 'adrian-a@example.com')->firstOrFail();
        $second = User::where('email', 'adrian-b@example.com')->firstOrFail();

        $this->assertSame('adrian', $first->nickname);
        $this->assertSame('adrian', $second->nickname);
        $this->assertSame('adrian#'.str_pad((string) $first->id, 5, '0', STR_PAD_LEFT), $first->publicHandle());
        $this->assertNotSame($first->publicHandle(), $second->publicHandle());
    }

    public function test_updating_names_does_not_modify_the_nickname_or_public_handle(): void
    {
        $user = User::factory()->create([
            'first_name' => 'Ana', 'last_name' => 'Ruiz', 'nickname' => 'ana',
        ]);
        $originalHandle = $user->publicHandle();
        $originalEmail = $user->email;

        $this->actingAs($user)->patchJson('/api/me', [
            'first_name' => 'María', 'last_name' => 'López',
        ])->assertOk()
            ->assertJsonPath('user.name', 'María López')
            ->assertJsonPath('user.nickname', 'ana')
            ->assertJsonPath('user.handle', $originalHandle)
            ->assertJsonPath('user.email', $originalEmail);

        $this->assertSame('ana', $user->fresh()->nickname);
        $this->assertSame($originalHandle, $user->fresh()->publicHandle());
        $this->assertSame('María López', $user->fresh()->name);

        $this->patchJson('/api/me', [
            'theme' => 'dark', 'notify_in_app' => true,
        ])->assertOk()->assertJsonPath('user.handle', $originalHandle);
    }

    public function test_nickname_and_other_account_identity_fields_are_rejected_by_api(): void
    {
        $user = User::factory()->create(['nickname' => 'ana']);
        $oldEmail = $user->email;
        $oldHandle = $user->publicHandle();

        foreach ([
            'nickname' => 'otro',
            'email' => 'nuevo@example.com',
            'name' => 'Identidad nueva',
            'id' => 999,
            'handle' => 'otro#99999',
        ] as $field => $value) {
            $this->actingAs($user)->patchJson('/api/me', [$field => $value])
                ->assertUnprocessable()->assertJsonValidationErrors($field);
        }

        $fresh = $user->fresh();
        $this->assertSame('ana', $fresh->nickname);
        $this->assertSame($oldEmail, $fresh->email);
        $this->assertSame($oldHandle, $fresh->publicHandle());
    }

    public function test_model_rejects_changes_to_a_preexisting_nickname_even_outside_profile_api(): void
    {
        $user = User::factory()->create(['nickname' => 'ana']);

        $this->expectException(ValidationException::class);
        $user->update(['nickname' => 'maria']);
    }
}
