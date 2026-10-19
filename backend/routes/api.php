<?php

use App\Http\Controllers\Api\AdministrationController;
use App\Http\Controllers\Api\WorkspaceDepartmentsController;
use App\Http\Controllers\Api\WorkspaceEntityImagesController;
use App\Http\Controllers\Api\WorkspaceTeamsController;
use App\Http\Controllers\Api\WorkspaceClientsController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AccountSecurityController;
use App\Http\Controllers\Api\CardsController;
use App\Http\Controllers\Api\CalendarEventsController;
use App\Http\Controllers\Api\CardDependenciesController;
use App\Http\Controllers\Api\CardDetailsController;
use App\Http\Controllers\Api\InvitationsController;
use App\Http\Controllers\Api\WorkspaceInvitationsController;
use App\Http\Controllers\Api\WorkspaceMembersController;
use App\Http\Controllers\Api\ProjectsController;
use App\Http\Controllers\Api\ProjectFilesController;
use App\Http\Controllers\Api\ProjectPersonnelController;
use App\Http\Controllers\Api\ProjectBoardsOverviewController;
use App\Http\Controllers\Api\ProjectDashboardController;
use App\Http\Controllers\Api\BoardDashboardController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\WorkspacesController;
use App\Http\Controllers\Api\MyTasksController;
use App\Http\Controllers\Api\GlobalHomeController;
use App\Http\Controllers\Api\NotificationsController;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);
Route::get('/invitations/{token}', [InvitationsController::class, 'showInvitation']);
Route::get('/workspace-invitations/{token}', [WorkspaceInvitationsController::class, 'show']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/invitations/{token}/accept', [InvitationsController::class, 'acceptInvitation']);
    Route::post('/workspace-invitations/{token}/accept', [WorkspaceInvitationsController::class, 'accept']);
    Route::get('/my/invitations', [WorkspaceInvitationsController::class, 'received']);
    Route::get('/my/tasks', [MyTasksController::class, 'index']);
    Route::get('/my/home/projects', [GlobalHomeController::class, 'projects']);
    Route::post('/my/invitations/{invitation}/respond', [WorkspaceInvitationsController::class, 'respond']);
    Route::get('/workspaces/{workspace}/members-invitations', [WorkspaceInvitationsController::class, 'index']);
    Route::get('/workspaces/{workspace}/members', [WorkspaceMembersController::class, 'index']);
    Route::patch('/workspaces/{workspace}/members/{user}/role', [WorkspaceMembersController::class, 'updateRole']);
    Route::patch('/workspaces/{workspace}/members/{user}/job-title', [WorkspaceMembersController::class, 'updateJobTitle']);
    Route::delete('/workspaces/{workspace}/members/{user}', [WorkspaceMembersController::class, 'destroy']);
    Route::post('/workspaces/{workspace}/invitations', [WorkspaceInvitationsController::class, 'store']);
    Route::post('/workspaces/{workspace}/invitations/delete', [WorkspaceInvitationsController::class, 'deleteMany']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::patch('/me', [AuthController::class, 'updateMe']);
    Route::get('/me/security/{purpose}', [AccountSecurityController::class, 'status'])->whereIn('purpose', ['email', 'password']);
    Route::post('/me/security/{purpose}/start', [AccountSecurityController::class, 'start'])->whereIn('purpose', ['email', 'password'])->middleware('throttle:3,10');
    Route::post('/me/security/{purpose}/verify', [AccountSecurityController::class, 'verifyCurrent'])->whereIn('purpose', ['email', 'password'])->middleware('throttle:5,1');
    Route::post('/me/security/email/request-new', [AccountSecurityController::class, 'requestNewEmail'])->middleware('throttle:3,10');
    Route::post('/me/security/email/confirm', [AccountSecurityController::class, 'confirmNewEmail'])->middleware('throttle:5,1');
    Route::post('/me/security/password/finish', [AccountSecurityController::class, 'finishPassword'])->middleware('throttle:3,10');
    Route::post('/me/avatar', [AuthController::class, 'updateAvatar']);
    Route::get('/notifications', [NotificationsController::class, 'index']);
    Route::post('/notifications/read', [NotificationsController::class, 'readAll']);
    Route::post('/notifications/{notification}/read', [NotificationsController::class, 'read']);

    Route::post('/workspaces', [WorkspacesController::class, 'store']);
    Route::get('/workspaces/{workspace}/overview', [WorkspacesController::class, 'overview']);
    Route::patch('/workspaces/{workspace}', [WorkspacesController::class, 'update']);
    Route::post('/workspaces/{workspace}/image', [WorkspacesController::class, 'uploadImage']);
    Route::delete('/workspaces/{workspace}/image', [WorkspacesController::class, 'deleteImage']);
    Route::patch('/workspaces/{workspace}/birthday-settings', [WorkspacesController::class, 'updateBirthdaySettings']);
    Route::patch('/workspaces/{workspace}/client-settings', [WorkspacesController::class, 'updateClientSettings']);
    Route::delete('/workspaces/{workspace}', [WorkspacesController::class, 'destroy']);

    Route::get('/departments', [WorkspaceDepartmentsController::class, 'index']);
    Route::post('/departments', [WorkspaceDepartmentsController::class, 'store']);
    Route::patch('/departments/{department}', [WorkspaceDepartmentsController::class, 'update']);
    Route::delete('/departments/{department}', [WorkspaceDepartmentsController::class, 'destroy']);
    Route::post('/departments/{department}/image', [WorkspaceEntityImagesController::class, 'uploadDepartment']);
    Route::delete('/departments/{department}/image', [WorkspaceEntityImagesController::class, 'deleteDepartment']);

    Route::get('/clients', [WorkspaceClientsController::class, 'index']);
    Route::post('/clients', [WorkspaceClientsController::class, 'store']);
    Route::delete('/clients/pending/{invitation}', [WorkspaceClientsController::class, 'cancelPending']);
    Route::patch('/clients/{client}', [WorkspaceClientsController::class, 'update']);
    Route::delete('/clients/{client}', [WorkspaceClientsController::class, 'destroy']);
    Route::post('/clients/{client}/image', [WorkspaceEntityImagesController::class, 'uploadClient']);
    Route::delete('/clients/{client}/image', [WorkspaceEntityImagesController::class, 'deleteClient']);

    Route::get('/teams', [WorkspaceTeamsController::class, 'index']);
    Route::post('/teams', [WorkspaceTeamsController::class, 'store']);
    Route::patch('/teams/{team}', [WorkspaceTeamsController::class, 'update']);
    Route::delete('/teams/{team}', [WorkspaceTeamsController::class, 'destroy']);
    Route::post('/teams/{team}/image', [WorkspaceEntityImagesController::class, 'uploadTeam']);
    Route::delete('/teams/{team}/image', [WorkspaceEntityImagesController::class, 'deleteTeam']);

    Route::post('/projects', [ProjectsController::class, 'storeProject']);
    Route::delete('/projects/{project}', [ProjectsController::class, 'deleteProject']);

    Route::get('/projects/{project}/dashboard', [ProjectDashboardController::class, 'index']);
    Route::get('/projects/{project}/boards/overview', [ProjectBoardsOverviewController::class, 'index']);
    Route::get('/projects/{project}/personnel', [ProjectPersonnelController::class, 'index']);
    Route::get('/projects/{project}/invitations', [WorkspaceInvitationsController::class, 'projectIndex']);
    Route::post('/projects/{project}/invitations', [WorkspaceInvitationsController::class, 'projectStore']);
    Route::post('/projects/{project}/invitations/delete', [WorkspaceInvitationsController::class, 'projectDeleteMany']);
    Route::post('/projects/{project}/personnel/members', [ProjectPersonnelController::class, 'addMember']);
    Route::patch('/projects/{project}/personnel/members/{user}', [ProjectPersonnelController::class, 'updateMember']);
    Route::delete('/projects/{project}/personnel/members/{user}', [ProjectPersonnelController::class, 'removeMember']);
    Route::post('/projects/{project}/personnel/teams', [ProjectPersonnelController::class, 'assignTeam']);
    Route::delete('/projects/{project}/personnel/teams/{team}', [ProjectPersonnelController::class, 'unlinkTeam']);

    Route::get('/projects/{project}/files', [ProjectFilesController::class, 'index']);
    Route::post('/projects/{project}/files', [ProjectFilesController::class, 'store']);
    Route::post('/projects/{project}/files/download', [ProjectFilesController::class, 'downloadSelected']);
    Route::get('/project-files/{projectFile}/content', [ProjectFilesController::class, 'content']);
    Route::delete('/project-files/{projectFile}', [ProjectFilesController::class, 'destroy']);
    Route::get('/attachments/{attachment}/content', [ProjectFilesController::class, 'cardContent']);

    Route::get('/projects/{project}/calendar-events', [CalendarEventsController::class, 'index']);
    Route::post('/projects/{project}/calendar-events', [CalendarEventsController::class, 'store']);
    Route::patch('/calendar-events/{calendarEvent}', [CalendarEventsController::class, 'update']);
    Route::delete('/calendar-events/{calendarEvent}', [CalendarEventsController::class, 'destroy']);

    Route::post('/projects/{project}/boards', [ProjectsController::class, 'storeBoard']);
    Route::delete('/boards/{board}', [ProjectsController::class, 'deleteBoard']);

    Route::post('/projects/{project}/image', [ProjectsController::class, 'uploadProjectImage']);
    Route::delete('/projects/{project}/image', [ProjectsController::class, 'deleteProjectImage']);
    Route::get('/projects/{project}/settings', [ProjectsController::class, 'projectSettings']);
    Route::patch('/projects/{project}', [ProjectsController::class, 'updateProject']);
    Route::post('/projects/{project}/labels', [ProjectsController::class, 'storeLabel']);

    Route::get('/boards/{board}/dashboard', [BoardDashboardController::class, 'index']);
    Route::get('/boards/{board}', [ProjectsController::class, 'showBoard']);
    Route::post('/boards/{board}/columns', [CardsController::class, 'storeColumn']);
    Route::post('/boards/{board}/categories', [CardsController::class, 'storeCategory']);
    Route::patch('/columns/{column}', [CardsController::class, 'updateColumn']);
    Route::post('/columns/{column}/move', [CardsController::class, 'moveColumn']);
    Route::delete('/columns/{column}', [CardsController::class, 'destroyColumn']);
    Route::patch('/categories/{category}', [CardsController::class, 'updateCategory']);
    Route::delete('/categories/{category}', [CardsController::class, 'destroyCategory']);
    Route::post('/boards/{board}/cards', [CardsController::class, 'storeCard']);
    Route::patch('/cards/{card}', [CardsController::class, 'updateCard']);
    Route::post('/cards/{card}/dependencies', [CardDependenciesController::class, 'store']);
    Route::patch('/card-dependencies/{dependency}', [CardDependenciesController::class, 'update']);
    Route::delete('/card-dependencies/{dependency}', [CardDependenciesController::class, 'destroy']);
    Route::post('/cards/{card}/move', [CardsController::class, 'moveCard']);
    Route::post('/cards/{card}/archive', [CardsController::class, 'archiveCard']);
    Route::delete('/cards/{card}', [CardsController::class, 'destroyCard']);
    Route::post('/cards/{card}/modules', [CardDetailsController::class, 'storeModule']);
    Route::post('/cards/{card}/modules/reorder', [CardDetailsController::class, 'reorderModules']);
    Route::patch('/modules/{module}', [CardDetailsController::class, 'updateModule']);
    Route::delete('/modules/{module}', [CardDetailsController::class, 'destroyModule']);
    Route::post('/cards/{card}/checklist', [CardDetailsController::class, 'storeChecklistItem']);
    Route::post('/cards/{card}/checklist/reorder', [CardDetailsController::class, 'reorderChecklist']);
    Route::patch('/checklist/{item}', [CardDetailsController::class, 'updateChecklistItem']);
    Route::delete('/checklist/{item}', [CardDetailsController::class, 'destroyChecklistItem']);
    Route::post('/cards/{card}/attachments', [CardDetailsController::class, 'storeAttachment']);
    Route::delete('/attachments/{attachment}', [CardDetailsController::class, 'destroyAttachment']);
    Route::post('/cards/{card}/comments', [CardDetailsController::class, 'storeComment']);
    Route::delete('/comments/{comment}', [CardDetailsController::class, 'destroyComment']);
    Route::patch('/comments/{comment}/visibility', [CardDetailsController::class, 'updateCommentVisibility']);
    Route::post('/comments/{comment}/reactions', [CardDetailsController::class, 'reactToComment']);
});
