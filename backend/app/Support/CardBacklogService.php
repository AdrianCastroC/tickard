<?php

namespace App\Support;

use App\Models\Board;
use App\Models\Card;
use App\Models\CardDependency;
use App\Models\Column;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class CardBacklogService
{
    public function hasDependencies(Card $card): bool
    {
        return CardDependency::where('predecessor_card_id', $card->id)
            ->orWhere('successor_card_id', $card->id)
            ->exists();
    }

    public function preview(Card $root, Column $target): array
    {
        $flow = $this->flow($root);
        $flowIds = $flow->pluck('id')->all();
        $dependencies = CardDependency::query()
            ->where(function ($query) use ($flowIds) {
                $query->whereIn('predecessor_card_id', $flowIds)
                    ->orWhereIn('successor_card_id', $flowIds);
            })
            ->with(['predecessor.board', 'predecessor.column', 'successor.board', 'successor.column'])
            ->get();

        $boards = $flow->groupBy('board_id')->map(function (Collection $cards, $boardId) use ($root, $target): array {
            $board = $cards->first()->board;
            $backlogs = $board->columns()->where('workflow_state', 'backlog')->orderBy('position')->orderBy('id')->get();
            $default = $board->id === $root->board_id ? $target : $backlogs->first();

            return [
                'id' => $board->id,
                'name' => $board->name,
                'default_backlog_id' => $default?->id,
                'backlogs' => $backlogs->map(fn (Column $column) => [
                    'id' => $column->id,
                    'name' => $column->name,
                    'position' => $column->position,
                ])->values()->all(),
            ];
        })->values();

        return [
            'root_card_id' => $root->id,
            'target_backlog' => ['id' => $target->id, 'board_id' => $target->board_id, 'name' => $target->name],
            'cards' => $flow->map(fn (Card $card) => [
                'id' => $card->id,
                'title' => $card->title,
                'board_id' => $card->board_id,
                'board_name' => $card->board->name,
                'column_id' => $card->column_id,
                'column_name' => $card->column->name,
                'is_root' => $card->id === $root->id,
            ])->values()->all(),
            'dependencies' => $dependencies->map(fn (CardDependency $dependency) => $this->dependencyPayload($dependency, $flowIds))->values()->all(),
            'boards' => $boards->all(),
            'summary' => [
                'cards' => $flow->count(),
                'flow_dependencies' => $dependencies->filter(fn (CardDependency $dependency) => in_array($dependency->predecessor_card_id, $flowIds, true) && in_array($dependency->successor_card_id, $flowIds, true))->count(),
                'external_dependencies' => $dependencies->filter(fn (CardDependency $dependency) => ! in_array($dependency->predecessor_card_id, $flowIds, true) || ! in_array($dependency->successor_card_id, $flowIds, true))->count(),
                'boards' => $boards->count(),
            ],
        ];
    }

    public function execute(Card $root, Column $target, array $resolution, int $userId, int $position): void
    {
        DB::transaction(function () use ($root, $target, $resolution, $userId, $position): void {
            $flow = $this->flow($root);
            $flowIds = $flow->pluck('id')->all();
            $selectedIds = array_values(array_unique(array_map('intval', $resolution['selected_card_ids'] ?? [])));

            if (! in_array($root->id, $selectedIds, true) || array_diff($selectedIds, $flowIds) !== []) {
                throw ValidationException::withMessages(['backlog_resolution' => 'La selección no pertenece al flujo actual o no incluye la Card raíz.']);
            }

            $destinations = collect($resolution['destinations'] ?? [])->keyBy('board_id');
            $boardIds = $flow->pluck('board_id')->unique();
            $selectedBoardIds = $flow->whereIn('id', $selectedIds)->pluck('board_id')->unique();
            if ($destinations->keys()->diff($selectedBoardIds->map(fn ($id) => (string) $id))->isNotEmpty()) {
                throw ValidationException::withMessages(['backlog_resolution' => 'Cada destino debe corresponder a un Board con Cards seleccionadas.']);
            }
            $columns = collect();
            foreach ($boardIds as $boardId) {
                $columnId = $boardId === $root->board_id ? $target->id : ($destinations->get($boardId)['column_id'] ?? $this->firstBacklog($boardId)->id);
                $column = Column::where('board_id', $boardId)->whereKey($columnId)->where('workflow_state', 'backlog')->first();
                if (! $column) {
                    throw ValidationException::withMessages(['backlog_resolution' => 'El destino debe ser un Backlog del Board correspondiente.']);
                }
                $columns[$boardId] = $column;
            }

            $selected = Card::whereIn('id', $selectedIds)->get();
            $touchedBoards = $selected->pluck('board_id')->merge(
                CardDependency::where(function ($query) use ($selectedIds) {
                    $query->whereIn('predecessor_card_id', $selectedIds)->orWhereIn('successor_card_id', $selectedIds);
                })->get()->flatMap(fn (CardDependency $dependency) => [$dependency->predecessor->board_id, $dependency->successor->board_id])
            );
            CardDependency::where(function ($query) use ($selectedIds) {
                $query->whereIn('predecessor_card_id', $selectedIds)->orWhereIn('successor_card_id', $selectedIds);
            })->delete();

            foreach ($selected as $card) {
                $column = $columns[$card->board_id];
                $card->update(['column_id' => $column->id, 'position' => $card->id === $root->id ? $position : $column->cards()->max('position') + 1, 'start_date' => null, 'due_date' => null, 'completed_at' => null]);
                $card->activities()->create(['user_id' => $userId, 'type' => 'moved', 'meta' => ['column' => $column->name]]);
            }

            foreach ($touchedBoards->unique() as $boardId) {
                Board::find($boardId)?->touchRevision();
            }
        });
    }

    private function flow(Card $root): Collection
    {
        $cards = collect([$root->load(['board', 'column'])]);
        $pending = [$root->id];
        while ($pending !== []) {
            $dependencies = CardDependency::whereIn('predecessor_card_id', $pending)->get();
            $pending = [];
            foreach ($dependencies as $dependency) {
                if (! $cards->contains('id', $dependency->successor_card_id)) {
                    $cards->push(Card::with(['board', 'column'])->findOrFail($dependency->successor_card_id));
                    $pending[] = $dependency->successor_card_id;
                }
            }
        }
        return $cards;
    }

    private function firstBacklog(int $boardId): Column
    {
        return Column::where('board_id', $boardId)->where('workflow_state', 'backlog')->orderBy('position')->orderBy('id')->firstOrFail();
    }

    private function dependencyPayload(CardDependency $dependency, array $flowIds): array
    {
        return [
            'id' => $dependency->id,
            'type' => $dependency->type,
            'scope' => in_array($dependency->predecessor_card_id, $flowIds, true) && in_array($dependency->successor_card_id, $flowIds, true) ? 'flow' : 'external',
            'predecessor' => ['id' => $dependency->predecessor->id, 'title' => $dependency->predecessor->title, 'board_id' => $dependency->predecessor->board_id, 'board_name' => $dependency->predecessor->board->name],
            'successor' => ['id' => $dependency->successor->id, 'title' => $dependency->successor->title, 'board_id' => $dependency->successor->board_id, 'board_name' => $dependency->successor->board->name],
        ];
    }
}
