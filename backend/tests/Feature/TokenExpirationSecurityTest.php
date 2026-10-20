<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TokenExpirationSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_token_expires_after_configured_lifetime(): void
    {
        config()->set('sanctum.expiration', 10080);
        $user = User::factory()->create(['is_admin' => false]);
        $token = $user->createToken('api')->plainTextToken;

        $this->withToken($token)->getJson('/api/me')->assertOk();

        $this->travel(7)->days();
        $this->travel(1)->minutes();
        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_logout_revokes_the_current_bearer_token(): void
    {
        $user = User::factory()->create(['is_admin' => false]);
        $token = $user->createToken('api')->plainTextToken;

        $this->withToken($token)->getJson('/api/me')->assertOk();
        $this->withToken($token)->postJson('/api/logout')->assertNoContent();
        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }
}
