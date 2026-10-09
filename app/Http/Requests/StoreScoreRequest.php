<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreScoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'submission_id' => ['required', 'uuid'],
            'player_name' => ['required', 'string', 'max:24', 'regex:/^[\pL\pN _.-]+$/u'],
            'score' => ['required', 'integer', 'min:0', 'max:1000000', 'multiple_of:10'],
        ];
    }
}
