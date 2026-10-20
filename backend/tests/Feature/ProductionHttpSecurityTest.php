<?php

namespace Tests\Feature;

use Tests\TestCase;

class ProductionHttpSecurityTest extends TestCase
{
    public function test_cors_approves_the_configured_frontend_origin(): void
    {
        config()->set('cors.allowed_origins', ['https://app.tickard.example']);
        config()->set('cors.supports_credentials', false);

        $response = $this->call('OPTIONS', '/api/login', server: [
            'HTTP_ORIGIN' => 'https://app.tickard.example',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'Content-Type, Authorization',
        ]);

        $response->assertHeader('Access-Control-Allow-Origin', 'https://app.tickard.example');
        $this->assertNull($response->headers->get('Access-Control-Allow-Credentials'));
    }

    public function test_cors_does_not_approve_untrusted_origins(): void
    {
        config()->set('cors.allowed_origins', ['https://app.tickard.example']);
        config()->set('cors.supports_credentials', false);

        $response = $this->call('OPTIONS', '/api/login', server: [
            'HTTP_ORIGIN' => 'https://untrusted.example',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'Content-Type, Authorization',
        ]);

        $allowedOrigin = $response->headers->get('Access-Control-Allow-Origin');
        $this->assertNotSame('https://untrusted.example', $allowedOrigin);
        $this->assertNull($response->headers->get('Access-Control-Allow-Credentials'));
    }
}
