<?php

namespace App\Http\Controllers\Api;

use App\Models\AppNotification;
use App\Models\ClientCompany;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Support\WorkspaceClientAccess;
use App\Support\WorkspaceLimits;
use App\Support\WorkspacePersonnelGuard as Guard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
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
        $contact = $contactId !== null ? User::find($contactId) : null;
        if ($contactId !== null && (! $client || ! $contact ||
            $contact->email_verified_at === null ||
            WorkspaceClientAccess::companyId($contact, $workspace) !== (int) $client->id)) {
            throw ValidationException::withMessages(['primary_contact_user_id' =>
                'El contacto principal debe ser un usuario activo y verificado de esta empresa.']);
        }
        return $data;
    }

    private function representative(string $identity): ?User
    {
        $identity = trim($identity);
        if (filter_var($identity, FILTER_VALIDATE_EMAIL)) {
            return User::whereRaw('LOWER(email) = ?', [Str::lower($identity)])->first();
        }
        if (! preg_match('/^@?([a-z0-9_-]{1,30})#([0-9]{5,})$/i', $identity)) return null;
        return User::whereRaw('LOWER(public_handle) = ?', [Str::lower(ltrim($identity, '@'))])->first();
    }

    public function index(Request $request)
    {
        $workspace = Guard::resolve($request,
            (int) $request->validate(['workspace_id' => ['required', 'integer']])['workspace_id']);
        abort_unless($workspace->show_clients, 404);

        $clients = ClientCompany::with(['projects:id,client_company_id,name'])
            ->where('workspace_id', $workspace->id)->orderBy('name')->get();
        $people = $workspace->memberships()->with('user')->get()
            ->filter(fn ($member) => $member->user?->email_verified_at !== null)
            ->groupBy(fn ($member) => $member->user
                ? WorkspaceClientAccess::companyId($member->user, $workspace) : null);
        $present = fn (User $user) => [
            'id' => $user->id, 'name' => $user->name,
            'email' => $user->email, 'avatar_url' => $user->avatarUrl(),
            'professional_phone' => $user->professional_phone,
        ];
        $pending = WorkspaceInvitation::where('workspace_id', $workspace->id)
            ->whereNotNull('client_company_name')->where('status', 'pending')
            ->whereNull('revoked_at')->with('recipient:id,name,email')->orderByDesc('id')->get();

        return response()->json([
            'can_manage' => Guard::canManage($request, $workspace),
            'pending_clients' => $pending->map(fn ($invitation) => [
                'id' => $invitation->id, 'name' => $invitation->client_company_name,
                'representative' => $invitation->recipient?->name,
                'created_at' => $invitation->created_at?->toIso8601String(),
            ])->values(),
            'clients' => $clients->map(function (ClientCompany $client) use ($people, $present) {
                $users = $people->get($client->id, collect())->pluck('user')->sortBy('name')->values();
                $contact = $users->firstWhere('id', $client->primary_contact_user_id);
                return [
                    'id' => $client->id, 'name' => $client->name,
                    'client_type' => $client->client_type, 'sector' => $client->sector,
                    'description' => $client->description, 'status' => $client->status,
                    'created_at' => $client->created_at?->toIso8601String(),
                    'updated_at' => $client->updated_at?->toIso8601String(),
                    'primary_contact_user_id' => $contact?->id,
                    'primary_contact' => $contact ? $present($contact) : null,
                    'people' => $users->map($present)->values(),
                    'people_count' => $users->count(),
                    'needs_representative' => $users->isEmpty(),
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
        $identity = $request->validate([
            'representative' => ['required', 'string', 'max:255'],
            'primary_contact_user_id' => ['prohibited'],
        ])['representative'];
        $user = $this->representative($identity);
        if (! $user || $user->email_verified_at === null) {
            throw ValidationException::withMessages([
                'representative' => 'El representante debe tener una cuenta de Tickard con el correo verificado.',
            ]);
        }
        if ($workspace->memberships()->where('user_id', $user->id)->exists()) {
            throw ValidationException::withMessages([
                'representative' => 'Este usuario ya pertenece al Workspace. Selecciona una cuenta externa.',
            ]);
        }
        if (! WorkspaceLimits::canAddMember($workspace)) {
            throw ValidationException::withMessages(['representative' => 'No quedan plazas libres en el Workspace.']);
        }
        if (WorkspaceInvitation::where('workspace_id', $workspace->id)
            ->where('status', 'pending')->whereNotNull('client_company_name')
            ->whereRaw('LOWER(client_company_name) = ?', [Str::lower($data['name'])])
            ->whereNull('revoked_at')->exists()) {
            throw ValidationException::withMessages(['name' => 'Ya hay una invitación pendiente para esta empresa.']);
        }

        $invitation = WorkspaceInvitation::create([
            'workspace_id' => $workspace->id, 'project_id' => null,
            'recipient_user_id' => $user->id, 'invited_by' => $request->user()->id,
            'email' => null, 'token_hash' => hash('sha256', Str::random(64)),
            'max_uses' => 1, 'used_count' => 0, 'expires_at' => now()->addDays(30),
            'status' => 'pending', 'project_role' => null,
            'client_company_name' => $data['name'],
            'client_type' => $data['client_type'] ?? 'company',
            'client_sector' => $data['sector'], 'client_description' => $data['description'],
        ]);
        if ($user->notify_in_app) {
            AppNotification::create([
                'user_id' => $user->id, 'kind' => 'invitation',
                'body' => 'Te han invitado a representar a «'.$data['name'].'» en «'.$workspace->name.'».',
            ]);
        }
        return response()->json(['invitation_id' => $invitation->id,
            'status' => 'pending', 'name' => $data['name']], 201);
    }

    public function cancelPending(Request $request, WorkspaceInvitation $invitation)
    {
        $workspace = Guard::resolve($request,
            (int) $request->validate(['workspace_id' => ['required', 'integer']])['workspace_id'], true);
        abort_unless($invitation->workspace_id === $workspace->id
            && $invitation->client_company_name !== null, 404);
        abort_unless($invitation->status === 'pending' && ! $invitation->revoked_at, 409);
        $invitation->update(['revoked_at' => now()]);
        return response()->noContent();
    }

    public function update(Request $request, ClientCompany $client)
    {
        $workspace = Guard::resolve($request,
            (int) $request->validate(['workspace_id' => ['required', 'integer']])['workspace_id'], true);
        abort_unless($workspace->show_clients, 404);
        abort_unless((int) $client->workspace_id === (int) $workspace->id, 404);
        $data = $this->validated($request, $workspace, $client);
        $client->update([
            'name' => $data['name'], 'client_type' => $data['client_type'] ?? $client->client_type,
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
        if ($client->projects()->exists() || $workspace->memberships()
            ->where('client_company_id', $client->id)->exists() || $client->users()->exists()) {
            throw ValidationException::withMessages(['client' =>
                'No se puede eliminar una empresa con proyectos o usuarios vinculados.']);
        }
        $client->delete();
        return response()->noContent();
    }
}
