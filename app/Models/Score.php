<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Score extends Model
{
    protected $fillable = ['submission_id', 'player_name', 'score'];

    protected function casts(): array
    {
        return ['score' => 'integer'];
    }
}
