<?php

namespace App\Http\Controllers;

use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SupplierController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Supplier::query();

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('contact_info', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%");
            });
        }

        return response()->json($query->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $this->authorizePharmacy($request->user());

        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $supplier = Supplier::create($data);

        return response()->json($supplier, 201);
    }

    public function show(Request $request, Supplier $supplier)
    {
        $this->authorizeScope($request->user(), $supplier);

        return response()->json($supplier);
    }

    public function update(Request $request, Supplier $supplier)
    {
        $this->authorizePharmacy($request->user());
        $this->authorizeScope($request->user(), $supplier);

        $data = $this->validatePayload($request, $supplier->id, $supplier->hospital_id);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $supplier->hospital_id;
        }

        $supplier->update($data);

        return response()->json($supplier->fresh());
    }

    public function destroy(Request $request, Supplier $supplier)
    {
        $this->authorizePharmacy($request->user());
        $this->authorizeScope($request->user(), $supplier);

        $supplier->delete();

        return response()->json(['message' => 'Supplier deleted']);
    }

    private function validatePayload(Request $request, ?int $supplierId = null, ?int $defaultHospitalId = null): array
    {
        $hospitalId = $request->integer('hospital_id') ?: $defaultHospitalId ?: $request->user()->hospital_id;

        return $request->validate([
            'hospital_id' => [$request->user()->role === 'super_admin' ? 'required' : 'sometimes', 'exists:hospitals,id'],
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('suppliers', 'name')
                    ->ignore($supplierId)
                    ->where(fn ($q) => $hospitalId ? $q->where('hospital_id', $hospitalId) : $q),
            ],
            'contact_info' => ['nullable', 'string'],
            'address' => ['nullable', 'string'],
        ]);
    }

    private function authorizePharmacy($user): void
    {
        if (!in_array($user->role, ['admin', 'super_admin', 'pharmacist'])) {
            abort(403, 'Only admins, pharmacists, or super admins can manage suppliers');
        }
    }

    private function authorizeScope($user, Supplier $supplier): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $supplier->hospital_id) {
            abort(403, 'Unauthorized supplier access');
        }
    }
}
