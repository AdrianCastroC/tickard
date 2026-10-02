<?php

use App\Http\Controllers\Api\GestorController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [GestorController::class, 'login']);
Route::get('/invitations/{token}', [GestorController::class, 'showInvitation']);
Route::post('/invitations/{token}/accept', [GestorController::class, 'acceptInvitation']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [GestorController::class, 'logout']);
    Route::get('/me', [GestorController::class, 'me']);
    Route::patch('/me', [GestorController::class, 'updateMe']);
    Route::post('/me/avatar', [GestorController::class, 'updateAvatar']);
    Route::get('/notifications', [GestorController::class, 'notifications']);
    Route::post('/notifications/read', [GestorController::class, 'readNotifications']);

    Route::get('/departments', [GestorController::class, 'departments']);
    Route::post('/departments', [GestorController::class, 'storeDepartment']);
    Route::patch('/departments/{department}', [GestorController::class, 'updateDepartment']);
    Route::delete('/departments/{department}', [GestorController::class, 'destroyDepartment']);

    Route::get('/clients', [GestorController::class, 'clients']);
    Route::post('/clients', [GestorController::class, 'storeClient']);

    Route::get('/teams', [GestorController::class, 'teams']);
    Route::post('/teams', [GestorController::class, 'storeTeam']);
    Route::patch('/teams/{team}', [GestorController::class, 'updateTeam']);
    Route::delete('/teams/{team}', [GestorController::class, 'destroyTeam']);

    Route::post('/projects', [GestorController::class, 'storeProject']);
    Route::post('/projects/{project}/boards', [GestorController::class, 'storeBoard']);
    Route::patch('/projects/{project}', [GestorController::class, 'updateProject']);
    Route::post('/projects/{project}/labels', [GestorController::class, 'storeLabel']);
    Route::post('/projects/{project}/invitations', [GestorController::class, 'invite']);

    Route::get('/boards/{board}', [GestorController::class, 'showBoard']);
    Route::post('/boards/{board}/columns', [GestorController::class, 'storeColumn']);
    Route::post('/boards/{board}/categories', [GestorController::class, 'storeCategory']);
    Route::patch('/columns/{column}', [GestorController::class, 'updateColumn']);
    Route::post('/columns/{column}/move', [GestorController::class, 'moveColumn']);
    Route::delete('/columns/{column}', [GestorController::class, 'destroyColumn']);
    Route::patch('/categories/{category}', [GestorController::class, 'updateCategory']);
    Route::delete('/categories/{category}', [GestorController::class, 'destroyCategory']);
    Route::post('/boards/{board}/cards', [GestorController::class, 'storeCard']);
    Route::patch('/cards/{card}', [GestorController::class, 'updateCard']);
    Route::post('/cards/{card}/move', [GestorController::class, 'moveCard']);
    Route::post('/cards/{card}/archive', [GestorController::class, 'archiveCard']);
    Route::delete('/cards/{card}', [GestorController::class, 'destroyCard']);
    Route::post('/cards/{card}/modules', [GestorController::class, 'storeModule']);
    Route::post('/cards/{card}/modules/reorder', [GestorController::class, 'reorderModules']);
    Route::patch('/modules/{module}', [GestorController::class, 'updateModule']);
    Route::delete('/modules/{module}', [GestorController::class, 'destroyModule']);
    Route::post('/cards/{card}/checklist', [GestorController::class, 'storeChecklistItem']);
    Route::post('/cards/{card}/checklist/reorder', [GestorController::class, 'reorderChecklist']);
    Route::patch('/checklist/{item}', [GestorController::class, 'updateChecklistItem']);
    Route::delete('/checklist/{item}', [GestorController::class, 'destroyChecklistItem']);
    Route::post('/cards/{card}/attachments', [GestorController::class, 'storeAttachment']);
    Route::delete('/attachments/{attachment}', [GestorController::class, 'destroyAttachment']);
    Route::post('/cards/{card}/comments', [GestorController::class, 'storeComment']);
    Route::delete('/comments/{comment}', [GestorController::class, 'destroyComment']);
    Route::patch('/comments/{comment}/visibility', [GestorController::class, 'updateCommentVisibility']);
    Route::post('/comments/{comment}/reactions', [GestorController::class, 'reactToComment']);
});
