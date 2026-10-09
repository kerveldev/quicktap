<?php

use App\Http\Controllers\ScoreController;
use Illuminate\Support\Facades\Route;

Route::get('/leaderboard', [ScoreController::class, 'index'])->middleware('throttle:60,1');
Route::post('/scores', [ScoreController::class, 'store'])->middleware('throttle:20,1');
