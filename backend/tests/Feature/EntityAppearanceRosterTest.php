<?php

namespace Tests\Feature;

use App\Models\ClientCompany;
use App\Models\Department;
use App\Models\Project;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class EntityAppearanceRosterTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $member = User::factory()->create(['is_admin' => false]);
        $other = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::create(['owner_id' => $owner->id, 'name' => 'Agencia', 'show_clients' => true]);
        foreach ([$owner, $member] as $user) {
            $workspace->memberships()->create([
                'user_id' => $user->id, 'role' => $user->id === $owner->id ? 'owner' : 'member',
            ]);
        }
        return compact('owner', 'member', 'other', 'workspace');
    }

    public function test_department_and_team_cannot_exist_through_api_without_a_responsible_member(): void
    {
        extract($this->fixture());
        foreach (['departments', 'teams'] as $path) {
            $this->actingAs($owner)->postJson('/api/'.$path, [
                'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
                'member_ids' => [$owner->id],
            ])->assertUnprocessable()->assertJsonValidationErrors('lead_user_id');

            $this->postJson('/api/'.$path, [
                'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
                'member_ids' => [$owner->id], 'lead_user_id' => $member->id,
            ])->assertUnprocessable()->assertJsonValidationErrors('lead_user_id');

            $id = $this->postJson('/api/'.$path, [
                'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
                'member_ids' => [$owner->id, $member->id], 'lead_user_id' => $member->id,
            ])->assertCreated()->json('id');

            $this->patchJson('/api/'.$path.'/'.$id, [
                'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
                'member_ids' => [$owner->id], 'lead_user_id' => $member->id,
            ])->assertUnprocessable()->assertJsonValidationErrors('lead_user_id');

            $this->patchJson('/api/'.$path.'/'.$id, [
                'workspace_id' => $workspace->id, 'name' => 'Desarrollo',
                'member_ids' => [$owner->id], 'lead_user_id' => $owner->id,
            ])->assertNoContent();
            $this->assertDatabaseHas($path, ['id' => $id, 'lead_user_id' => $owner->id]);
        }
    }

    public function test_project_links_can_be_added_and_removed_without_deleting_projects(): void
    {
        extract($this->fixture());
        $projectA = Project::create(['workspace_id' => $workspace->id, 'name' => 'Aplicación']);
        $projectB = Project::create(['workspace_id' => $workspace->id, 'name' => 'Portal']);

        foreach (['departments' => Department::class, 'teams' => Team::class] as $path => $model) {
            $id = $this->actingAs($owner)->postJson('/api/'.$path, [
                'workspace_id' => $workspace->id,
                'name' => 'Desarrollo',
                'member_ids' => [$owner->id], 'lead_user_id' => $owner->id,
                'project_ids' => [$projectA->id, $projectB->id],
            ])->assertCreated()->json('id');
            $entity = $model::findOrFail($id);
            $this->assertCount(2, $entity->projects);
            $this->patchJson('/api/'.$path.'/'.$id, [
                'workspace_id' => $workspace->id,
                'name' => 'Desarrollo', 'lead_user_id' => $owner->id,
                'project_ids' => [],
            ])->assertNoContent();
            $this->assertCount(0, $entity->fresh()->projects);
        }
        $this->assertDatabaseHas('projects', ['id' => $projectA->id]);
        $this->assertDatabaseHas('projects', ['id' => $projectB->id]);
    }

    public function test_entity_image_upload_delete_and_icon_fallback_are_scoped(): void
    {
        Storage::fake('public');
        extract($this->fixture());
        $department = Department::create(['workspace_id' => $workspace->id,
            'name' => 'Diseño', 'lead_user_id' => $owner->id]);
        $team = Team::create(['workspace_id' => $workspace->id,
            'name' => 'UX', 'lead_user_id' => $owner->id]);
        $client = ClientCompany::create(['workspace_id' => $workspace->id,
            'name' => 'Cliente', 'icon' => 'building']);
        foreach ([
            'departments' => $department,
            'teams' => $team,
            'clients' => $client,
        ] as $kind => $entity) {
            // Minimal real PNG, independent of GD.
            $png = UploadedFile::fake()->createWithContent('logo.png', base64_decode(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0X19kAAAAASUVORK5CYII='
            ));
            $this->actingAs($member)->post('/api/'.$kind.'/'.$entity->id.'/image',
                ['workspace_id' => $workspace->id, 'image' => $png], ['Accept' => 'application/json'])
                ->assertForbidden();
            $this->actingAs($owner)->post('/api/'.$kind.'/'.$entity->id.'/image',
                ['workspace_id' => $workspace->id, 'image' => $png], ['Accept' => 'application/json'])
                ->assertOk()->assertJsonStructure(['image_url']);
            $path = $entity->fresh()->image_path;
            $this->assertNotNull($path);
            Storage::disk('public')->assertExists($path);
            $this->actingAs($owner)->deleteJson('/api/'.$kind.'/'.$entity->id.'/image',
                ['workspace_id' => $workspace->id])->assertNoContent();
            $this->assertNull($entity->fresh()->image_path);
            Storage::disk('public')->assertMissing($path);
        }
    }

    public function test_cross_workspace_images_are_not_readable_or_mutable(): void
    {
        extract($this->fixture());
        $another = Workspace::create(['owner_id' => $other->id, 'name' => 'Otro']);
        $another->memberships()->create(['user_id' => $other->id, 'role' => 'owner']);
        $team = Team::create(['workspace_id' => $another->id, 'name' => 'Privado']);
        $this->actingAs($owner)->deleteJson('/api/teams/'.$team->id.'/image',
            ['workspace_id' => $workspace->id])->assertNotFound();
        $this->actingAs($other)->deleteJson('/api/teams/'.$team->id.'/image',
            ['workspace_id' => $workspace->id])->assertForbidden();
    }
}
