<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class WorkspaceInvitationsTest extends TestCase
{
    use RefreshDatabase;

    private function workspace(): array
    {
        $owner = User::factory()->create(['plan' => 'free']);
        $workspace = Workspace::createInitialFor($owner);

        return [$owner, $workspace];
    }

    private function tokenFromUrl(string $url): string
    {
        return basename(parse_url($url, PHP_URL_PATH));
    }

    public function test_owner_can_invite_by_email_and_recipient_accepts_without_receiving_project_access(): void
    {
        Mail::fake();
        [$owner, $workspace] = $this->workspace();
        $recipient = User::factory()->create(['email' => 'invitado@example.com']);
        $project = Project::create(['workspace_id' => $workspace->id, 'client_company_id' => \App\Models\ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Cliente'])->id, 'name' => 'Interno']);

        $response = $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/invitations", [
            'mode' => 'email', 'email' => 'INVITADO@example.com', 'expires_days' => 7, 'max_uses' => 1,
        ])->assertCreated()->assertJsonPath('type', 'email');
        $token = $this->tokenFromUrl($response->json('url'));
        $this->assertDatabaseHas('workspace_invitations', [
            'workspace_id' => $workspace->id, 'email' => 'invitado@example.com', 'used_count' => 0,
        ]);
        $this->assertDatabaseMissing('workspace_invitations', ['token_hash' => $token]);

        $this->getJson("/api/workspace-invitations/{$token}")
            ->assertOk()->assertJsonPath('workspace', 'Mi espacio')
            ->assertJsonPath('email', 'invitado@example.com');

        $this->actingAs($recipient)->postJson("/api/workspace-invitations/{$token}/accept")
            ->assertOk()->assertJsonPath('workspace_id', $workspace->id);

        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $recipient->id, 'role' => 'member',
        ]);
        $this->assertDatabaseMissing('project_members', [
            'project_id' => $project->id, 'user_id' => $recipient->id,
        ]);

        $this->postJson("/api/workspace-invitations/{$token}/accept")->assertStatus(410);
    }

    public function test_shared_link_is_limited_and_cannot_overfill_workspace(): void
    {
        [$owner, $workspace] = $this->workspace();
        $response = $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/invitations", [
            'mode' => 'link', 'expires_days' => 2, 'max_uses' => 6,
        ])->assertCreated();
        $token = $this->tokenFromUrl($response->json('url'));

        $first = User::factory()->create();
        $second = User::factory()->create();
        $third = User::factory()->create();

        $this->actingAs($first)->postJson("/api/workspace-invitations/{$token}/accept")->assertOk();
        $this->actingAs($second)->postJson("/api/workspace-invitations/{$token}/accept")->assertOk();
        $this->actingAs($third)->postJson("/api/workspace-invitations/{$token}/accept")->assertStatus(422);
        $this->assertSame(3, $workspace->memberships()->count());
    }

    public function test_wrong_email_cannot_accept_and_only_owner_can_manage(): void
    {
        Mail::fake();
        [$owner, $workspace] = $this->workspace();
        $stranger = User::factory()->create(['email' => 'otro@example.com']);
        $this->actingAs($stranger)->getJson("/api/workspaces/{$workspace->id}/members-invitations")->assertForbidden();
        $this->postJson("/api/workspaces/{$workspace->id}/invitations", [
            'mode' => 'link', 'max_uses' => 1, 'expires_days' => 7,
        ])->assertForbidden();

        $response = $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/invitations", [
            'mode' => 'email', 'email' => 'solicitado@example.com', 'expires_days' => 7, 'max_uses' => 1,
        ])->assertCreated();
        $token = $this->tokenFromUrl($response->json('url'));

        $this->actingAs($stranger)->postJson("/api/workspace-invitations/{$token}/accept")->assertForbidden();
        $this->actingAs($stranger)->deleteJson("/api/workspaces/{$workspace->id}/invitations/{$response->json('id')}")
            ->assertForbidden();

        $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/members-invitations")
            ->assertOk()->assertJsonCount(1, 'members')->assertJsonCount(1, 'invitations');
        $this->deleteJson("/api/workspaces/{$workspace->id}/invitations/{$response->json('id')}")
            ->assertNoContent();
        $this->getJson("/api/workspace-invitations/{$token}")->assertStatus(410);
    }

    public function test_registration_with_invitation_does_not_reset_an_existing_account(): void
    {
        Mail::fake();
        [$owner, $workspace] = $this->workspace();
        $existing = User::factory()->create(['email' => 'existente@example.com']);
        $originalPassword = $existing->password;
        $response = $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/invitations", [
            'mode' => 'email', 'email' => $existing->email, 'expires_days' => 7, 'max_uses' => 1,
        ])->assertCreated();
        $token = $this->tokenFromUrl($response->json('url'));

        $this->actingAs($existing)->postJson("/api/workspace-invitations/{$token}/accept")->assertOk();
        $this->assertSame($originalPassword, $existing->fresh()->password);
    }
}
