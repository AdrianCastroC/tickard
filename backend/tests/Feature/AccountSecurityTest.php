<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AccountSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_email_requires_valid_address_and_current_password(): void
    {
        $user = User::factory()->create(['email' => 'old@example.com']);
        User::factory()->create(['email' => 'taken@example.com']);

        $this->actingAs($user)->postJson('/api/me/email-change', [
            'email' => 'not-an-email', 'current_password' => 'password',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');

        $this->postJson('/api/me/email-change', [
            'email' => 'taken@example.com', 'current_password' => 'password',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');

        $this->postJson('/api/me/email-change', [
            'email' => 'new@example.com', 'current_password' => 'incorrect',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

        $this->assertSame('old@example.com', $user->fresh()->email);
        $this->assertDatabaseCount('user_email_changes', 0);
    }

    public function test_email_is_only_changed_after_verifying_code_and_id_stays_fixed(): void
    {
        $user = User::factory()->create(['first_name' => 'Ana', 'email' => 'old@example.com']);
        $handle = $user->publicHandle();
        $code = null;
        Mail::shouldReceive('raw')->twice()->withArgs(function (string $body) use (&$code) {
            if (preg_match('/\b([0-9]{6})\b/', $body, $matches)) {
                $code = $matches[1];
            }
            return true;
        });

        $this->actingAs($user)->postJson('/api/me/email-change', [
            'email' => 'new@example.com', 'current_password' => 'password',
        ])->assertOk()->assertJsonPath('pending_email', 'new@example.com');

        $this->assertSame('old@example.com', $user->fresh()->email);
        $this->assertNotNull($code);
        $this->assertDatabaseHas('user_email_changes', ['user_id' => $user->id, 'new_email' => 'new@example.com']);
        $this->getJson('/api/me/email-change')->assertOk()->assertJsonPath('pending_email', 'new@example.com');

        $this->postJson('/api/me/email-change/confirm', ['code' => $code])
            ->assertOk()->assertJsonPath('user.email', 'new@example.com')
            ->assertJsonPath('user.handle', $handle);

        $this->assertSame('new@example.com', $user->fresh()->email);
        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->assertSame($handle, $user->fresh()->publicHandle());
        $this->assertDatabaseCount('user_email_changes', 0);
    }

    public function test_wrong_codes_are_counted_and_cannot_change_email(): void
    {
        // Exercise the per-request five-attempt limit independently of the
        // shared IP middleware throttle (covered by the route itself).
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        Mail::shouldReceive('raw')->once();
        $user = User::factory()->create(['email' => 'old@example.com']);
        $this->actingAs($user)->postJson('/api/me/email-change', [
            'email' => 'new@example.com', 'current_password' => 'password',
        ])->assertOk();

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->postJson('/api/me/email-change/confirm', ['code' => '000000'])
                ->assertUnprocessable()->assertJsonValidationErrors('code');
        }
        $this->assertDatabaseHas('user_email_changes', ['user_id' => $user->id, 'attempts' => 5]);
        $this->assertSame('old@example.com', $user->fresh()->email);
        $this->getJson('/api/me/email-change')->assertJsonPath('pending_email', null);
    }

    public function test_new_password_requires_complexity_and_current_password(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->patchJson('/api/me', [
            'current_password' => 'password',
            'password' => 'simple12345',
            'password_confirmation' => 'simple12345',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->patchJson('/api/me', [
            'current_password' => 'wrong',
            'password' => 'Safe!Password123',
            'password_confirmation' => 'Safe!Password123',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

        $handle = $user->publicHandle();
        $this->patchJson('/api/me', [
            'current_password' => 'password',
            'password' => 'Safe!Password123',
            'password_confirmation' => 'Safe!Password123',
        ])->assertOk()->assertJsonPath('user.handle', $handle);

        $this->assertTrue(Hash::check('Safe!Password123', $user->fresh()->password));
        $this->assertSame($handle, $user->fresh()->publicHandle());
    }
}
