<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Run;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LeaderboardController extends Controller
{
    public function leaderboard(Request $req)
    {
        $range = strtolower($req->query('range','global'));
        $level = $req->query('level');

        $q = Run::select(DB::raw('players.nickname, MAX(runs.score) as score, MAX(runs.created_at) as at'))
                ->join('players','players.id','=','runs.player_id')
                ->groupBy('players.nickname')
                ->orderBy('score','DESC')
                ->limit(50);

        if ($level) {
            $q->where('level_id', function($sq) use ($level){
                $sq->select('id')->from('levels')->where('code',$level)->limit(1);
            });
        }

        if ($range === 'weekly') $q->where('runs.created_at','>=',now()->subDays(7));
        if ($range === 'daily')  $q->whereDate('runs.created_at', now());

        return $q->get();
    }
}
