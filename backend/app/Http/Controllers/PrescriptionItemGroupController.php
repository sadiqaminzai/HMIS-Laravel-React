<?php

namespace App\Http\Controllers;

use App\Models\Prescription;
use App\Models\PrescriptionItemGroupLink;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PrescriptionItemGroupController extends Controller
{
    public function show(Request $request, Prescription $prescription)
    {
        $this->authorizeScope($request->user(), $prescription);

        return response()->json(
            PrescriptionItemGroupLink::query()
                ->where('prescription_id', $prescription->id)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
        );
    }

    public function sync(Request $request, Prescription $prescription)
    {
        $this->authorizeScope($request->user(), $prescription);
        $this->ensureAnyPermission($request->user(), ['add_prescriptions', 'edit_prescriptions', 'create_prescription', 'manage_prescriptions'], 'Unauthorized to sync medicine grouping');

        $validated = $request->validate([
            'groups' => ['required', 'array'],
            'groups.*.prescription_item_id' => ['required', 'integer', 'exists:prescription_items,id'],
            'groups.*.group_key' => ['required', 'string', 'max:64'],
            'groups.*.group_label' => ['nullable', 'string', 'max:255'],
            'groups.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $groups = collect($validated['groups'] ?? []);

        $itemIds = $prescription->items()->pluck('id')->map(fn ($id) => (int) $id)->all();
        $itemIdLookup = array_fill_keys($itemIds, true);

        foreach ($groups as $group) {
            $itemId = (int) $group['prescription_item_id'];
            if (!isset($itemIdLookup[$itemId])) {
                abort(422, 'One or more prescription items do not belong to this prescription');
            }
        }

        DB::transaction(function () use ($prescription, $groups, $request) {
            $targetItemIds = $groups->pluck('prescription_item_id')->map(fn ($id) => (int) $id)->all();

            PrescriptionItemGroupLink::query()
                ->where('prescription_id', $prescription->id)
                ->when(!empty($targetItemIds), fn ($q) => $q->whereNotIn('prescription_item_id', $targetItemIds), fn ($q) => $q)
                ->delete();

            foreach ($groups as $group) {
                PrescriptionItemGroupLink::updateOrCreate(
                    ['prescription_item_id' => (int) $group['prescription_item_id']],
                    [
                        'prescription_id' => $prescription->id,
                        'group_key' => $group['group_key'],
                        'group_label' => $group['group_label'] ?? null,
                        'sort_order' => (int) ($group['sort_order'] ?? 0),
                        'created_by' => $request->user()?->name,
                    ]
                );
            }
        });

        return response()->json(
            $prescription->fresh()->load('items.groupLink')
        );
    }

    private function authorizeScope($user, Prescription $prescription): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $prescription->hospital_id) {
            abort(403, 'Unauthorized prescription access');
        }
    }
}
