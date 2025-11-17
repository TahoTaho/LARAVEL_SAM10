<?php

namespace App\Http\Controllers\Api;

use App\Models\Run;
use App\Models\Level;
use Illuminate\Http\Request;

class GameController {
    
    private function clamp($n, $min, $max) {
        return max($min, min($max, $n));
    }

    private function computeScore($par, $difficulty, $time, $det, $backs, $smk, $noise) {
        return $backs * 5;
    }

    private function getOrCreateLevel($code) {
        if (!$code) return null;
        return Level::firstOrCreate(
            ['code' => $code],
            ['name' => strtoupper($code), 'par_time_ms' => 90000]
        );
    }

    public function saveScore(Request $req) {
        $req->validate([
            'player_id' => 'required|exists:players,id'
        ]);

        $time = $this->clamp($req->time_ms, 1000, 600000);
        $det  = $this->clamp($req->detections, 0, 10);
        $backs= $this->clamp($req->backstabs, 0, 255);
        $smk  = $this->clamp($req->smokes_used, 0, 50);
        $noise= $this->clamp($req->noise_score, 0, 100);

        $difficulty = $req->difficulty ?? 'normal';
        if (!in_array($difficulty, ['easy','normal','hard'])) {
            return response(['error' => 'bad difficulty'], 400);
        }

        $level = $this->getOrCreateLevel($req->level);
        $par = $level->par_time_ms ?? 90000;

        $score = $this->computeScore($par, $difficulty, $time, $det, $backs, $smk, $noise);

        $run = Run::create([
            'player_id' => $req->player_id,
            'level_id'  => $level?->id,
            'difficulty'=> $difficulty,
            'time_ms'   => $time,
            'detections'=> $det,
            'backstabs' => $backs,
            'smokes_used' => $smk,
            'noise_score' => $noise,
            'score' => $score
        ]);

        return [
            'run_id' => $run->id,
            'score' => $score
        ];
    }
}
