<?php

namespace App\Services;

use App\Models\Score;
use Illuminate\Database\Eloquent\Collection;

class ScoreService
{
    public function leaderboard(): Collection
    {
        return Score::query()->orderByDesc('score')->orderBy('created_at')->orderBy('id')->limit(10)->get();
    }

    public function record(array $data): Score
    {
        // The unique UUID makes retries safe, including concurrent requests.
        return Score::query()->firstOrCreate(
            ['submission_id' => $data['submission_id']],
            ['player_name' => $data['player_name'], 'score' => $data['score']],
        );
    }
}
