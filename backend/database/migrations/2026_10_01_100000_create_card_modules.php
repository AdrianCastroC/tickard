<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('card_modules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('card_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32);
            $table->string('title')->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->index(['card_id', 'position']);
            $table->index(['card_id', 'type']);
        });

        Schema::table('card_checklist_items', function (Blueprint $table) {
            $table->foreignId('card_module_id')->nullable()->after('card_id')->constrained('card_modules')->cascadeOnDelete();
        });

        $cardIds = DB::table('cards')->pluck('id');
        foreach ($cardIds as $cardId) {
            $position = 0;
            $hasChecklist = DB::table('card_checklist_items')->where('card_id', $cardId)->exists();
            $hasFiles = DB::table('card_attachments')->where('card_id', $cardId)->exists();
            $hasComments = DB::table('comments')->where('card_id', $cardId)->exists();

            $checklistModuleId = null;
            if ($hasChecklist) {
                $checklistModuleId = DB::table('card_modules')->insertGetId([
                    'card_id' => $cardId,
                    'type' => 'checklist',
                    'title' => 'Checklist',
                    'position' => $position++,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                DB::table('card_checklist_items')
                    ->where('card_id', $cardId)
                    ->update(['card_module_id' => $checklistModuleId]);
            }

            if ($hasFiles) {
                DB::table('card_modules')->insert([
                    'card_id' => $cardId,
                    'type' => 'files',
                    'title' => null,
                    'position' => $position++,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            if ($hasComments) {
                DB::table('card_modules')->insert([
                    'card_id' => $cardId,
                    'type' => 'comments',
                    'title' => null,
                    'position' => $position++,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // Orphan items (shouldn't exist): create a module per card group
        $orphans = DB::table('card_checklist_items')->whereNull('card_module_id')->pluck('card_id')->unique();
        foreach ($orphans as $cardId) {
            $moduleId = DB::table('card_modules')->insertGetId([
                'card_id' => $cardId,
                'type' => 'checklist',
                'title' => 'Checklist',
                'position' => (int) DB::table('card_modules')->where('card_id', $cardId)->max('position') + 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('card_checklist_items')
                ->where('card_id', $cardId)
                ->whereNull('card_module_id')
                ->update(['card_module_id' => $moduleId]);
        }
    }

    public function down(): void
    {
        Schema::table('card_checklist_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('card_module_id');
        });
        Schema::dropIfExists('card_modules');
    }
};
