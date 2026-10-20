<?php

namespace Tests\Feature;

use Tests\TestCase;

class ProductionHttpSecurityTest extends TestCase
{
    public function test_cors_preflight_only_approves_configured_frontend_origin(): void
    {
        config()->set('cors.allowed_origins', ['https://app.tickard.example']);
        config()->set('cors.supports_credentials', false);

        $headers = [
            'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'Content-Type, Authorization',
        ];

        $approved = $this->call('OPTIONS', '/api/login', server: [
            'HTTP_ORIGIN' => 'https://app.tickard.example',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'Content-Type, Authorization',
        ]);
        $approved->assertHeader('Access-Control-Allow-Origin', 'https://app.tickard.example');

        $rejected = $this->call('OPTIONS', '/api/login', server: [
            'HTTP_ORIGIN' => 'https://untrusted.example',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'Content-Type, Authorization',
        ]);
        $this->assertNull($rejected->headers->get('Access-Control-Allow-Origin'));
        $this->assertNull($rejected->headers->get('Access-Control-Allow-Credentials'));
    }
}
