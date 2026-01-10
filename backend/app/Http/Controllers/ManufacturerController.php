<?php

namespace App\Http\Controllers;

use App\Models\Manufacturer;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ManufacturerController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Manufacturer::query();

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('license_number', 'like', "%{$search}%")
                    ->orWhere('country', 'like', "%{$search}%");
            });
        }

        return response()->json(
            $query->orderBy('name')->get()
        );
    }

    public function store(Request $request)
    {
        $this->authorizePharmacy($request->user());

        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $manufacturer = Manufacturer::create($data);

        return response()->json($manufacturer, 201);
    }

    public function show(Request $request, Manufacturer $manufacturer)
    {
        $this->authorizeScope($request->user(), $manufacturer);

        return response()->json($manufacturer);
    }

    public function update(Request $request, Manufacturer $manufacturer)
    {
        $this->authorizePharmacy($request->user());
        $this->authorizeScope($request->user(), $manufacturer);

        $data = $this->validatePayload($request, $manufacturer->id, $manufacturer->hospital_id);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $manufacturer->hospital_id;
        }

        $manufacturer->update($data);

        return response()->json($manufacturer->fresh());
    }

    public function destroy(Request $request, Manufacturer $manufacturer)
    {
        $this->authorizePharmacy($request->user());
        $this->authorizeScope($request->user(), $manufacturer);

        $manufacturer->delete();

        return response()->json(['message' => 'Manufacturer deleted']);
    }

    private function validatePayload(Request $request, ?int $manufacturerId = null, ?int $defaultHospitalId = null): array
    {
        $hospitalId = $request->integer('hospital_id') ?: $defaultHospitalId ?: $request->user()->hospital_id;

        return $request->validate([
            'hospital_id' => [$request->user()->role === 'super_admin' ? 'required' : 'sometimes', 'exists:hospitals,id'],
            'name' => ['required', 'string', 'max:255'],
            'license_number' => [
                'required',
                'string',
                'max:255',
                Rule::unique('manufacturers', 'license_number')
                    ->ignore($manufacturerId)
                    ->where(fn ($q) => $hospitalId ? $q->where('hospital_id', $hospitalId) : $q),
            ],
            'country' => ['nullable', 'string', 'max:255'],
            'status' => ['required', 'in:active,inactive'],
        ]);
    }

    private function authorizePharmacy($user): void
    {
        if (!in_array($user->role, ['admin', 'super_admin', 'pharmacist'])) {
            abort(403, 'Only admins, pharmacists, or super admins can manage manufacturers');
        }
    }

    private function authorizeScope($user, Manufacturer $manufacturer): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $manufacturer->hospital_id) {
            abort(403, 'Unauthorized manufacturer access');
        }
    }
}
