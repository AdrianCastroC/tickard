<?php

namespace Database\Seeders;

use App\Models\ClientCompany;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Idempotent branding for the Altaris demo.
 *
 * Safe to run independently after migrating an existing demo:
 * php artisan db:seed --class=DemoBrandAssetsSeeder
 *
 * Logos are kept in the repository docs/ and copied to the public disk, where
 * the existing image_url API and /storage/... convention can serve them.
 */
class DemoBrandAssetsSeeder extends Seeder
{
    public function run(): void
    {
        $owner = User::query()->where('email', 'ana@gestor.test')->firstOrFail();
        $workspace = Workspace::query()
            ->where('owner_id', $owner->id)
            ->whereIn('name', ['Tickard Demo', 'Altaris'])
            ->firstOrFail();

        $workspace->update([
            'name' => 'Altaris',
            'image_path' => $this->copyImage('Altaris_logo.png',
                "workspace-entities/{$workspace->id}/workspace/altaris.png"),
        ]);

        foreach ([
            'Aster Labs' => ['AsterLabs_logo.png', 'aster-labs.png'],
            'Norte Digital' => ['NorteDigital_logo.png', 'norte-digital.png'],
        ] as $name => [$file, $destination]) {
            $client = ClientCompany::query()
                ->where('workspace_id', $workspace->id)
                ->where('name', $name)
                ->first();

            // Existing demos can have only one of the two clients.
            if ($client !== null) {
                $client->update([
                    'image_path' => $this->copyImage($file,
                        "workspace-entities/{$workspace->id}/clients/{$destination}"),
                ]);
            }
        }
    }

    private function copyImage(string $file, string $destination): string
    {
        $source = base_path('../docs/'.$file);
        if (! is_file($source) || ! is_readable($source)) {
            throw new RuntimeException("No se encuentra el logo de demo: {$source}");
        }

        $content = file_get_contents($source);
        if ($content === false || ! Storage::disk('public')->put($destination, $content)) {
            throw new RuntimeException("No se pudo almacenar el logo de demo: {$file}");
        }

        return $destination;
    }
}
