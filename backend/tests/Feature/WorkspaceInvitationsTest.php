<?php

namespace Tests\Feature;

use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class WorkspaceInvitationsTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $owner = User::factory()->create(['is_admin' => false, 'plan' => 'free', 'nickname' => 'owner']);
        $workspace = Workspace::createInitialFor($owner);
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Empresa']);
        $project = Project::create([
            'workspace_id' => $workspace->id, 'client_company_id' => $client->id, 'name' => 'Proyecto',
        ]);
        return [$owner, $workspace, $project];
    }

    public function test_multiple_registered_users_can_be_invited_by_email_or_public_handle_without_email_delivery(): void
    {
        [$owner, $workspace, $project] = $this->fixture();
        $a = User::factory()->create(['email' => 'uno@example.com', 'nickname' => 'uno']);
        $b = User::factory()->create(['email' => 'dos@example.com', 'nickname' => 'dos']);

        $this->assertSame('dos#'.$b->public_id, $b->publicHandle());
        $response = $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/invitations", [
            'recipients' => ['UNO@example.com', $b->publicHandle(), 'desconocido@example.com', $a->publicHandle()],
        ])->assertCreated()->assertJsonCount(2, 'created')->assertJsonCount(1, 'errors');
        $this->assertSame('Usuario no encontrado', $response->json('errors.0.reason'));

        $first = WorkspaceInvitation::where('recipient_user_id', $a->id)->firstOrFail();
        $this->assertDatabaseHas('workspace_invitations', ['id' => $first->id, 'status' => 'pending']);
        $this->actingAs($a)->getJson('/api/my/invitations')
            ->assertOk()->assertJsonCount(1)->assertJsonPath('0.workspace_name', 'Mi espacio');

        $this->postJson("/api/my/invitations/{$first->id}/respond", ['action' => 'accept'])
            ->assertOk()->assertJsonPath('status', 'accepted');
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $a->id, 'role' => 'member',
        ]);
        $this->assertDatabaseMissing('project_members', ['project_id' => $project->id, 'user_id' => $a->id]);
        $this->postJson("/api/my/invitations/{$first->id}/respond", ['action' => 'accept'])->assertStatus(409);
    }

    public function test_project_invitation_assigns_selected_role_and_workspace_membership_in_one_acceptance(): void
    {
        [$owner, $workspace, $project] = $this->fixture();
        $recipient = User::factory()->create(['nickname' => 'carlos']);
        $sent = $this->actingAs($owner)->postJson("/api/projects/{$project->id}/invitations", [
            'role' => 'lector', 'recipients' => [$recipient->publicHandle()],
        ])->assertCreated()->assertJsonPath('created.0.project_role', 'lector');
        $id = $sent->json('created.0.id');

        $this->actingAs($recipient)->postJson("/api/my/invitations/{$id}/respond", ['action' => 'accept'])
            ->assertOk();
        $this->assertDatabaseHas('workspace_members', [
            'workspace_id' => $workspace->id, 'user_id' => $recipient->id, 'role' => 'member',
        ]);
        $this->assertDatabaseHas('project_members', [
            'project_id' => $project->id, 'user_id' => $recipient->id, 'role' => 'lector',
        ]);
    }

    public function test_project_responsible_can_invite_existing_members_but_cannot_onboard_external_people(): void
    {
        [$owner, $workspace, $project] = $this->fixture();
        $responsible = User::factory()->create();
        $member = User::factory()->create();
        $external = User::factory()->create();
        $workspace->memberships()->create(['user_id' => $responsible->id, 'role' => 'member']);
        $workspace->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $responsible->id, 'role' => 'responsable']);

        $result = $this->actingAs($responsible)->postJson("/api/projects/{$project->id}/invitations", [
            'role' => 'editor', 'recipients' => [$member->publicHandle(), $external->publicHandle()],
        ])->assertCreated()->assertJsonCount(1, 'created')->assertJsonCount(1, 'errors');
        $id = $result->json('created.0.id');
        $this->actingAs($member)->postJson("/api/my/invitations/{$id}/respond", ['action' => 'accept'])->assertOk();
        $this->assertDatabaseHas('project_members', [
            'project_id' => $project->id, 'user_id' => $member->id, 'role' => 'editor',
        ]);
        $this->assertDatabaseMissing('workspace_members', ['workspace_id' => $workspace->id, 'user_id' => $external->id]);
    }

    public function test_rejection_and_individual_or_bulk_deletion_do_not_create_memberships(): void
    {
        [$owner, $workspace] = $this->fixture();
        $a = User::factory()->create();
        $b = User::factory()->create();
        $sent = $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/invitations", [
            'recipients' => [$a->email, $b->email],
        ])->assertCreated();
        $ids = collect($sent->json('created'))->pluck('id')->all();
        $this->actingAs($a)->postJson("/api/my/invitations/{$ids[0]}/respond", ['action' => 'reject'])
            ->assertOk()->assertJsonPath('status', 'rejected');
        $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/invitations/delete", [
            'ids' => $ids,
        ])->assertOk()->assertJsonPath('deleted', 2);
        $this->assertDatabaseCount('workspace_invitations', 0);
        $this->assertDatabaseMissing('workspace_members', ['workspace_id' => $workspace->id, 'user_id' => $a->id]);
    }

    public function test_accepted_invites_are_hidden_and_pruned_after_five_days(): void
    {
        [$owner, $workspace] = $this->fixture();
        $recipient = User::factory()->create();
        $id = $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/invitations", [
            'recipients' => [$recipient->email],
        ])->assertCreated()->json('created.0.id');
        $this->actingAs($recipient)->postJson("/api/my/invitations/{$id}/respond", ['action' => 'accept'])->assertOk();
        $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/invitations/delete", [
            'ids' => [$id],
        ])->assertUnprocessable();
        $this->travel(6)->days();
        $this->getJson("/api/workspaces/{$workspace->id}/members-invitations")->assertOk()
            ->assertJsonCount(0, 'invitations');
        Artisan::call('invitations:prune');
        $this->assertDatabaseMissing('workspace_invitations', ['id' => $id]);
        $this->assertDatabaseHas('workspace_members', ['workspace_id' => $workspace->id, 'user_id' => $recipient->id]);
    }

    public function test_limits_and_permissions_are_enforced_on_acceptance(): void
    {
        [$owner, $workspace] = $this->fixture();
        $a = User::factory()->create();
        $b = User::factory()->create();
        $c = User::factory()->create();
        $outsider = User::factory()->create();
        $this->actingAs($outsider)->postJson("/api/workspaces/{$workspace->id}/invitations", [
            'recipients' => [$a->email],
        ])->assertForbidden();
        $response = $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/invitations", [
            'recipients' => [$a->email, $b->email, $c->email],
        ])->assertCreated()->assertJsonCount(3, 'created');

        $ids = collect($response->json('created'))->pluck('id')->all();
        $this->actingAs($outsider)->postJson("/api/my/invitations/{$ids[0]}/respond", ['action' => 'accept'])
            ->assertForbidden();
        $this->actingAs($a)->postJson("/api/my/invitations/{$ids[0]}/respond", ['action' => 'accept'])->assertOk();
        $this->actingAs($b)->postJson("/api/my/invitations/{$ids[1]}/respond", ['action' => 'accept'])->assertOk();
        $this->actingAs($c)->postJson("/api/my/invitations/{$ids[2]}/respond", ['action' => 'accept'])->assertUnprocessable();
        $this->assertSame(3, $workspace->memberships()->count());
    }

    public function test_public_handle_can_be_changed_without_changing_user_id(): void
    {
        $user = User::factory()->create(['name' => 'María', 'nickname' => 'maria']);
        $this->actingAs($user)->patchJson('/api/me', ['nickname' => 'maria-dev'])
            ->assertOk()->assertJsonPath('user.handle', 'maria-dev#'.$user->public_id);
        $this->assertSame($user->id, $user->fresh()->id);
        $this->assertSame($user->public_id, $user->fresh()->public_id);
        $this->assertSame('María', $user->fresh()->first_name);
    }
    public function test_invites_lookup_the_new_public_code_not_the_primary_key(): void
    {
        [$owner, $workspace] = $this->fixture();
        $recipient = User::factory()->create(['first_name' => 'Adrián', 'last_name' => 'Castro']);
        $this->assertMatchesRegularExpression('/^adrian#[1-9][0-9]{5}$/', $recipient->publicHandle());

        $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/invitations", [
            'recipients' => ['adrian#'.$recipient->id, $recipient->publicHandle()],
        ])->assertCreated()->assertJsonCount(1, 'created')->assertJsonCount(1, 'errors')
            ->assertJsonPath('errors.0.reason', 'Usuario no encontrado');

        $this->assertDatabaseHas('workspace_invitations', [
            'workspace_id' => $workspace->id, 'recipient_user_id' => $recipient->id,
        ]);
    }

}
