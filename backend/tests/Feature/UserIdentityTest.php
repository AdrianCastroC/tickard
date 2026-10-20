<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class UserIdentityTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_creates_permanent_full_id_from_original_first_name(): void
    {
        $base = [
            'first_name' => 'Adrián',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ];
        $codes = [];
        \Illuminate\Support\Facades\Mail::shouldReceive('raw')->twice()
            ->andReturnUsing(function (string $body) use (&$codes) {
                preg_match('/\\b[0-9]{6}\\b/', $body, $matches);
                $codes[] = $matches[0] ?? null;
            });
        $first = $this->postJson('/api/register', [
            ...$base, 'last_name' => 'Castro', 'email' => 'adrian-a@example.com',
        ])->assertStatus(202);
        $second = $this->postJson('/api/register', [
            ...$base, 'last_name' => 'Pérez', 'email' => 'adrian-b@example.com',
        ])->assertStatus(202);
        $this->postJson('/api/registration/verify', [
            'email' => 'adrian-a@example.com', 'nonce' => $first->json('nonce'), 'code' => $codes[0],
        ])->assertCreated();
        $this->postJson('/api/registration/verify', [
            'email' => 'adrian-b@example.com', 'nonce' => $second->json('nonce'), 'code' => $codes[1],
        ])->assertCreated();

        $one = User::where('email', 'adrian-a@example.com')->firstOrFail();
        $two = User::where('email', 'adrian-b@example.com')->firstOrFail();

        $this->assertSame('adrian#'.str_pad((string) $one->id, 5, '0', STR_PAD_LEFT), $one->publicHandle());
        $this->assertSame('adrian#'.str_pad((string) $two->id, 5, '0', STR_PAD_LEFT), $two->publicHandle());
        $this->assertNotSame($one->publicHandle(), $two->publicHandle());
        $this->assertSame($one->publicHandle(), $one->fresh()->public_handle);
        $this->assertFalse(Schema::hasColumn('users', 'nickname'));
        $this->assertTrue(Schema::hasColumn('users', 'public_handle'));
    }

    public function test_name_edits_do_not_change_stored_id_or_account_email(): void
    {
        $user = User::factory()->create(['first_name' => 'Ana', 'last_name' => 'Ruiz']);
        $handle = $user->publicHandle();
        $email = $user->email;

        $this->actingAs($user)->patchJson('/api/me', [
            'first_name' => 'María', 'last_name' => 'López',
        ])->assertOk()
            ->assertJsonPath('user.name', 'María López')
            ->assertJsonPath('user.handle', $handle)
            ->assertJsonPath('user.email', $email)
            ->assertJsonMissingPath('user.nickname');

        $this->assertSame($handle, $user->fresh()->publicHandle());
        $this->assertSame('María López', $user->fresh()->name);

        $this->patchJson('/api/me', [
            'theme' => 'dark', 'notify_in_app' => true,
        ])->assertOk()->assertJsonPath('user.handle', $handle);
    }

    public function test_fixed_identity_fields_are_rejected_by_profile_api(): void
    {
        $user = User::factory()->create(['first_name' => 'Ana']);
        $oldEmail = $user->email;
        $oldHandle = $user->publicHandle();

        foreach ([
            'nickname' => 'otro',
            'public_handle' => 'otro#99999',
            'email' => 'nuevo@example.com',
            'name' => 'Identidad nueva',
            'id' => 999,
            'handle' => 'otro#99999',
        ] as $field => $value) {
            $this->actingAs($user)->patchJson('/api/me', [$field => $value])
                ->assertUnprocessable()->assertJsonValidationErrors($field);
        }

        $fresh = $user->fresh();
        $this->assertSame($oldEmail, $fresh->email);
        $this->assertSame($oldHandle, $fresh->publicHandle());
    }

    public function test_user_model_cannot_modify_persisted_public_handle(): void
    {
        $user = User::factory()->create(['first_name' => 'Ana']);
        $oldHandle = $user->publicHandle();
        try {
            $user->forceFill(['public_handle' => 'maria#00001'])->save();
            $this->fail('No debe poder cambiarse el ID permanente.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('public_handle', $e->errors());
        }
        $this->assertSame($oldHandle, $user->fresh()->publicHandle());
    }

    public function test_legacy_nickname_is_not_stored_as_a_separate_user_column(): void
    {
        $this->assertFalse(Schema::hasColumn('users', 'nickname'));
        $first = User::factory()->create(['first_name' => 'Ana']);
        $second = User::factory()->create(['first_name' => 'Ana']);
        $this->assertNotSame($first->publicHandle(), $second->publicHandle());
        $this->assertSame($second->publicHandle(), $second->fresh()->public_handle);
    }
}
