<?php

namespace App\Http\Controllers\Api;

use App\Models\Card;
use App\Models\CardDependency;
use App\Models\Board;
use App\Support\CardDependencyService;
use App\Support\MilestoneCompletionService;
use App\Support\ProjectAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CardDependenciesController extends ApiController
{
    public function store(Request $request, Card $card, CardDependencyService $service, MilestoneCompletionService $milestones)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $card->board->project), 403);
        $data = $request->validate(['successor_card_id' => ['required', 'integer'], 'type' => ['sometimes', Rule::in(CardDependencyService::TYPES)]]);
        $successor = Card::whereHas('board', function ($query) use ($card): void {
            $query->where('project_id', $card->board->project_id);
        })->findOrFail($data['successor_card_id']);
        $dependency = DB::transaction(fn () => $service->create($card, $successor));
        $affectedBoardIds = [$card->board_id, $successor->board_id];
        if (isset($data['type']) && $data['type'] !== $dependency->type) {
            $affectedBoardIds = array_merge(
                $affectedBoardIds,
                DB::transaction(fn () => $service->updateType($dependency, $data['type']))
            );
        }
        $this->touchBoards($affectedBoardIds);
        $milestones->evaluate($successor, $request->user()->id);
        return response()->json($this->payload($dependency->fresh(['predecessor', 'successor'])), 201);
    }

    public function update(Request $request, CardDependency $dependency, CardDependencyService $service)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $dependency->predecessor->board->project), 403);
        $data = $request->validate(['type' => ['required', Rule::in(CardDependencyService::TYPES)]]);
        $affectedBoardIds = [
            $dependency->predecessor->board_id,
            $dependency->successor->board_id,
        ];
        $affectedBoardIds = array_merge(
            $affectedBoardIds,
            DB::transaction(fn () => $service->updateType($dependency, $data['type']))
        );
        $this->touchBoards($affectedBoardIds);
        return response()->json($this->payload($dependency->fresh(['predecessor', 'successor'])));
    }

    public function destroy(Request $request, CardDependency $dependency, MilestoneCompletionService $milestones)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $dependency->predecessor->board->project), 403);
        $successor = $dependency->successor;
        $boardIds = [
            $dependency->predecessor->board_id,
            $successor->board_id,
        ];
        $dependency->delete();
        $this->touchBoards($boardIds);
        $milestones->evaluate($successor, $request->user()->id);
        return response()->noContent();
    }

    private function payload(CardDependency $dependency): array
    {
        return [
            'id' => $dependency->id,
            'predecessor_card_id' => $dependency->predecessor_card_id,
            'successor_card_id' => $dependency->successor_card_id,
            'type' => $dependency->type,
        ];
    }

    private function touchBoards(array $boardIds): void
    {
        Board::whereIn('id', array_values(array_unique($boardIds)))
            ->get()
            ->each(fn (Board $board) => $board->touchRevision());
    }
}
