<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_and_use_the_returned_token(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ]);

        $response->assertCreated()->assertJsonStructure(['token', 'user']);
        $user = User::where('email', 'ada@example.com')->firstOrFail();

        $this->assertSame('Ada Lovelace', $user->name);
        $this->assertFalse($user->is_admin);
        $this->assertNull($user->client_company_id);
        $this->assertTrue(Hash::check('secret123', $user->password));
        $workspace = $user->ownedWorkspaces()->firstOrFail();
        $this->assertSame('Mi espacio', $workspace->name);
        $this->assertSame($user->id, $workspace->owner_id);
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'role' => 'owner',
        ]);
        $this->assertTrue($user->workspaces->contains($workspace));
        $this->withHeader('Authorization', 'Bearer '.$response->json('token'))
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'ada@example.com');
    }

    public function test_duplicate_email_is_rejected(): void
    {
        User::factory()->create(['email' => 'ada@example.com']);

        $this->postJson('/api/register', [
            'name' => 'Another Ada',
            'email' => 'ada@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_password_confirmation_is_required_to_match(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'different123',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_short_password_is_rejected(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.com',
            'password' => 'short',
            'password_confirmation' => 'short',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
    }
}
