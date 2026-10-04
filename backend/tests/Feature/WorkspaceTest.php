<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceTest extends TestCase
{
    use RefreshDatabase;

    public function test_workspace_can_be_created_with_an_owner(): void
    {
        $owner = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Mi espacio', 'owner_id' => $owner->id]);

        $this->assertTrue($workspace->owner->is($owner));
    }

    public function test_owner_can_have_an_owner_membership(): void
    {
        $owner = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Equipo', 'owner_id' => $owner->id]);
        $membership = $workspace->memberships()->create(['user_id' => $owner->id, 'role' => 'owner']);

        $this->assertSame('owner', $membership->role);
        $this->assertTrue($workspace->members->contains($owner));
    }

    public function test_user_can_belong_to_multiple_workspaces(): void
    {
        $user = User::factory()->create();
        $first = Workspace::create(['name' => 'Primero', 'owner_id' => $user->id]);
        $second = Workspace::create(['name' => 'Segundo', 'owner_id' => $user->id]);
        $user->workspaces()->attach([$first->id => ['role' => 'owner'], $second->id => ['role' => 'owner']]);

        $this->assertCount(2, $user->workspaces);
    }

    public function test_multiple_users_can_belong_to_the_same_workspace(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Equipo', 'owner_id' => $owner->id]);
        $workspace->members()->attach([
            $owner->id => ['role' => 'owner'],
            $member->id => ['role' => 'member'],
        ]);

        $this->assertCount(2, $workspace->members);
        $this->assertTrue($member->workspaces->contains($workspace));
    }

    public function test_workspace_membership_combination_is_unique(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Equipo', 'owner_id' => $user->id]);
        $workspace->members()->attach($user->id, ['role' => 'owner']);

        $this->expectException(\Illuminate\Database\QueryException::class);
        $workspace->members()->attach($user->id, ['role' => 'owner']);
    }

    public function test_workspace_and_user_relationships_are_available(): void
    {
        $owner = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Equipo', 'owner_id' => $owner->id]);
        $workspace->members()->attach($owner->id, ['role' => 'owner']);

        $this->assertTrue($workspace->owner->is($owner));
        $this->assertTrue($workspace->members->first()->is($owner));
        $this->assertTrue($owner->workspaceMemberships->first()->workspace->is($workspace));
        $this->assertTrue($owner->workspaces->first()->is($workspace));
        $this->assertTrue($owner->ownedWorkspaces->first()->is($workspace));
    }
}
