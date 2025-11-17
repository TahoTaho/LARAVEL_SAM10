<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Player;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class RegisterController extends Controller
{
    public function register(Request $req)
    {
        Log::info("RAW BODY:", [$req->getContent()]);
        Log::info("ALL:", $req->all());
        Log::info("nickname:", [$req->nickname]);

        $req->validate([
            'nickname' => 'required'
        ]);

        $player = Player::firstOrCreate(
            ['nickname' => $req->nickname],
            []
        );

        return ['player_id' => $player->id];
    }
}
