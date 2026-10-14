<?php

namespace App\Http\Controllers\Api;

use App\Models\CalendarEvent;
use App\Models\Project;
use App\Support\ProjectAccess;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CalendarEventsController extends ApiController
{
    public function index(Request $request, Project $project)
    {
        $this->authorizeReading($request, $project);

        $dates = $request->validate([
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        ]);

        if (CarbonImmutable::parse($dates['start_date'])->diffInDays(CarbonImmutable::parse($dates['end_date'])) > 62) {
            throw ValidationException::withMessages(['end_date' => 'El intervalo máximo es de 63 días.']);
        }

        return $project->calendarEvents()
            ->whereDate('start_date', '<=', $dates['end_date'])
            ->whereDate('end_date', '>=', $dates['start_date'])
            ->orderBy('start_date')
            ->orderBy('start_time')
            ->get()
            ->map(fn (CalendarEvent $event) => $this->present($event));
    }

    public function store(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $project), 403);

        $data = $this->eventData($request);
        $event = $project->calendarEvents()->create([
            ...$data,
            'created_by' => $request->user()->id,
        ]);

        return response()->json($this->present($event), 201);
    }

    public function update(Request $request, CalendarEvent $calendarEvent)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $calendarEvent->project), 403);
        $calendarEvent->update($this->eventData($request));

        return $this->present($calendarEvent->fresh());
    }

    public function destroy(Request $request, CalendarEvent $calendarEvent)
    {
        abort_unless(ProjectAccess::canEditCards($request->user(), $calendarEvent->project), 403);
        $calendarEvent->delete();

        return response()->noContent();
    }

    private function authorizeReading(Request $request, Project $project): void
    {
        $role = ProjectAccess::role($request->user(), $project);
        // Calendar events are currently internal to project members: do not expose
        // meetings, descriptions or locations to external clients.
        abort_unless($role !== null && $role !== 'cliente', 403);
    }

    private function eventData(Request $request): array
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(['meeting', 'appointment', 'other'])],
            'title' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:4000'],
            'location' => ['nullable', 'string', 'max:160'],
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'all_day' => ['required', 'boolean'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i'],
        ]);

        if ($data['all_day']) {
            $data['start_time'] = null;
            $data['end_time'] = null;
        } else {
            if (empty($data['start_time']) || empty($data['end_time'])) {
                throw ValidationException::withMessages([
                    'start_time' => 'Los eventos con horario necesitan hora de inicio y fin.',
                ]);
            }
            if ($data['start_date'] === $data['end_date'] && $data['end_time'] <= $data['start_time']) {
                throw ValidationException::withMessages([
                    'end_time' => 'La hora de fin debe ser posterior a la de inicio.',
                ]);
            }
        }

        return $data;
    }

    private function present(CalendarEvent $event): array
    {
        return [
            'id' => $event->id,
            'project_id' => $event->project_id,
            'created_by' => $event->created_by,
            'kind' => $event->kind,
            'title' => $event->title,
            'description' => $event->description,
            'location' => $event->location,
            'start_date' => $event->start_date->toDateString(),
            'end_date' => $event->end_date->toDateString(),
            'all_day' => $event->all_day,
            'start_time' => $event->start_time ? substr($event->start_time, 0, 5) : null,
            'end_time' => $event->end_time ? substr($event->end_time, 0, 5) : null,
        ];
    }
}
