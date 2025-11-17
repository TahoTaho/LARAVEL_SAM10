<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Level extends Model {
    protected $fillable = [
        'code', 'name', 'par_time_ms'
    ];

    public function runs() {
        return $this->hasMany(Run::class);
    }
}
