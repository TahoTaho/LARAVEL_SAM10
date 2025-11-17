<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Run extends Model {
    protected $fillable = [
        'player_id','level_id','difficulty',
        'time_ms','detections','backstabs',
        'smokes_used','noise_score','score'
    ];

    public function player() {
        return $this->belongsTo(Player::class);
    }

    public function level() {
        return $this->belongsTo(Level::class);
    }
}

