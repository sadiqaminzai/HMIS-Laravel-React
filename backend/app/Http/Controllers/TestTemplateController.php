<?php

namespace App\Http\Controllers;

use App\Models\TestTemplate;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class TestTemplateController extends Controller
{
    public function index(Request $request)
    {
        $query = TestTemplate::query()->with('parameters');

        if ($request->has('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('test_name', 'like', "%{$search}%")
                  ->orWhere('test_code', 'like', "%{$search}%")
                  ->orWhere('test_type', 'like', "%{$search}%");
            });
        }

        $templates = $query->orderByDesc('id')->paginate($request->integer('per_page', 25));

        return response()->json($templates);
    }

    public function store(Request $request)
    {
        $data = $this->validateRequest($request);
        $parameters = $data['parameters'] ?? [];
        unset($data['parameters']);

        if (empty($data['test_code'])) {
            $data['test_code'] = null;
        }

        $template = DB::transaction(function () use ($data, $parameters, $request) {
            $template = TestTemplate::create([
                ...$data,
                'created_by' => $request->user()?->name,
            ]);

            $this->syncParameters($template, $parameters);

            return $template;
        });

        return response()->json(['data' => $template->load('parameters')], Response::HTTP_CREATED);
    }

    public function show(TestTemplate $testTemplate)
    {
        return response()->json(['data' => $testTemplate->load('parameters')]);
    }

    public function update(Request $request, TestTemplate $testTemplate)
    {
        $data = $this->validateRequest($request, $testTemplate->id);
        $parameters = $data['parameters'] ?? [];
        unset($data['parameters']);

        DB::transaction(function () use ($testTemplate, $data, $parameters, $request) {
            $testTemplate->fill($data);
            $testTemplate->updated_by = $request->user()?->name;
            $testTemplate->save();

            $this->syncParameters($testTemplate, $parameters, true);
        });

        return response()->json(['data' => $testTemplate->load('parameters')]);
    }

    public function destroy(TestTemplate $testTemplate)
    {
        $testTemplate->delete();
        return response()->json(['message' => 'Deleted']);
    }

    private function validateRequest(Request $request, ?int $id = null): array
    {
        $hospitalId = $request->input('hospital_id');
        $input = $request->all();
        $input['parameters'] = $this->normalizeParameters($input['parameters'] ?? []);

        $testCodeRule = $id === null
            ? ['nullable', 'string', 'max:100']
            : ['required', 'string', 'max:100'];

        $validator = Validator::make($input, [
            'hospital_id' => ['required', 'exists:hospitals,id'],
            'test_code' => [
                ...$testCodeRule,
                Rule::unique('test_templates', 'test_code')
                    ->ignore($id)
                    ->where(fn ($q) => $hospitalId ? $q->where('hospital_id', $hospitalId) : $q),
            ],
            'test_name' => ['required', 'string', 'max:255'],
            'test_type' => ['required', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'sample_type' => ['required', 'string', 'max:100'],
            'parameters' => ['nullable', 'array'],
            'parameters.*.name' => ['required_with:parameters', 'string', 'max:255'],
            'parameters.*.unit' => ['nullable', 'string', 'max:50'],
            'parameters.*.normal_range' => ['nullable', 'string', 'max:255'],
            'parameters.*.description' => ['nullable', 'string'],
            'parameters.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'duration' => ['nullable', 'string', 'max:100'],
            'instructions' => ['nullable', 'string'],
            'status' => ['required', 'in:active,inactive'],
        ]);

        return $validator->validate();
    }

    private function normalizeParameters(array $parameters): array
    {
        return collect($parameters)
            ->map(function ($parameter, $index) {
                return [
                    'name' => $parameter['name'] ?? $parameter['parameterName'] ?? null,
                    'unit' => $parameter['unit'] ?? null,
                    'normal_range' => $parameter['normal_range'] ?? $parameter['normalRange'] ?? null,
                    'description' => $parameter['description'] ?? null,
                    'sort_order' => $parameter['sort_order'] ?? $parameter['order'] ?? $index,
                ];
            })
            ->filter(fn ($parameter) => $parameter['name'])
            ->values()
            ->all();
    }

    private function syncParameters(TestTemplate $template, array $parameters, bool $replace = false): void
    {
        if ($replace) {
            $template->parameters()->delete();
        }

        if (empty($parameters)) {
            return;
        }

        $payload = array_map(function ($parameter) {
            return [
                'name' => $parameter['name'],
                'unit' => $parameter['unit'] ?? null,
                'normal_range' => $parameter['normal_range'] ?? null,
                'description' => $parameter['description'] ?? null,
                'sort_order' => $parameter['sort_order'] ?? 0,
            ];
        }, $parameters);

        $template->parameters()->createMany($payload);
    }
}
