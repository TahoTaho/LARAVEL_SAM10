<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('index'); // resources/views/index.blade.php
});

Route::get('/leaderboard-page', function () {
    return view('leaderboard'); // resources/views/leaderboard.blade.php
});
