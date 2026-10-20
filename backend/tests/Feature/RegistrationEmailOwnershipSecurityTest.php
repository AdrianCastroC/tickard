<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class RegistrationEmailOwnershipSecurityTest extends TestCase
{
    use RefreshDatabase;

    private function pending(string $email = 'prueba@example.com'): array
    {
        $code = null;
        Mail::shouldReceive('raw')->once()->andReturnUsing(function (string $body) use (&$code) {
            preg_match('/\\b[0-9]{6}\\b/', $body, $matches);
            $code = $matches[0] ?? null;
        });
        $response = $this->postJson('/api/register', [
            'first_name' => 'Nombre',
            'email' => $email,
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ])->assertStatus(202)->assertJsonPath('verification_required', true);

        return [$response->json('nonce'), $code];
    }

    public function test_registration_does_not_create_account_or_issue_token_until_correct_email_code(): void
    {
        [$nonce, $code] = $this->pending();
        $this->assertNotNull($code);
        $this->assertDatabaseMissing('users', ['email' => 'prueba@example.com']);
        $this->assertDatabaseCount('personal_access_tokens', 0);

        $this->postJson('/api/registration/verify', [
            'email' => 'prueba@example.com', 'nonce' => $nonce, 'code' => '999999',
        ])->assertUnprocessable();
        $this->postJson('/api/registration/verify', [
            'email' => 'prueba@example.com',
            'nonce' => str_repeat('f', 64), 'code' => $code,
        ])->assertUnprocessable();

        $verified = $this->postJson('/api/registration/verify', [
            'email' => 'prueba@example.com', 'nonce' => $nonce, 'code' => $code,
        ])->assertCreated()->assertJsonStructure(['token', 'user']);
        $user = User::where('email', 'prueba@example.com')->firstOrFail();
        $this->assertNotNull($user->email_verified_at);
        $this->assertSame(1, $user->ownedWorkspaces()->count());

        $this->withToken($verified->json('token'))->getJson('/api/me')->assertOk();
        $this->postJson('/api/registration/verify', [
            'email' => 'prueba@example.com', 'nonce' => $nonce, 'code' => $code,
        ])->assertUnprocessable();
    }

    public function test_unverified_old_account_and_token_are_blocked_then_reclaimed_by_mailbox_owner(): void
    {
        $user = User::factory()->create([
            'email' => 'reclamar@example.com', 'email_verified_at' => null,
        ]);
        $token = $user->createToken('api')->plainTextToken;
        $this->withToken($token)->getJson('/api/me')->assertForbidden();
        $this->postJson('/api/login', [
            'email' => 'reclamar@example.com', 'password' => 'Password123!',
        ])->assertUnprocessable();

        [$nonce, $code] = $this->pending('reclamar@example.com');
        $verified = $this->postJson('/api/registration/verify', [
            'email' => 'reclamar@example.com', 'nonce' => $nonce, 'code' => $code,
        ])->assertCreated();
        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->assertDatabaseCount('personal_access_tokens', 1);
        $this->withToken($verified->json('token'))->getJson('/api/me')->assertOk();

        // The account's former session must never survive mailbox reclamation.
        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_unverified_recipient_cannot_receive_or_accept_normal_project_invitation(): void
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $recipient = User::factory()->create([
            'email_verified_at' => null, 'is_admin' => false,
        ]);
        $workspace = Workspace::createInitialFor($owner);
        $project = Project::create(['workspace_id' => $workspace->id, 'name' => 'Confidencial']);

        $this->actingAs($owner)->postJson("/api/projects/{$project->id}/invitations", [
            'recipients' => [$recipient->email], 'role' => 'editor',
        ])->assertUnprocessable();
        $this->assertDatabaseMissing('workspace_invitations', [
            'workspace_id' => $workspace->id, 'recipient_user_id' => $recipient->id,
        ]);
    }

    public function test_email_challenge_is_time_limited_and_single_use(): void
    {
        [$nonce, $code] = $this->pending('caduca@example.com');
        \Illuminate\Support\Facades\DB::table('pending_registrations')
            ->where('email', 'caduca@example.com')->update(['expires_at' => now()->subMinute()]);

        $this->postJson('/api/registration/verify', [
            'email' => 'caduca@example.com', 'nonce' => $nonce, 'code' => $code,
        ])->assertUnprocessable();
        $this->assertDatabaseMissing('users', ['email' => 'caduca@example.com']);
    }
}
