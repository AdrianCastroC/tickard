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
            'first_name' => 'Ada',
            'last_name' => 'Lovelace',
            'email' => 'ada@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response->assertCreated()->assertJsonStructure(['token', 'user']);
        $user = User::where('email', 'ada@example.com')->firstOrFail();

        $this->assertSame('Ada Lovelace', $user->name);
        $this->assertSame('Ada', $user->first_name);
        $this->assertSame('Lovelace', $user->last_name);
        $this->assertSame('ada#'.str_pad((string) $user->id, 5, '0', STR_PAD_LEFT), $user->public_handle);
        $this->assertSame('ada#'.str_pad((string) $user->id, 5, '0', STR_PAD_LEFT), $user->publicHandle());
        $this->assertFalse($user->is_admin);
        $this->assertNull($user->client_company_id);
        $this->assertTrue(Hash::check('Password123!', $user->password));
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
            'first_name' => 'Another',
            'last_name' => 'Ada',
            'email' => 'ada@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_password_confirmation_is_required_to_match(): void
    {
        $this->postJson('/api/register', [
            'first_name' => 'Ada',
            'last_name' => 'Lovelace',
            'email' => 'ada@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'different123',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_short_password_is_rejected(): void
    {
        $this->postJson('/api/register', [
            'first_name' => 'Ada',
            'last_name' => 'Lovelace',
            'email' => 'ada@example.com',
            'password' => 'short',
            'password_confirmation' => 'short',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
    }
    public function test_surname_is_optional_and_first_name_is_required(): void
    {
        $payload = [
            'first_name' => 'María',
            'email' => 'maria@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ];
        $this->postJson('/api/register', $payload)->assertCreated();
        $user = User::where('email', 'maria@example.com')->firstOrFail();
        $this->assertSame('María', $user->name);
        $this->assertSame('María', $user->first_name);
        $this->assertNull($user->last_name);
        $this->assertStringStartsWith('maria#', $user->publicHandle());

        $this->postJson('/api/register', array_merge($payload, [
            'email' => 'missing@example.com',
            'first_name' => '',
        ]))->assertUnprocessable()->assertJsonValidationErrors('first_name');
    }

    public function test_handles_use_unique_primary_keys_padded_to_five_digits(): void
    {
        $one = User::factory()->create(['name' => 'Ana Ruiz']);
        $two = User::factory()->create(['name' => 'Ana Soto']);
        $this->assertSame('Ana', $one->first_name);
        $this->assertSame('Ruiz', $one->last_name);
        $this->assertSame('Ana Soto', $two->name);
        $this->assertSame('ana#'.str_pad((string) $one->id, 5, '0', STR_PAD_LEFT), $one->publicHandle());
        $this->assertSame('ana#'.str_pad((string) $two->id, 5, '0', STR_PAD_LEFT), $two->publicHandle());
        $this->assertNotSame($one->publicHandle(), $two->publicHandle());
        $this->assertDatabaseHas('users', ['id' => $two->id]);
        // The padding is a minimum width, never a truncation of larger IDs.
        $example = User::factory()->make(['first_name' => 'Ana', 'last_name' => null]);
        $example->id = 100000;
        $example->save();
        $this->assertSame('ana#100000', $example->publicHandle());
    }

}
