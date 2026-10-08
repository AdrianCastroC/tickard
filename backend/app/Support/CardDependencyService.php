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

    public function updateType(CardDependency $dependency, string $type): void
    {
        if (! in_array($type, self::TYPES, true)) {
            throw ValidationException::withMessages(['type' => 'Tipo de dependencia no válido.']);
        }
        $dependency->update(['type' => $type]);
        $this->apply($dependency->fresh(['predecessor', 'successor']));
        $this->propagate($dependency->successor);
    }

    public function apply(CardDependency $dependency): void
    {
        $predecessor = $dependency->predecessor;
        $successor = $dependency->successor;
        if (! $predecessor->start_date || ! $predecessor->due_date || ! $successor->start_date || ! $successor->due_date) {
            return;
        }
        $previousStart = $successor->start_date->copy();
        $duration = $successor->start_date->diffInDays($successor->due_date);
        if ($dependency->type === 'ff') {
            $successor->due_date = $predecessor->due_date;
            $successor->start_date = $successor->due_date->copy()->subDays($duration);
        } elseif ($dependency->type === 'sf') {
            $successor->due_date = $predecessor->start_date;
            $successor->start_date = $successor->due_date->copy()->subDays($duration);
        } else {
            $successor->start_date = $dependency->type === 'ss' ? $predecessor->start_date : $predecessor->due_date;
            $successor->due_date = $successor->start_date->copy()->addDays($duration);
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
    }

    public function propagate(Card $card): void
    {
        $queue = [$card];
        $visited = [];
        while ($current = array_shift($queue)) {
            if (isset($visited[$current->id])) continue;
            $visited[$current->id] = true;
            foreach ($current->predecessorDependencies()->with(['predecessor', 'successor'])->get() as $dependency) {
                $this->apply($dependency);
                $queue[] = $dependency->successor;
            }
        }
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
