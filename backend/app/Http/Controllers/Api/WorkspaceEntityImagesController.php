<?php

namespace App\Http\Controllers\Api;

use App\Models\ClientCompany;
use App\Models\Department;
use App\Models\Team;
use App\Support\WorkspacePersonnelGuard as Guard;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\File;

class WorkspaceEntityImagesController extends ApiController
{
    private function authorizeEntity(Request $request, Model $entity): void
    {
        $id = (int) $request->validate(['workspace_id' => ['required', 'integer']])['workspace_id'];
        $workspace = Guard::resolve($request, $id, true);
        abort_unless((int) $entity->workspace_id === (int) $workspace->id, 404);
        if ($entity instanceof ClientCompany) abort_unless($workspace->show_clients, 404);
    }

    private function upload(Request $request, Model $entity, string $folder)
    {
        $this->authorizeEntity($request, $entity);
        $request->validate(['image' => [
            'required', File::types(['jpg', 'jpeg', 'png', 'webp'])->max(2048),
        ]]);
        $old = $entity->image_path;
        $path = $request->file('image')->store("workspace-entities/{$entity->workspace_id}/{$folder}", 'public');
        try {
            $entity->update(['image_path' => $path]);
        } catch (\Throwable $e) {
            Storage::disk('public')->delete($path);
            throw $e;
        }
        if ($old) Storage::disk('public')->delete($old);
        return response()->json(['image_url' => '/storage/'.$path]);
    }

    private function deleteImage(Request $request, Model $entity)
    {
        $this->authorizeEntity($request, $entity);
        $old = $entity->image_path;
        $entity->update(['image_path' => null]);
        if ($old) Storage::disk('public')->delete($old);
        return response()->noContent();
    }

    public function uploadDepartment(Request $request, Department $department)
    { return $this->upload($request, $department, 'departments'); }
    public function deleteDepartment(Request $request, Department $department)
    { return $this->deleteImage($request, $department); }

    public function uploadTeam(Request $request, Team $team)
    { return $this->upload($request, $team, 'teams'); }
    public function deleteTeam(Request $request, Team $team)
    { return $this->deleteImage($request, $team); }

    public function uploadClient(Request $request, ClientCompany $client)
    { return $this->upload($request, $client, 'clients'); }
    public function deleteClient(Request $request, ClientCompany $client)
    { return $this->deleteImage($request, $client); }
}
