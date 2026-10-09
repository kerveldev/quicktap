<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ScoreResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'player_name' => $this->player_name, 'score' => $this->score,
            'created_at' => $this->created_at->toISOString()];
    }
}
