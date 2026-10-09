<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreScoreRequest;
use App\Http\Resources\ScoreResource;
use App\Services\ScoreService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ScoreController extends Controller
{
    public function __construct(private readonly ScoreService $scores) {}

    public function index(): AnonymousResourceCollection
    {
        return ScoreResource::collection($this->scores->leaderboard());
    }

    public function store(StoreScoreRequest $request): JsonResponse
    {
        $score = $this->scores->record($request->validated());

        return (new ScoreResource($score))->response()->setStatusCode($score->wasRecentlyCreated ? 201 : 200);
    }
}
