<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Workspace;
use App\Support\ProjectFileStorage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ProjectFileStorageQuotaTest extends TestCase
{
    use RefreshDatabase;

    private function workspace(User $owner, string $name): Workspace
    {
        return Workspace::create([
            'name' => $name,
            'owner_id' => $owner->id,
        ]);
    }

    public function test_free_workspace_has_200_mb(): void
    {
        $user = User::factory()->create(['plan' => User::PLAN_FREE]);
        $workspace = $this->workspace($user, 'Personal');

        $this->assertSame(200 * 1024 * 1024, ProjectFileStorage::limitBytes($workspace));
        $this->assertNull(ProjectFileStorage::accountLimitBytes($workspace));
    }

    public function test_base_workspaces_have_independent_two_gb_quotas(): void
    {
        $user = User::factory()->create(['plan' => User::PLAN_BASE]);
        $first = $this->workspace($user, 'Uno');
        $second = $this->workspace($user, 'Dos');

        foreach ([$first, $second] as $workspace) {
            $this->assertSame(2 * 1024 * 1024 * 1024, ProjectFileStorage::limitBytes($workspace));
            $this->assertNull(ProjectFileStorage::accountLimitBytes($workspace));
        }
    }

    public function test_pro_pool_is_redistributed_equally_when_workspace_count_changes(): void
    {
        $owner = User::factory()->create(['plan' => User::PLAN_PRO]);
        $first = $this->workspace($owner, 'Uno');
        $this->assertSame(20 * 1024 * 1024 * 1024, ProjectFileStorage::limitBytes($first));

        $second = $this->workspace($owner, 'Dos');
        $this->assertSame(10 * 1024 * 1024 * 1024, ProjectFileStorage::limitBytes($first));
        $this->assertSame(10 * 1024 * 1024 * 1024, ProjectFileStorage::limitBytes($second));

        $third = $this->workspace($owner, 'Tres');
        $fourth = $this->workspace($owner, 'Cuatro');
        foreach ([$first, $second, $third, $fourth] as $workspace) {
            $this->assertSame(5 * 1024 * 1024 * 1024, ProjectFileStorage::limitBytes($workspace));
            $this->assertSame(20 * 1024 * 1024 * 1024, ProjectFileStorage::accountLimitBytes($workspace));
        }

        $fourth->delete();
        $this->assertSame(intdiv(20 * 1024 * 1024 * 1024, 3), ProjectFileStorage::limitBytes($first));
    }

    public function test_ten_pro_workspaces_have_two_gb_each_without_increasing_the_total_pool(): void
    {
        $owner = User::factory()->create(['plan' => User::PLAN_PRO]);
        $workspaces = [];
        for ($index = 1; $index <= 10; $index++) {
            $workspaces[] = $this->workspace($owner, 'Equipo '.$index);
        }

        foreach ($workspaces as $workspace) {
            $this->assertSame(2 * 1024 * 1024 * 1024, ProjectFileStorage::limitBytes($workspace));
            $this->assertSame(20 * 1024 * 1024 * 1024, ProjectFileStorage::accountLimitBytes($workspace));
        }
    }

    public function test_pro_count_only_includes_the_owners_own_workspaces(): void
    {
        $owner = User::factory()->create(['plan' => User::PLAN_PRO]);
        $other = User::factory()->create(['plan' => User::PLAN_PRO]);
        $mine = $this->workspace($owner, 'Propio');
        $this->workspace($other, 'Ajeno');

        $this->assertSame(20 * 1024 * 1024 * 1024, ProjectFileStorage::limitBytes($mine));
    }

    public function test_the_default_pro_allocation_cannot_be_exceeded_by_an_upload(): void
    {
        $owner = User::factory()->create(['plan' => User::PLAN_PRO]);
        $first = $this->workspace($owner, 'Uno');
        $this->workspace($owner, 'Dos');

        $this->expectException(ValidationException::class);
        ProjectFileStorage::assertRoom($first, 10 * 1024 * 1024 * 1024 + 1);
    }
}
