<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Manufacturer;
use App\Models\Medicine;
use App\Models\MedicineType;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MedicineController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Medicine::with(['manufacturer:id,name,hospital_id', 'medicineType:id,name,hospital_id']);

        if ($user->role !== 'super_admin') {
            $scopedHospitalId = (int) ($user->hospital_id ?? 0);

            if ($request->filled('hospital_id')) {
                $requestedHospitalId = $request->integer('hospital_id');
                if ($requestedHospitalId > 0 && $this->canAccessRequestedHospital($user, $requestedHospitalId)) {
                    $scopedHospitalId = $requestedHospitalId;
                }
            }

            $query->where('hospital_id', $scopedHospitalId);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('manufacturer_id')) {
            $query->where('manufacturer_id', $request->integer('manufacturer_id'));
        }

        if ($request->filled('medicine_type_id')) {
            $query->where('medicine_type_id', $request->integer('medicine_type_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('brand_name', 'like', "%{$search}%")
                    ->orWhere('generic_name', 'like', "%{$search}%")
                    ->orWhere('strength', 'like', "%{$search}%");
            });
        }

        // The old hard cap of 200 silently truncated large catalogues. Pagination is
        // kept (the ['hospital_id','brand_name'] index makes it cheap and avoids a
        // filesort), and clients that need the full list page through it. The
        // remaining ceiling is only a memory guard against an absurd per_page.
        $perPage = max(1, min($request->integer('per_page', 25), 1000));

        return response()->json(
            $query->orderBy('brand_name')->orderBy('id')->paginate($perPage)
        );
    }

    public function store(Request $request)
    {
        $this->authorizeMedicineAction($request->user(), 'add_medicines');

        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $this->derivePackaging($data);
        $this->ensureHospitalConsistency($data);

        $data['created_by'] = $request->user()?->name;
        $data['updated_by'] = $request->user()?->name;

        $medicine = Medicine::create($data);

        return response()->json($medicine->load(['manufacturer', 'medicineType']), 201);
    }

    public function show(Request $request, Medicine $medicine)
    {
        $this->authorizeScope($request->user(), $medicine);

        return response()->json($medicine->load(['manufacturer', 'medicineType']));
    }

    public function update(Request $request, Medicine $medicine)
    {
        $this->authorizeMedicineAction($request->user(), 'edit_medicines');
        $this->authorizeScope($request->user(), $medicine);

        $data = $this->validatePayload($request, $medicine->hospital_id, $medicine);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $medicine->hospital_id;
        }

        $this->derivePackaging($data, $medicine);
        $this->ensureHospitalConsistency($data, $medicine);

        $data['updated_by'] = $request->user()?->name;

        $medicine->update($data);

        return response()->json($medicine->fresh()->load(['manufacturer', 'medicineType']));
    }

    public function destroy(Request $request, Medicine $medicine)
    {
        $this->authorizeMedicineAction($request->user(), 'delete_medicines');
        $this->authorizeScope($request->user(), $medicine);

        // Release the barcode so it can be re-used by another product. The unique
        // index spans soft-deleted rows, so leaving it in place would both lock the
        // code forever and make the "ignore deleted" validation rule inconsistent
        // with the database (a duplicate would pass validation, then 500).
        if ($medicine->barcode !== null) {
            $medicine->forceFill(['barcode' => null, 'barcode_type' => null])->save();
        }

        $medicine->delete();

        return response()->json(['message' => 'Medicine deleted']);
    }

    /**
     * Issue a unique system barcode for a medicine that has none printed.
     *
     * Format: 2 + 6-digit hospital + 6-digit medicine + check digit, which keeps
     * it numeric, Code128-friendly, and unique by construction. The uniqueness
     * index is still the authority; the retry loop covers manual collisions.
     */
    public function generateBarcode(Request $request, Medicine $medicine)
    {
        $this->authorizeMedicineAction($request->user(), 'edit_medicines');
        $this->authorizeScope($request->user(), $medicine);

        $barcode = null;
        for ($attempt = 0; $attempt < 20; $attempt++) {
            $candidate = $this->buildSystemBarcode($medicine, $attempt);
            $taken = Medicine::query()
                ->where('hospital_id', $medicine->hospital_id)
                ->where('barcode', $candidate)
                ->whereKeyNot($medicine->id)
                ->exists();
            if (!$taken) {
                $barcode = $candidate;
                break;
            }
        }

        if ($barcode === null) {
            abort(422, 'Could not allocate a unique barcode. Please try again.');
        }

        $medicine->barcode = $barcode;
        $medicine->barcode_type = 'system';
        $medicine->save();

        return response()->json($medicine->fresh()->load(['manufacturer', 'medicineType']));
    }

    private function buildSystemBarcode(Medicine $medicine, int $attempt): string
    {
        $base = '2'
            . str_pad((string) $medicine->hospital_id, 6, '0', STR_PAD_LEFT)
            . str_pad((string) (((int) $medicine->id) + $attempt * 1000000), 6, '0', STR_PAD_LEFT);

        // Simple mod-10 check digit so a mis-scan is very likely to be rejected.
        $sum = 0;
        foreach (str_split(strrev($base)) as $i => $digit) {
            $n = (int) $digit;
            $sum += ($i % 2 === 0) ? $n * 3 : $n;
        }

        return $base . ((10 - ($sum % 10)) % 10);
    }

    /**
     * Resolve a scanned barcode to a medicine within the caller's hospital.
     * Used by the pharmacy sale screen's scanner input.
     */
    public function findByBarcode(Request $request)
    {
        $user = $request->user();
        $code = trim((string) $request->query('barcode', ''));

        if ($code === '') {
            return response()->json(['message' => 'Barcode is required'], 422);
        }

        // A super admin may have no hospital of their own. When they do not name
        // one, search every hospital rather than filtering on a null id (which
        // would silently match nothing). Everyone else is pinned to their own.
        $hospitalId = $user->role === 'super_admin'
            ? ($request->integer('hospital_id') ?: $user->hospital_id)
            : $user->hospital_id;

        $query = Medicine::query()
            ->with(['manufacturer:id,name,hospital_id', 'medicineType:id,name,hospital_id'])
            ->where('barcode', $code);

        if ($hospitalId) {
            $query->where('hospital_id', $hospitalId);
        } elseif ($user->role !== 'super_admin') {
            return response()->json(['message' => 'No medicine found for this barcode'], 404);
        }

        $medicine = $query->first();

        if (!$medicine) {
            return response()->json(['message' => 'No medicine found for this barcode'], 404);
        }

        return response()->json($medicine);
    }

    private function validatePayload(Request $request, ?int $defaultHospitalId = null, ?Medicine $ignore = null): array
    {
        $hospitalId = $request->integer('hospital_id') ?: $defaultHospitalId ?: $request->user()->hospital_id;

        return $request->validate([
            'hospital_id' => [$request->user()->role === 'super_admin' ? 'required' : 'sometimes', 'exists:hospitals,id'],
            'manufacturer_id' => ['required', 'exists:manufacturers,id'],
            'medicine_type_id' => ['required', 'exists:medicine_types,id'],
            'brand_name' => ['required', 'string', 'max:255'],
            'generic_name' => ['nullable', 'string', 'max:255'],
            'strength' => ['nullable', 'string', 'max:255'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            // pack_size is the piece-per-pack conversion ratio. It must never be 0
            // or the pack<->piece conversion would divide the inventory by zero.
            // pack_size is DERIVED (pieces_per_strip * strips_per_pack) and is
            // recomputed below, so it is not accepted from the client.
            'pieces_per_strip' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'strips_per_pack' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'strip_price' => ['nullable', 'numeric', 'min:0'],
            'strip_label' => ['nullable', 'string', 'max:50'],
            'sellable_units' => ['nullable', 'array'],
            'sellable_units.*' => [Rule::in(['piece', 'strip', 'pack'])],
            'default_sale_unit' => ['nullable', Rule::in(['piece', 'strip', 'pack'])],
            'pack_price' => ['nullable', 'numeric', 'min:0'],
            'pack_label' => ['nullable', 'string', 'max:50'],
            // A barcode is optional, but within a hospital it must resolve to a
            // single product or a scan at the counter would be ambiguous.
            'barcode' => [
                'nullable',
                'string',
                'max:191',
                // 2D codes carry URLs and GS1 element strings, so anything printable
                // is allowed; only control characters and whitespace are rejected.
                'regex:/^[!-~]+$/',
                Rule::unique('medicines', 'barcode')
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId)->whereNull('deleted_at'))
                    ->ignore($ignore?->id),
            ],
            'barcode_type' => ['nullable', Rule::in(['manual', 'manufacturer', 'system'])],
            'status' => ['required', 'in:active,inactive'],
        ]);
    }

    /**
     * pack_size is always the product of the two configured tiers, so the three
     * numbers can never drift apart. Also drops sellable units that the product's
     * packaging does not actually have (a syrup cannot be sold "per strip").
     */
    private function derivePackaging(array &$data, ?Medicine $existing = null): void
    {
        $perStrip = (int) ($data['pieces_per_strip'] ?? $existing?->pieces_per_strip ?? 1);
        $stripsPerPack = (int) ($data['strips_per_pack'] ?? $existing?->strips_per_pack ?? 1);
        $perStrip = max(1, $perStrip);
        $stripsPerPack = max(1, $stripsPerPack);

        $data['pieces_per_strip'] = $perStrip;
        $data['strips_per_pack'] = $stripsPerPack;
        $data['pack_size'] = $perStrip * $stripsPerPack;

        // Pack is always sellable: a pack of one simply IS the item (one bottle,
        // one tube), and it is how most pharmacies quote a price. Strip only
        // exists when the packaging genuinely has a middle tier.
        $available = ['piece', 'pack'];
        if ($perStrip > 1) {
            $available[] = 'strip';
        }

        $requested = $data['sellable_units'] ?? $existing?->sellable_units ?? ['piece'];
        $units = array_values(array_intersect((array) $requested, $available));
        if (empty($units)) {
            $units = ['piece'];
        }
        $data['sellable_units'] = $units;

        $default = $data['default_sale_unit'] ?? $existing?->default_sale_unit ?? 'piece';
        $data['default_sale_unit'] = in_array($default, $units, true) ? $default : $units[0];
    }

    private function ensureHospitalConsistency(array &$data, ?Medicine $existing = null): void
    {
        $manufacturer = Manufacturer::findOrFail($data['manufacturer_id']);
        $medicineType = MedicineType::findOrFail($data['medicine_type_id']);

        $hospitalId = $data['hospital_id'] ?? $existing?->hospital_id ?? $manufacturer->hospital_id;

        if ((int) $manufacturer->hospital_id !== (int) $hospitalId) {
            abort(422, 'Manufacturer does not belong to the selected hospital');
        }

        if ((int) $medicineType->hospital_id !== (int) $hospitalId) {
            abort(422, 'Medicine type does not belong to the selected hospital');
        }

        $data['hospital_id'] = $hospitalId;
    }

    private function authorizeMedicineAction($user, string $permission): void
    {
        $this->ensureAnyPermission(
            $user,
            [$permission, 'manage_medicines'],
            'Only users with medicine permissions can manage medicines'
        );
    }

    private function authorizeScope($user, Medicine $medicine): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $medicine->hospital_id) {
            abort(403, 'Unauthorized medicine access');
        }
    }

    private function canAccessRequestedHospital($user, int $requestedHospitalId): bool
    {
        if ((int) ($user->hospital_id ?? 0) === $requestedHospitalId) {
            return true;
        }

        if ($user->role !== 'doctor') {
            return false;
        }

        return Appointment::query()
            ->where('doctor_id', $user->id)
            ->where('hospital_id', $requestedHospitalId)
            ->exists();
    }
}
