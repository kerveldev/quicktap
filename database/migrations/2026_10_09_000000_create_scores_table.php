<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scores', function (Blueprint $table) {
            $table->id();
            $table->uuid('submission_id')->unique();
            $table->string('player_name', 24);
            $table->unsignedInteger('score');
            $table->timestamps();
            $table->index(['score', 'created_at', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scores');
    }
};
