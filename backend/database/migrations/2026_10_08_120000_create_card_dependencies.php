<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('card_dependencies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('predecessor_card_id')->constrained('cards')->cascadeOnDelete();
            $table->foreignId('successor_card_id')->constrained('cards')->cascadeOnDelete();
            $table->string('type', 2);
            $table->timestamps();
            $table->unique(['predecessor_card_id', 'successor_card_id']);
            $table->index('successor_card_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('card_dependencies');
    }
};
