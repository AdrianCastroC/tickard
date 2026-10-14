<?php

namespace App\Support;

use App\Models\Card;
use App\Models\CardDependency;
use App\Models\Column;
use Illuminate\Support\Facades\DB;

class MilestoneCompletionService
{
    /**
     * Completa el hito únicamente cuando tiene requisitos y todos están cumplidos.
     * Si se completa, evalúa también los hitos que dependan de él, incluso en otros tableros.
     * Nunca reabre automáticamente hitos ya completados.
     */
    public function evaluate(Card $card, ?int $actorId = null): void
    {
        $pending = [$card->id];
        $visited = [];

        while ($pending !== []) {
            $cardId = array_shift($pending);
            if (isset($visited[$cardId])) {
                continue;
            }
            $visited[$cardId] = true;

            if (! $this->completeIfReady($cardId, $actorId)) {
                continue;
            }

            $successorIds = CardDependency::where('predecessor_card_id', $cardId)
                ->pluck('successor_card_id')->all();
            array_push($pending, ...$successorIds);
        }
    }

    public function evaluateSuccessors(Card $predecessor, ?int $actorId = null): void
    {
        $successorIds = CardDependency::where('predecessor_card_id', $predecessor->id)
            ->pluck('successor_card_id');

        foreach ($successorIds as $id) {
            $card = Card::find($id);
            if ($card) {
                $this->evaluate($card, $actorId);
            }
        }
    }

    private function completeIfReady(int $cardId, ?int $actorId): bool
    {
        return DB::transaction(function () use ($cardId, $actorId): bool {
            $card = Card::whereKey($cardId)->lockForUpdate()->first();
            if (! $card || ! $card->is_milestone || ! $card->milestone_auto_complete || $card->archived_at) {
                return false;
            }

            if ($card->column->workflow_state === 'done') {
                return false;
            }

            $dependencies = $card->successorDependencies()->with('predecessor.column')->get();
            $items = $card->checklistItems()->get(['id', 'is_done']);

            // Sin dependencias ni elementos de checklist, solo se completa manualmente.
            if ($dependencies->isEmpty() && $items->isEmpty()) {
                return false;
            }

            if ($dependencies->contains(fn ($dependency) =>
                ! $dependency->predecessor || $dependency->predecessor->column->workflow_state !== 'done'
            )) {
                return false;
            }

            if ($items->contains(fn ($item) => ! $item->is_done)) {
                return false;
            }

            $doneColumn = Column::where('board_id', $card->board_id)
                ->where('workflow_state', 'done')->orderBy('position')->first();
            if (! $doneColumn) {
                return false;
            }

            $previousColumnId = $card->column_id;
            $lastPosition = Card::where('column_id', $doneColumn->id)
                ->whereNull('archived_at')->max('position');

            $card->column_id = $doneColumn->id;
            $card->position = $lastPosition === null ? 0 : ((int) $lastPosition + 1);
            $card->started_at ??= now();
            // En revisión puede existir completed_at; aquí guardamos el cumplimiento real.
            $card->completed_at = now();
            $card->save();

            // Mantener posiciones coherentes después del movimiento automático.
            $remaining = Card::where('column_id', $previousColumnId)
                ->whereNull('archived_at')->orderBy('position')->orderBy('id')->get(['id', 'position']);
            foreach ($remaining as $index => $remainingCard) {
                if ($remainingCard->position !== $index) {
                    $remainingCard->update(['position' => $index]);
                }
            }

            $card->activities()->create([
                'user_id' => $actorId,
                'type' => 'moved',
                'meta' => [
                    'column' => $doneColumn->name,
                    'reason' => 'milestone_auto_complete',
                ],
            ]);
            $card->board->touchRevision();

            return true;
        });
    }
}
