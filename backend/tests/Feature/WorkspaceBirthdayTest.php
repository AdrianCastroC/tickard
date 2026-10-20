<?php

namespace Tests\Feature;

use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceBirthdayTest extends TestCase
{
    use RefreshDatabase;

    private function example(): array
    {
        $owner = User::factory()->create(['is_admin' => false]);
        $member = User::factory()->create(['is_admin' => false, 'name' => 'Ana Prueba']);
        $viewer = User::factory()->create(['is_admin' => false]);
        $workspace = Workspace::create(['name' => 'Equipo', 'owner_id' => $owner->id]);
        foreach ([$owner, $member, $viewer] as $user) {
            $workspace->memberships()->create([
                'user_id' => $user->id,
                'role' => $user->id === $owner->id ? 'owner' : 'member',
            ]);
        }
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => 'Compañía']);
        $project = Project::create(['workspace_id' => $workspace->id, 'client_company_id' => $client->id, 'name' => 'App']);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $viewer->id, 'role' => 'lector']);
        return compact('owner', 'member', 'viewer', 'workspace', 'project');
    }

    public function test_date_is_optional_private_by_default_and_only_month_day_is_saved(): void
    {
        extract($this->example());
        $this->actingAs($member)->getJson('/api/me')
            ->assertOk()->assertJsonPath('user.birthday_month_day', null)
            ->assertJsonPath('user.share_birthday', false);

        $this->patchJson('/api/me', ['share_birthday' => true])
            ->assertUnprocessable()->assertJsonValidationErrors('share_birthday');
        $this->patchJson('/api/me', ['birthday_month_day' => '02-30'])
            ->assertUnprocessable()->assertJsonValidationErrors('birthday_month_day');
        $this->patchJson('/api/me', ['birthday_month_day' => '02-29', 'share_birthday' => true])
            ->assertOk()->assertJsonPath('user.birthday_month_day', '02-29')
            ->assertJsonPath('user.share_birthday', true);

        $this->patchJson('/api/me', ['birthday_month_day' => null])
            ->assertOk()->assertJsonPath('user.birthday_month_day', null)
            ->assertJsonPath('user.share_birthday', false);
    }

    public function test_shared_birthdays_are_virtual_annual_events_without_birth_year(): void
    {
        extract($this->example());
        $member->update(['birthday_month_day' => '10-19', 'share_birthday' => true]);
        $url = "/api/projects/{$project->id}/calendar-events?start_date=2026-10-01&end_date=2026-10-31";

        $this->actingAs($viewer)->getJson($url)->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.kind', 'birthday')
            ->assertJsonPath('0.start_date', '2026-10-19')
            ->assertJsonPath('0.birthday_user.id', $member->id)
            ->assertJsonMissingPath('0.birth_year')
            ->assertJsonMissingPath('0.birthday_month_day');

        $member->update(['share_birthday' => false]);
        $this->getJson($url)->assertOk()->assertJsonCount(0);
    }

    public function test_workspace_switch_controls_visibility_but_does_not_change_user_consent(): void
    {
        extract($this->example());
        $member->update(['birthday_month_day' => '10-19', 'share_birthday' => true]);
        $url = "/api/projects/{$project->id}/calendar-events?start_date=2026-10-01&end_date=2026-10-31";

        $this->actingAs($viewer)->getJson($url)->assertOk()->assertJsonCount(1);
        $this->patchJson("/api/workspaces/{$workspace->id}/birthday-settings", ['show_birthdays' => false])
            ->assertForbidden();

        $this->actingAs($owner)->patchJson("/api/workspaces/{$workspace->id}/birthday-settings", [
            'show_birthdays' => false,
        ])->assertOk()->assertJsonPath('show_birthdays', false);
        $this->getJson('/api/me?workspace_id='.$workspace->id)->assertOk()
            ->assertJsonPath('workspaces.0.show_birthdays', false);
        $this->actingAs($viewer)->getJson($url)->assertOk()->assertJsonCount(0);
        $this->assertTrue($member->fresh()->share_birthday);

        $this->actingAs($owner)->patchJson("/api/workspaces/{$workspace->id}/birthday-settings", [
            'show_birthdays' => true,
        ])->assertOk();
        $this->actingAs($viewer)->getJson($url)->assertOk()->assertJsonCount(1);
    }

    public function test_leap_day_is_celebrated_on_february_28_in_non_leap_years(): void
    {
        extract($this->example());
        $member->update(['birthday_month_day' => '02-29', 'share_birthday' => true]);
        $path = "/api/projects/{$project->id}/calendar-events";
        $this->actingAs($viewer)->getJson($path.'?start_date=2027-02-01&end_date=2027-02-28')
            ->assertOk()->assertJsonPath('0.start_date', '2027-02-28');
        $this->getJson($path.'?start_date=2028-02-01&end_date=2028-02-29')
            ->assertOk()->assertJsonPath('0.start_date', '2028-02-29');
    }

    public function test_birthdays_do_not_leak_to_another_workspace_or_external_clients(): void
    {
        extract($this->example());
        $member->update(['birthday_month_day' => '10-19', 'share_birthday' => true]);
        $outsider = User::factory()->create();
        $outsiderWorkspace = Workspace::create(['name' => 'Empresa ajena', 'owner_id' => $outsider->id]);
        $client = ClientCompany::create(['workspace_id' => $outsiderWorkspace->id, 'name' => 'Cliente']);
        $otherProject = Project::create(['workspace_id' => $outsiderWorkspace->id,
            'client_company_id' => $client->id, 'name' => 'Web']);
        $outsiderWorkspace->memberships()->create(['user_id' => $viewer->id, 'role' => 'member']);
        ProjectMember::create(['project_id' => $otherProject->id, 'user_id' => $viewer->id, 'role' => 'lector']);
        $url = "/api/projects/{$otherProject->id}/calendar-events?start_date=2026-10-01&end_date=2026-10-31";
        $this->actingAs($viewer)->getJson($url)->assertOk()->assertJsonCount(0);

        $external = User::factory()->create(['client_company_id' => $client->id]);
        ProjectMember::create(['project_id' => $otherProject->id, 'user_id' => $external->id, 'role' => 'cliente']);
        $this->actingAs($external)->getJson($url)->assertForbidden();
    }
}
