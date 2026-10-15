<?php

use App\Http\Controllers\Api\AdministrationController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CardsController;
use App\Http\Controllers\Api\CalendarEventsController;
use App\Http\Controllers\Api\CardDependenciesController;
use App\Http\Controllers\Api\CardDetailsController;
use App\Http\Controllers\Api\InvitationsController;
use App\Http\Controllers\Api\WorkspaceInvitationsController;
use App\Http\Controllers\Api\ProjectsController;
use App\Http\Controllers\Api\ProjectFilesController;
use App\Http\Controllers\Api\ProjectPersonnelController;
use App\Http\Controllers\Api\ProjectBoardsOverviewController;
use App\Http\Controllers\Api\ProjectDashboardController;
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
    Route::post('/workspaces/{workspace}/invitations', [WorkspaceInvitationsController::class, 'store']);
    Route::post('/workspaces/{workspace}/invitations/delete', [WorkspaceInvitationsController::class, 'deleteMany']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::patch('/me', [AuthController::class, 'updateMe']);
    Route::post('/me/avatar', [AuthController::class, 'updateAvatar']);
    Route::get('/notifications', [NotificationsController::class, 'index']);
    Route::post('/notifications/read', [NotificationsController::class, 'readAll']);
    Route::post('/notifications/{notification}/read', [NotificationsController::class, 'read']);

    Route::post('/workspaces', [WorkspacesController::class, 'store']);
    Route::patch('/workspaces/{workspace}', [WorkspacesController::class, 'update']);
    Route::delete('/workspaces/{workspace}', [WorkspacesController::class, 'destroy']);

    Route::get('/departments', [AdministrationController::class, 'departments']);
    Route::post('/departments', [AdministrationController::class, 'storeDepartment']);
    Route::patch('/departments/{department}', [AdministrationController::class, 'updateDepartment']);
    Route::delete('/departments/{department}', [AdministrationController::class, 'destroyDepartment']);

    Route::get('/clients', [AdministrationController::class, 'clients']);
    Route::post('/clients', [AdministrationController::class, 'storeClient']);

    Route::get('/teams', [AdministrationController::class, 'teams']);
    Route::post('/teams', [AdministrationController::class, 'storeTeam']);
    Route::patch('/teams/{team}', [AdministrationController::class, 'updateTeam']);
    Route::delete('/teams/{team}', [AdministrationController::class, 'destroyTeam']);

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

    Route::patch('/projects/{project}', [ProjectsController::class, 'updateProject']);
    Route::post('/projects/{project}/labels', [ProjectsController::class, 'storeLabel']);

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
