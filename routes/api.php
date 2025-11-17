<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\RegisterController;
use App\Http\Controllers\Api\GameController;
use App\Http\Controllers\Api\LeaderboardController;

Route::post('/register', [RegisterController::class, 'register']);
Route::post('/score', [GameController::class, 'saveScore']);
Route::get('/leaderboard', [LeaderboardController::class, 'leaderboard']);
