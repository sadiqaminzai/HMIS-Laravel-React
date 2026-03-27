<?php

namespace App\Http\Controllers;

use App\Models\Room;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RoomController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Room::query()->where('is_delete', false);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('id_from')) {
            $query->where('id', '>=', $request->integer('id_from'));
        }

        if ($request->filled('id_to')) {
            $query->where('id', '<=', $request->integer('id_to'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where('room_number', 'like', "%{$search}%");
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        return response()->json($query->orderByDesc('id')->paginate($request->integer('per_page', 25)));
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);
        $data['created_by'] = $request->user()?->name;

        $room = Room::create($data);

        return response()->json($room, 201);
    }

    public function show(Request $request, Room $room)
    {
        $this->authorizeScope($request->user(), $room->hospital_id);

        return response()->json($room);
    }

    public function update(Request $request, Room $room)
    {
        $this->authorizeScope($request->user(), $room->hospital_id);

        $data = $this->validatePayload($request, $room->id, $room->hospital_id);
        $data['updated_by'] = $request->user()?->name;

        $room->update($data);

        return response()->json($room->fresh());
    }

    public function destroy(Request $request, Room $room)
    {
        $this->authorizeScope($request->user(), $room->hospital_id);

        $room->update([
            'is_delete' => true,
            'is_active' => false,
            'deleted_by' => $request->user()?->name,
        ]);

        return response()->json(['message' => 'Room deleted']);
    }

    private function validatePayload(Request $request, ?int $roomId = null, ?int $existingHospitalId = null): array
    {
        $hospitalId = $request->user()->role === 'super_admin'
            ? ($request->integer('hospital_id') ?: $existingHospitalId)
            : $request->user()->hospital_id;

        $data = $request->validate([
            'hospital_id' => [
                $request->user()->role === 'super_admin' ? 'required' : 'nullable',
                'exists:hospitals,id',
            ],
            'room_number' => [
                'required',
                'string',
                'max:100',
                Rule::unique('rooms', 'room_number')
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId)->where('is_delete', false))
                    ->ignore($roomId),
            ],
            'type' => ['required', 'in:General,Private,Semi-Private,ICU,Emergency'],
            'total_beds' => ['required', 'integer', 'min:1'],
            'available_beds' => ['required', 'integer', 'min:0'],
            'cost_per_bed' => ['required', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if ((int) $data['available_beds'] > (int) $data['total_beds']) {
            abort(422, 'available_beds cannot exceed total_beds');
        }

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        } elseif (!isset($data['hospital_id'])) {
            $data['hospital_id'] = $hospitalId;
        }

        return $data;
    }

    private function authorizeScope($user, int $hospitalId): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $hospitalId) {
            abort(403, 'Unauthorized access');
        }
    }
}
