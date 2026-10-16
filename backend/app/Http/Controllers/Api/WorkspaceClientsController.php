<?php

namespace App\Http\Controllers\Api;

use App\Models\ClientCompany;
use App\Models\User;
use App\Support\WorkspacePersonnelGuard as Guard;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WorkspaceClientsController extends ApiController
{
    private function validated(Request $request, $workspace, ?ClientCompany $client = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120',
                Rule::unique('client_companies', 'name')->where('workspace_id', $workspace->id)->ignore($client?->id)],
            'client_type' => ['sometimes', Rule::in(['company', 'self_employed', 'individual', 'institution'])],
            'sector' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1500'],
            'status' => ['sometimes', Rule::in(['active', 'inactive', 'archived'])],
            'primary_contact_user_id' => ['nullable', 'integer'],
        ]);
        $data['name'] = trim($data['name']);
        if ($data['name'] === '') {
            throw ValidationException::withMessages(['name' => 'Indica el nombre del cliente.']);
        }
        $data['sector'] = isset($data['sector']) ? trim($data['sector']) ?: null : null;
        $data['description'] = isset($data['description']) ? trim($data['description']) ?: null : null;
        $contactId = $data['primary_contact_user_id'] ?? null;
        if ($contactId !== null && (! $client || ! $client->users()
            ->whereKey($contactId)
            ->whereNotNull('email_verified_at')
            ->whereHas('workspaces', fn ($query) => $query->where('workspaces.id', $workspace->id))
            ->exists())) {
            throw ValidationException::withMessages(['primary_contact_user_id' =>
                'El contacto principal debe ser un usuario activo y verificado de esta empresa.']);
        }
        return $data;
    }

    public function index(Request $request)
    {
        $data = $request->validate(['workspace_id' => ['required', 'integer']]);
        $workspace = Guard::resolve($request, (int) $data['workspace_id']);
        abort_unless($workspace->show_clients, 404);

        $clients = ClientCompany::with([
            'projects:id,client_company_id,name',
            'users:id,client_company_id,name,email,email_verified_at,avatar_path,professional_phone',
        ])->where('workspace_id', $workspace->id)->orderBy('name')->get();
        $members = $workspace->memberships()->pluck('user_id')->all();
        $active = array_fill_keys($members, true);
        $present = fn (User $user) => [
            'id' => $user->id, 'name' => $user->name,
            'email' => $user->email, 'avatar_url' => $user->avatarUrl(),
            'professional_phone' => $user->professional_phone,
        ];

        return response()->json([
            'can_manage' => Guard::canManage($request, $workspace),
            'clients' => $clients->map(function (ClientCompany $client) use ($active, $present) {
                $people = $client->users->filter(fn (User $user) =>
                    isset($active[$user->id]) && $user->email_verified_at !== null
                )->sortBy('name')->values();
                $contact = $people->firstWhere('id', $client->primary_contact_user_id);
                return [
                    'id' => $client->id, 'name' => $client->name,
                    'client_type' => $client->client_type, 'sector' => $client->sector,
                    'description' => $client->description, 'status' => $client->status,
                    'created_at' => $client->created_at?->toIso8601String(),
                    'updated_at' => $client->updated_at?->toIso8601String(),
                    'primary_contact_user_id' => $contact?->id,
                    'primary_contact' => $contact ? $present($contact) : null,
                    'people' => $people->map($present)->values(),
                    'people_count' => $people->count(),
                    'projects' => $client->projects->map(fn ($project) => [
                        'id' => $project->id, 'name' => $project->name,
                    ])->values(),
                    'projects_count' => $client->projects->count(),
                ];
            })->values(),
        ]);
    }

    public function store(Request $request)
    {
        $workspace = Guard::resolve($request,
            (int) $request->validate(['workspace_id' => ['required', 'integer']])['workspace_id'], true);
        abort_unless($workspace->show_clients, 404);
        $data = $this->validated($request, $workspace);
        $client = ClientCompany::create([
            'workspace_id' => $workspace->id, 'name' => $data['name'],
            'client_type' => $data['client_type'] ?? 'company',
            'sector' => $data['sector'], 'description' => $data['description'],
            'status' => $data['status'] ?? 'active',
            'primary_contact_user_id' => null,
        ]);
        return response()->json(['id' => $client->id], 201);
    }

    public function update(Request $request, ClientCompany $client)
    {
        $workspace = Guard::resolve($request,
            (int) $request->validate(['workspace_id' => ['required', 'integer']])['workspace_id'], true);
        abort_unless($workspace->show_clients, 404);
        abort_unless((int) $client->workspace_id === (int) $workspace->id, 404);
        $data = $this->validated($request, $workspace, $client);
        $client->update([
            'name' => $data['name'],
            'client_type' => $data['client_type'] ?? $client->client_type,
            'sector' => $data['sector'], 'description' => $data['description'],
            'status' => $data['status'] ?? $client->status,
            'primary_contact_user_id' => $data['primary_contact_user_id'] ?? null,
        ]);
        return response()->noContent();
    }

    public function destroy(Request $request, ClientCompany $client)
    {
        $workspace = Guard::resolve($request,
            (int) $request->validate(['workspace_id' => ['required', 'integer']])['workspace_id'], true);
        abort_unless($workspace->show_clients, 404);
        abort_unless((int) $client->workspace_id === (int) $workspace->id, 404);
        if ($client->projects()->exists() || $client->users()->exists()) {
            throw ValidationException::withMessages(['client' =>
                'No se puede eliminar: la empresa tiene proyectos o usuarios asociados.']);
        }
        $client->delete();
        return response()->noContent();
    }
}
