<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Player extends Model {
    protected $fillable = [
        'nickname', 'country', 'device_fingerprint'
    ];

    public function runs() {
        return $this->hasMany(Run::class);
    }
}
