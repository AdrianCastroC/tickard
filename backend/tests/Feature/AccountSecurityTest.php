<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AccountSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_cannot_change_email_or_password_without_security_verification(): void
    {
        $user = User::factory()->create(['email' => 'old@example.com', 'first_name' => 'Ana']);
        $handle = $user->publicHandle();
        foreach ([
            ['email' => 'new@example.com'],
            ['password' => 'Very!Strong123', 'password_confirmation' => 'Very!Strong123', 'current_password' => 'password'],
        ] as $payload) {
            $this->actingAs($user)->patchJson('/api/me', $payload)
                ->assertUnprocessable();
        }
        $this->patchJson('/api/me', ['first_name' => 'María'])->assertOk()
            ->assertJsonPath('user.handle', $handle)
            ->assertJsonPath('user.email', 'old@example.com');
        $this->assertTrue(Hash::check('password', $user->fresh()->password));
        $this->postJson('/api/me/email-change', ['email' => 'new@example.com'])->assertNotFound();
        $this->postJson('/api/me/email-change/confirm', ['code' => '123456'])->assertNotFound();
    }

    public function test_email_change_needs_old_inbox_then_new_inbox_and_password(): void
    {
        $user = User::factory()->create(['email' => 'old@example.com', 'first_name' => 'Ana']);
        $id = $user->publicHandle();
        $oldCode = null;
        $newCode = null;
        Mail::shouldReceive('raw')->times(3)->withArgs(function (string $body) use (&$oldCode, &$newCode) {
            if (preg_match('/\b([0-9]{6})\b/', $body, $matched)) {
                if (str_contains($body, 'para cambiar el correo')) $oldCode = $matched[1];
                if (str_contains($body, 'confirmar esta dirección')) $newCode = $matched[1];
            }
            return true;
        });

        $this->actingAs($user)->postJson('/api/me/security/email/request-new', [
            'email' => 'new@example.com', 'current_password' => 'password',
        ])->assertUnprocessable();
        $this->postJson('/api/me/security/email/confirm', ['code' => '123456'])->assertUnprocessable();
        $this->postJson('/api/me/security/email/start')->assertOk()->assertJsonPath('stage', 'current_code');
        $this->assertNotNull($oldCode);
        $this->getJson('/api/me/security/email')->assertJsonPath('stage', 'current_code');

        $this->postJson('/api/me/security/email/verify', ['code' => $oldCode])->assertOk()
            ->assertJsonPath('stage', 'ready');
        $this->postJson('/api/me/security/email/request-new', [
            'email' => 'new@example.com', 'current_password' => 'wrong',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');
        $this->postJson('/api/me/security/email/request-new', [
            'email' => 'new@example.com', 'current_password' => 'password',
        ])->assertOk()->assertJsonPath('stage', 'new_code');
        $this->assertSame('old@example.com', $user->fresh()->email);
        $this->assertNotNull($newCode);

        $this->postJson('/api/me/security/email/confirm', ['code' => $newCode])
            ->assertOk()->assertJsonPath('user.email', 'new@example.com')
            ->assertJsonPath('user.handle', $id);
        $this->assertSame('new@example.com', $user->fresh()->email);
        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->assertDatabaseCount('account_security_challenges', 0);
        $this->postJson('/api/me/security/email/confirm', ['code' => $newCode])->assertUnprocessable();
    }

    public function test_codes_expire_and_wrong_attempts_lock_the_operation(): void
    {
        $this->withoutMiddleware(ThrottleRequests::class);
        Mail::shouldReceive('raw')->once();
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/api/me/security/password/start')->assertOk();
        for ($n = 0; $n < 5; $n++) {
            $this->postJson('/api/me/security/password/verify', ['code' => '000000'])
                ->assertUnprocessable()->assertJsonValidationErrors('code');
        }
        $this->assertDatabaseHas('account_security_challenges', [
            'user_id' => $user->id, 'purpose' => 'password', 'attempts' => 5,
        ]);
        $this->postJson('/api/me/security/password/verify', ['code' => '000000'])->assertUnprocessable();
        $this->postJson('/api/me/security/password/finish', [
            'current_password' => 'password',
            'password' => 'Very!Strong123', 'password_confirmation' => 'Very!Strong123',
        ])->assertUnprocessable();
        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_challenge_expiry_prevents_password_update(): void
    {
        Mail::shouldReceive('raw')->once();
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/api/me/security/password/start')->assertOk();
        $this->travel(11)->minutes();
        $this->getJson('/api/me/security/password')->assertOk()->assertJsonPath('stage', null);
        $this->postJson('/api/me/security/password/verify', ['code' => '000000'])
            ->assertUnprocessable();
    }

    public function test_password_change_requires_old_email_code_and_current_password(): void
    {
        $user = User::factory()->create(['email' => 'old@example.com']);
        $original = $user->publicHandle();
        $code = null;
        Mail::shouldReceive('raw')->twice()->withArgs(function (string $body) use (&$code) {
            if (preg_match('/\b([0-9]{6})\b/', $body, $matches)) $code = $matches[1];
            return true;
        });
        $this->actingAs($user)->postJson('/api/me/security/password/finish', [
            'current_password' => 'password', 'password' => 'Very!Strong123',
            'password_confirmation' => 'Very!Strong123',
        ])->assertUnprocessable();
        $this->postJson('/api/me/security/password/start')->assertOk();
        $this->assertNotNull($code);
        $this->postJson('/api/me/security/password/verify', ['code' => $code])->assertOk();
        $this->postJson('/api/me/security/password/finish', [
            'current_password' => 'password', 'password' => 'simple12345',
            'password_confirmation' => 'simple12345',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->postJson('/api/me/security/password/finish', [
            'current_password' => 'bad', 'password' => 'Very!Strong123',
            'password_confirmation' => 'Very!Strong123',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');
        $this->postJson('/api/me/security/password/finish', [
            'current_password' => 'password', 'password' => 'Very!Strong123',
            'password_confirmation' => 'Very!Strong123',
        ])->assertOk()->assertJsonPath('user.handle', $original);
        $this->assertTrue(Hash::check('Very!Strong123', $user->fresh()->password));
        $this->assertDatabaseCount('account_security_challenges', 0);
    }

    public function test_verification_is_bound_to_authenticated_token_not_other_session(): void
    {
        Mail::shouldReceive('raw')->once();
        $user = User::factory()->create();
        $tokenOne = $user->createToken('one')->plainTextToken;
        $tokenTwo = $user->createToken('two')->plainTextToken;
        $this->withToken($tokenOne)->postJson('/api/me/security/password/start')->assertOk();
        $this->withToken($tokenTwo)->getJson('/api/me/security/password')
            ->assertOk()->assertJsonPath('stage', null);
        $this->withToken($tokenTwo)->postJson('/api/me/security/password/verify', ['code' => '123456'])
            ->assertUnprocessable();
    }
}
