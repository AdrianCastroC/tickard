<?php

namespace App\Http\Controllers\Api;

use App\Models\ClientCompany;
use App\Support\WorkspacePersonnelGuard as Guard;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WorkspaceClientsController extends ApiController
{
    public function index(Request $request)
    {
        $data = $request->validate(['workspace_id' => ['required', 'integer']]);
        $workspace = Guard::resolve($request, (int) $data['workspace_id']);
        $clients = ClientCompany::withCount(['projects', 'users'])
            ->where('workspace_id', $workspace->id)->orderBy('name')->get();
        return response()->json([
            'can_manage' => Guard::canManage($request, $workspace),
            'clients' => $clients->map(fn (ClientCompany $company) => [
                'id' => $company->id, 'name' => $company->name,
                'projects_count' => $company->projects_count,
                'people_count' => $company->users_count,
            ])->values(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
            'name' => ['required', 'string', 'max:120'],
        ]);
        $workspace = Guard::resolve($request, (int) $data['workspace_id'], true);
        $name = trim($data['name']);
        if ($name === '') {
            throw ValidationException::withMessages(['name' => 'Introduce el nombre de la empresa.']);
        }
        $request->validate(['name' => Rule::unique('client_companies')->where('workspace_id', $workspace->id)]);
        $client = ClientCompany::create(['workspace_id' => $workspace->id, 'name' => $name]);
        return response()->json(['id' => $client->id], 201);
    }

    public function update(Request $request, ClientCompany $client)
    {
        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
            'name' => ['required', 'string', 'max:120'],
        ]);
        $workspace = Guard::resolve($request, (int) $data['workspace_id'], true);
        abort_unless((int) $client->workspace_id === (int) $workspace->id, 404);
        $name = trim($data['name']);
        if ($name === '') {
            throw ValidationException::withMessages(['name' => 'Introduce el nombre de la empresa.']);
        }
        $request->validate(['name' => Rule::unique('client_companies')
            ->where('workspace_id', $workspace->id)->ignore($client->id)]);
        $client->update(['name' => $name]);
        return response()->noContent();
    }

    public function destroy(Request $request, ClientCompany $client)
    {
        $data = $request->validate(['workspace_id' => ['required', 'integer']]);
        $workspace = Guard::resolve($request, (int) $data['workspace_id'], true);
        abort_unless((int) $client->workspace_id === (int) $workspace->id, 404);
        if ($client->projects()->exists() || $client->users()->exists()) {
            throw ValidationException::withMessages(['client' =>
                'No se puede eliminar: la empresa tiene proyectos o usuarios asociados.']);
        }
        $client->delete();
        return response()->noContent();
    }
}
