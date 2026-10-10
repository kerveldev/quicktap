<?php

namespace Tests\Feature;

use App\Models\Score;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class ScoreApiTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Explicit isolated fixture schema: no migration runner, no remote connection.
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        DB::statement('CREATE TABLE scores (id INTEGER PRIMARY KEY AUTOINCREMENT, submission_id VARCHAR(36) UNIQUE NOT NULL, player_name VARCHAR(24) NOT NULL, score INTEGER NOT NULL, created_at DATETIME, updated_at DATETIME)');
    }

    public function test_it_saves_a_score_and_retries_idempotently(): void
    {
        $payload = ['submission_id' => (string) Str::uuid(), 'player_name' => '  Luna  ', 'score' => 35];
        $this->postJson('/api/scores', $payload)->assertCreated()->assertJsonPath('data.player_name', 'Luna')->assertJsonPath('data.score', 35)->assertJsonStructure(['data' => ['id', 'created_at']]);
        $payload['score'] = 500;
        $this->postJson('/api/scores', $payload)->assertOk()->assertJsonPath('data.score', 35);
        $this->assertSame(1, Score::count());
    }

    public function test_it_validates_untrusted_scores_and_names(): void
    {
        foreach ([-10, 11, 1000010, 'invalid', 1.5] as $score) {
            $this->postJson('/api/scores', ['submission_id' => (string) Str::uuid(), 'player_name' => 'Alex', 'score' => $score])->assertUnprocessable()->assertJsonValidationErrors('score');
        }
        foreach (['', '   ', '<script>alert(1)</script>', str_repeat('x', 25)] as $name) {
            $this->postJson('/api/scores', ['submission_id' => (string) Str::uuid(), 'player_name' => $name, 'score' => 0])->assertUnprocessable()->assertJsonValidationErrors('player_name');
        }
        $this->postJson('/api/scores', ['player_name' => 'Alex', 'score' => 0])->assertUnprocessable()->assertJsonValidationErrors('submission_id');
        $this->assertSame(0, Score::count());
    }

    public function test_leaderboard_is_top_ten_sorted_with_stable_ties(): void
    {
        for ($i = 0; $i < 12; $i++) {
            Score::create(['submission_id' => (string) Str::uuid(), 'player_name' => 'Player '.$i, 'score' => $i * 10]);
        }
        Score::create(['submission_id' => (string) Str::uuid(), 'player_name' => 'Tie', 'score' => 110]);
        $this->getJson('/api/leaderboard')->assertOk()->assertJsonCount(10, 'data')->assertJsonPath('data.0.player_name', 'Player 11')->assertJsonPath('data.1.player_name', 'Tie')->assertJsonPath('data.9.score', 30)->assertJsonMissingPath('data.0.submission_id');
    }

    public function test_empty_leaderboard_and_zero_score_are_supported(): void
    {
        $this->getJson('/api/leaderboard')->assertOk()->assertExactJson(['data' => []]);
        $this->postJson('/api/scores', ['submission_id' => (string) Str::uuid(), 'player_name' => 'José', 'score' => 0])->assertCreated();
    }

    public function test_write_endpoint_is_rate_limited(): void
    {
        for ($i = 0; $i < 20; $i++) {
            $this->postJson('/api/scores', [])->assertUnprocessable();
        }
        $this->postJson('/api/scores', [])->assertStatus(429);
    }
}
