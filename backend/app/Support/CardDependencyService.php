<?php

namespace App\Support;

use App\Models\Card;
use App\Models\CardChecklistItem;
use App\Models\CardDependency;
use Illuminate\Validation\ValidationException;

class CardDependencyService
{
    public const TYPES = ['fs', 'ss', 'ff', 'sf'];

    public function create(Card $predecessor, Card $successor): CardDependency
    {
        if ($predecessor->is($successor)) {
            throw ValidationException::withMessages(['successor_card_id' => 'Una tarjeta no puede depender de sí misma.']);
        }
        if ($predecessor->board->project_id !== $successor->board->project_id) {
            throw ValidationException::withMessages(['successor_card_id' => 'Las dependencias solo pueden crearse entre Cards del mismo Project.']);
        }
        $this->validatePlanned($predecessor, $successor);
        if (CardDependency::where('predecessor_card_id', $predecessor->id)->where('successor_card_id', $successor->id)->exists()) {
            throw ValidationException::withMessages(['successor_card_id' => 'La dependencia ya existe.']);
        }
        if ($this->reaches($successor, $predecessor)) {
            throw ValidationException::withMessages(['successor_card_id' => 'La dependencia crearía un ciclo.']);
        }

        return CardDependency::create([
            'predecessor_card_id' => $predecessor->id,
            'successor_card_id' => $successor->id,
            'type' => $this->inferType($predecessor, $successor),
        ]);
    }

    public function updateType(CardDependency $dependency, string $type): array
    {
        if (! in_array($type, self::TYPES, true)) {
            throw ValidationException::withMessages(['type' => 'Tipo de dependencia no válido.']);
        }
        $dependency->update(['type' => $type]);
        $dependency = $dependency->fresh(['predecessor', 'successor']);

        return $this->apply($dependency);
    }

    public function apply(CardDependency $dependency): array
    {
        $successor = $dependency->successor;

        if (! $successor) {
            return [];
        }
        $affectedBoardIds = $this->recalculate($successor)
            ? [$successor->board_id]
            : [];

        return array_values(array_unique(array_merge($affectedBoardIds, $this->propagate($successor))));
    }

    public function recalculate(Card $successor): bool
    {
        $successor->refresh();

        // Mantener la fecha comprometida del hito aunque se retrasen sus dependencias.
        if ($successor->is_milestone) return false;

        if (! $successor->start_date || ! $successor->due_date) {
            return false;
        }

        $dependencies = $successor->successorDependencies()
            ->with('predecessor')
            ->get();
        $constraints = $dependencies
            ->filter(fn (CardDependency $dependency) =>
                $dependency->predecessor?->start_date && $dependency->predecessor?->due_date
            )
            ->map(function (CardDependency $dependency) use ($successor) {
                $predecessor = $dependency->predecessor;
                $duration = $successor->start_date->diffInDays($successor->due_date);

                return match ($dependency->type) {
                    'ss' => $predecessor->start_date,
                    'ff' => $predecessor->due_date->copy()->subDays($duration),
                    'sf' => $predecessor->start_date->copy()->subDays($duration),
                    default => $predecessor->due_date,
                };
            });

        if ($constraints->isEmpty()) {
            return false;
        }

        $previousStart = $successor->start_date->copy();
        $previousDue = $successor->due_date->copy();
        $duration = $successor->start_date->diffInDays($successor->due_date);
        $successor->start_date = $constraints->sort()->last();
        $successor->due_date = $successor->start_date->copy()->addDays($duration);
        if ($successor->start_date->equalTo($previousStart) && $successor->due_date->equalTo($previousDue)) {
            return false;
        }
        $startDelta = $previousStart->diffInDays($successor->start_date, false);
        $successor->save();

        if ($startDelta !== 0) {
            $successor->checklistItems()
                ->whereNotNull('due_date')
                ->get()
                ->each(function (CardChecklistItem $item) use ($startDelta): void {
                    $item->update([
                        'due_date' => $item->due_date->addDays($startDelta),
                    ]);
                });
        }

        return true;
    }

    public function propagate(Card $card): array
    {
        $affectedBoardIds = [];
        $edges = [];
        $pending = [$card->id];
        $descendantIds = [];

        while ($pending !== []) {
            $predecessorIds = array_splice($pending, 0);
            $dependencies = CardDependency::query()
                ->whereIn('predecessor_card_id', $predecessorIds)
                ->get(['predecessor_card_id', 'successor_card_id']);

            foreach ($dependencies as $dependency) {
                $edges[$dependency->predecessor_card_id][] = $dependency->successor_card_id;

                if (! isset($descendantIds[$dependency->successor_card_id])) {
                    $descendantIds[$dependency->successor_card_id] = true;
                    $pending[] = $dependency->successor_card_id;
                }
            }
        }

        if ($descendantIds === []) {
            return [];
        }

        $indegree = array_fill_keys(array_keys($descendantIds), 0);
        foreach ($edges as $predecessorId => $successorIds) {
            foreach ($successorIds as $successorId) {
                if (isset($indegree[$successorId]) && isset($descendantIds[$predecessorId])) {
                    $indegree[$successorId]++;
                }
            }
        }

        $ready = array_keys(array_filter($indegree, fn (int $degree): bool => $degree === 0));
        sort($ready);

        while ($ready !== []) {
            $currentId = array_shift($ready);
            $current = Card::find($currentId);

            if (! $current) {
                continue;
            }

            if ($this->recalculate($current)) {
                $affectedBoardIds[] = $current->board_id;
            }

            foreach ($edges[$currentId] ?? [] as $successorId) {
                $indegree[$successorId]--;

                if ($indegree[$successorId] === 0) {
                    $ready[] = $successorId;
                    sort($ready);
                }
            }
        }

        return array_values(array_unique($affectedBoardIds));
    }

    private function inferType(Card $predecessor, Card $successor): string
    {
        if ($predecessor->start_date->equalTo($successor->start_date)) return 'ss';
        if ($predecessor->due_date->equalTo($successor->due_date)) return 'ff';
        return 'fs';
    }

    private function validatePlanned(Card $predecessor, Card $successor): void
    {
        if ($predecessor->column->workflow_state === 'backlog' || $successor->column->workflow_state === 'backlog' || ! $predecessor->start_date || ! $predecessor->due_date || ! $successor->start_date || ! $successor->due_date) {
            throw ValidationException::withMessages(['successor_card_id' => 'Las dependencias requieren Cards planificadas fuera de backlog.']);
        }
    }

    private function reaches(Card $from, Card $target): bool
    {
        $pending = [$from->id];
        $visited = [];
        while ($id = array_shift($pending)) {
            if ($id === $target->id) return true;
            if (isset($visited[$id])) continue;
            $visited[$id] = true;
            $pending = array_merge($pending, CardDependency::where('predecessor_card_id', $id)->pluck('successor_card_id')->all());
        }
        return false;
    }
}
