<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PermissionController extends Controller
{
    public function index(Request $request)
    {
        $query = Permission::query();

        if ($request->filled('category')) {
            $query->where('category', $request->string('category'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('display_name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $query->orderBy('category')->orderBy('name');

        if ($request->boolean('all')) {
            return response()->json($query->get());
        }

        $perPage = (int) $request->input('per_page', 100);
        $perPage = max(1, min($perPage, 1000));

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request)
    {
        $this->authorizePermissionAction($request->user(), ['add_permissions', 'manage_permissions']);

        $guardName = 'web';

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('permissions', 'name')->where('guard_name', $guardName)],
            'display_name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'is_system' => ['boolean'],
        ]);

        $data['guard_name'] = $guardName;

        $permission = Permission::create($data);

        return response()->json($permission, 201);
    }

    public function show(Permission $permission)
    {
        return response()->json($permission);
    }

    public function update(Request $request, Permission $permission)
    {
        $this->authorizePermissionAction($request->user(), ['edit_permissions', 'manage_permissions']);

        $data = $request->validate([
            'display_name' => ['sometimes', 'string', 'max:255'],
            'category' => ['sometimes', 'string', 'nullable', 'max:255'],
            'description' => ['sometimes', 'string', 'nullable'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
        ]);

        $permission->update($data);

        return response()->json($permission->fresh());
    }

    public function destroy(Request $request, Permission $permission)
    {
        $this->authorizePermissionAction($request->user(), ['delete_permissions', 'manage_permissions']);

        $permission->roles()->detach();
        $permission->delete();

        return response()->json(['message' => 'Permission deleted']);
    }

    public function import(Request $request)
    {
        $this->authorizePermissionAction($request->user(), ['import_permissions', 'manage_permissions']);

        $rows = [];

        if ($request->hasFile('file')) {
            $request->validate([
                'file' => ['required', 'file', 'mimes:xlsx,csv,txt'],
            ]);

            $rows = $this->extractRowsFromFile(
                $request->file('file')->getRealPath(),
                strtolower((string) $request->file('file')->getClientOriginalExtension())
            );
        } else {
            $data = $request->validate([
                'permissions' => ['required', 'array', 'min:1'],
                'permissions.*.name' => ['required', 'string', 'max:255'],
                'permissions.*.display_name' => ['required', 'string', 'max:255'],
                'permissions.*.category' => ['nullable', 'string', 'max:255'],
                'permissions.*.description' => ['nullable', 'string'],
                'permissions.*.status' => ['nullable', Rule::in(['active', 'inactive'])],
                'permissions.*.is_system' => ['nullable', 'boolean'],
            ]);

            $rows = $data['permissions'];
        }

        if (empty($rows)) {
            return response()->json([
                'message' => 'No valid permission rows found in uploaded file. Ensure headers include name and display_name.',
            ], 422);
        }

        [$created, $updated, $skipped, $invalid] = $this->importRows($rows);

        if ($created === 0 && $updated === 0 && $skipped === 0 && $invalid > 0) {
            return response()->json([
                'message' => 'Import file rows are invalid. Ensure columns include name and display_name (or Display Name).',
                'invalid' => $invalid,
            ], 422);
        }

        return response()->json([
            'message' => 'Permissions imported successfully',
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'invalid' => $invalid,
        ]);
    }

    public function downloadTemplate(Request $request)
    {
        $this->authorizePermissionAction($request->user(), ['import_permissions', 'manage_permissions', 'view_permissions']);

        $path = base_path('docs/PERMISSIONS_IMPORT_TEMPLATE_GROUPED.csv');

        if (!file_exists($path)) {
            return response()->json(['message' => 'Template file not available on server.'], 404);
        }

        return response()->download(
            $path,
            'PERMISSIONS_IMPORT_TEMPLATE_GROUPED.csv',
            ['Content-Type' => 'text/csv; charset=UTF-8']
        );
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     * @return array{int, int, int, int}
     */
    private function importRows(array $rows): array
    {
        $created = 0;
        $updated = 0;
        $skipped = 0;
        $invalid = 0;

        foreach ($rows as $row) {
            $row = $this->normalizeImportRow($row);

            $name = trim((string) ($row['name'] ?? ''));
            $displayName = trim((string) ($row['display_name'] ?? ''));

            if ($name === '' || $displayName === '') {
                $invalid++;
                continue;
            }

            $status = strtolower(trim((string) ($row['status'] ?? 'active')));
            if (!in_array($status, ['active', 'inactive'], true)) {
                $status = 'active';
            }

            $isSystemRaw = $row['is_system'] ?? true;
            $isSystem = filter_var($isSystemRaw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($isSystem === null) {
                $isSystem = true;
            }

            $payload = [
                'display_name' => $displayName,
                'category' => isset($row['category']) ? trim((string) $row['category']) : null,
                'description' => isset($row['description']) ? trim((string) $row['description']) : null,
                'status' => $status,
                'is_system' => $isSystem,
            ];

            $permission = Permission::where('name', $name)
                ->where('guard_name', 'web')
                ->first();

            if ($permission) {
                $skipped++;
                continue;
            }

            Permission::create(array_merge($payload, [
                'name' => $name,
                'guard_name' => 'web',
            ]));
            $created++;
        }

        return [$created, $updated, $skipped, $invalid];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function extractRowsFromFile(string $path, string $extension): array
    {
        if ($extension === 'csv' || $extension === 'txt') {
            return $this->extractRowsFromCsv($path);
        }

        if ($extension === 'xlsx') {
            return $this->extractRowsFromXlsx($path);
        }

        return [];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function extractRowsFromCsv(string $path): array
    {
        $handle = fopen($path, 'r');
        if ($handle === false) {
            return [];
        }

        $rawRows = [];

        while (($row = fgetcsv($handle)) !== false) {
            $rawRows[] = $row;
        }

        fclose($handle);

        if (empty($rawRows)) {
            return [];
        }

        return $this->parseSequentialRows($rawRows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function extractRowsFromXlsx(string $path): array
    {
        $zip = new \ZipArchive();
        if ($zip->open($path) !== true) {
            return [];
        }

        $workbookXml = $zip->getFromName('xl/workbook.xml');
        $workbookRelsXml = $zip->getFromName('xl/_rels/workbook.xml.rels');

        $sharedStringsXml = $zip->getFromName('xl/sharedStrings.xml');

        $sheetPath = $this->resolveFirstWorksheetPath($workbookXml ?: '', $workbookRelsXml ?: '')
            ?? 'xl/worksheets/sheet1.xml';

        $sheetXml = $zip->getFromName($sheetPath);
        $zip->close();

        if ($sheetXml === false) {
            return [];
        }

        $sharedStrings = [];
        if ($sharedStringsXml !== false) {
            $shared = @simplexml_load_string($sharedStringsXml);
            if ($shared !== false) {
                $items = $shared->xpath('//*[local-name()="si"]') ?: [];
                foreach ($items as $item) {
                    $text = '';

                    $directText = $item->xpath('./*[local-name()="t"]') ?: [];
                    if (!empty($directText)) {
                        $text = (string) $directText[0];
                    } else {
                        $runs = $item->xpath('./*[local-name()="r"]') ?: [];
                        foreach ($runs as $run) {
                            $runText = $run->xpath('./*[local-name()="t"]') ?: [];
                            if (!empty($runText)) {
                                $text .= (string) $runText[0];
                            }
                        }
                    }

                    $sharedStrings[] = $text;
                }
            }
        }

        $sheet = @simplexml_load_string($sheetXml);
        if ($sheet === false) {
            return [];
        }

        $rows = [];
        $rowNodes = $sheet->xpath('//*[local-name()="sheetData"]/*[local-name()="row"]') ?: [];

        foreach ($rowNodes as $row) {
            $current = [];
            $cellNodes = $row->xpath('./*[local-name()="c"]') ?: [];

            foreach ($cellNodes as $cell) {
                $cellRef = (string) ($cell['r'] ?? '');
                preg_match('/([A-Z]+)/', $cellRef, $matches);
                $column = $matches[1] ?? '';
                $type = (string) ($cell['t'] ?? '');
                $value = '';

                $valueNode = $cell->xpath('./*[local-name()="v"]') ?: [];
                if (!empty($valueNode)) {
                    $value = (string) $valueNode[0];
                }

                if ($type === 'inlineStr') {
                    $inlineNode = $cell->xpath('./*[local-name()="is"]/*[local-name()="t"]') ?: [];
                    $value = !empty($inlineNode) ? (string) $inlineNode[0] : '';
                }

                if ($type === 's') {
                    $idx = (int) $value;
                    $value = $sharedStrings[$idx] ?? '';
                }

                $current[$column] = trim($value);
            }
            $rows[] = $current;
        }

        if (empty($rows)) {
            return [];
        }

        return $this->parseWorksheetRows($rows);
    }

    /**
     * @param array<int, array<int, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    private function parseSequentialRows(array $rows): array
    {
        $headerIndex = $this->detectSequentialHeaderRowIndex($rows);
        $defaultHeaders = ['name', 'display_name', 'category', 'description', 'status', 'is_system'];

        $headers = [];
        $startIndex = 0;

        if ($headerIndex !== null) {
            $headerRow = $rows[$headerIndex] ?? [];
            foreach ($headerRow as $index => $value) {
                $headers[$index] = $this->normalizeHeader((string) $value);
            }
            $startIndex = $headerIndex + 1;
        } else {
            foreach ($defaultHeaders as $index => $key) {
                $headers[$index] = $key;
            }
        }

        $parsed = [];
        for ($i = $startIndex; $i < count($rows); $i++) {
            $row = $rows[$i] ?? [];
            if ($this->isSequentialRowEmpty($row)) {
                continue;
            }

            $parsedRow = [];
            foreach ($headers as $index => $key) {
                if ($key === '') {
                    continue;
                }
                $parsedRow[$key] = array_key_exists($index, $row) ? trim((string) $row[$index]) : null;
            }

            if (!empty(array_filter($parsedRow, fn ($value) => $value !== null && $value !== ''))) {
                $parsed[] = $parsedRow;
            }
        }

        return $parsed;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    private function parseWorksheetRows(array $rows): array
    {
        $headerIndex = $this->detectWorksheetHeaderRowIndex($rows);
        $defaultHeaders = ['name', 'display_name', 'category', 'description', 'status', 'is_system'];

        $headersByColumn = [];
        $startIndex = 0;

        if ($headerIndex !== null) {
            $headerRow = $rows[$headerIndex] ?? [];
            foreach ($headerRow as $column => $value) {
                $headersByColumn[$column] = $this->normalizeHeader((string) $value);
            }
            $startIndex = $headerIndex + 1;
        } else {
            $allColumns = [];
            foreach ($rows as $row) {
                foreach (array_keys($row) as $column) {
                    $allColumns[$column] = true;
                }
            }

            $orderedColumns = array_keys($allColumns);
            usort($orderedColumns, fn ($a, $b) => $this->excelColumnIndex((string) $a) <=> $this->excelColumnIndex((string) $b));

            foreach ($defaultHeaders as $index => $key) {
                if (!isset($orderedColumns[$index])) {
                    continue;
                }
                $headersByColumn[$orderedColumns[$index]] = $key;
            }
        }

        $parsed = [];
        for ($i = $startIndex; $i < count($rows); $i++) {
            $row = $rows[$i] ?? [];
            if ($this->isWorksheetRowEmpty($row)) {
                continue;
            }

            $parsedRow = [];
            foreach ($headersByColumn as $column => $key) {
                if ($key === '') {
                    continue;
                }
                $value = $row[$column] ?? null;
                $parsedRow[$key] = is_string($value) ? trim($value) : $value;
            }

            if (!empty(array_filter($parsedRow, fn ($value) => $value !== null && $value !== ''))) {
                $parsed[] = $parsedRow;
            }
        }

        return $parsed;
    }

    /**
     * @param array<int, array<int, mixed>> $rows
     */
    private function detectSequentialHeaderRowIndex(array $rows): ?int
    {
        $limit = min(count($rows), 20);
        for ($i = 0; $i < $limit; $i++) {
            $values = array_map(fn ($value) => $this->normalizeHeader((string) $value), $rows[$i] ?? []);
            if ($this->isHeaderLike($values)) {
                return $i;
            }
        }

        return null;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     */
    private function detectWorksheetHeaderRowIndex(array $rows): ?int
    {
        $limit = min(count($rows), 20);
        for ($i = 0; $i < $limit; $i++) {
            $row = $rows[$i] ?? [];
            $values = array_map(fn ($value) => $this->normalizeHeader((string) $value), array_values($row));
            if ($this->isHeaderLike($values)) {
                return $i;
            }
        }

        return null;
    }

    /**
     * @param array<int, string> $values
     */
    private function isHeaderLike(array $values): bool
    {
        $hasName = count(array_intersect($values, ['name', 'permission', 'permission_name'])) > 0;
        $hasDisplay = count(array_intersect($values, ['display_name', 'displayname', 'display', 'title'])) > 0;

        return $hasName && $hasDisplay;
    }

    /**
     * @param array<int, mixed> $row
     */
    private function isSequentialRowEmpty(array $row): bool
    {
        foreach ($row as $value) {
            if ($value !== null && trim((string) $value) !== '') {
                return false;
            }
        }

        return true;
    }

    /**
     * @param array<string, mixed> $row
     */
    private function isWorksheetRowEmpty(array $row): bool
    {
        foreach ($row as $value) {
            if ($value !== null && trim((string) $value) !== '') {
                return false;
            }
        }

        return true;
    }

    private function excelColumnIndex(string $column): int
    {
        $column = strtoupper(trim($column));
        if ($column === '') {
            return PHP_INT_MAX;
        }

        $index = 0;
        $length = strlen($column);
        for ($i = 0; $i < $length; $i++) {
            $char = ord($column[$i]);
            if ($char < 65 || $char > 90) {
                continue;
            }
            $index = ($index * 26) + ($char - 64);
        }

        return $index;
    }

    private function resolveFirstWorksheetPath(string $workbookXml, string $relsXml): ?string
    {
        if ($workbookXml === '' || $relsXml === '') {
            return null;
        }

        $workbook = @simplexml_load_string($workbookXml);
        $rels = @simplexml_load_string($relsXml);

        if ($workbook === false || $rels === false) {
            return null;
        }

        $sheetNodes = $workbook->xpath('//*[local-name()="sheets"]/*[local-name()="sheet"]') ?: [];
        if (empty($sheetNodes)) {
            return null;
        }

        $relationshipId = (string) ($sheetNodes[0]->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships')['id'] ?? '');
        if ($relationshipId === '') {
            return null;
        }

        $relationNodes = $rels->xpath('//*[local-name()="Relationship"]') ?: [];
        foreach ($relationNodes as $relation) {
            if ((string) ($relation['Id'] ?? '') !== $relationshipId) {
                continue;
            }

            $target = (string) ($relation['Target'] ?? '');
            if ($target === '') {
                return null;
            }

            $target = ltrim($target, '/');
            if (!str_starts_with($target, 'xl/')) {
                $target = 'xl/' . $target;
            }

            return $target;
        }

        return null;
    }

    private function normalizeHeader(string $header): string
    {
        $header = str_replace("\xEF\xBB\xBF", '', $header);
        $normalized = strtolower(trim($header));
        return str_replace([' ', '-'], '_', $normalized);
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function normalizeImportRow(array $row): array
    {
        $normalized = [];

        foreach ($row as $key => $value) {
            $normalizedKey = $this->normalizeHeader((string) $key);
            $normalized[$normalizedKey] = $value;
        }

        $name = $this->firstNonEmptyValue($normalized, ['name', 'permission', 'permission_name']);
        $displayName = $this->firstNonEmptyValue($normalized, ['display_name', 'displayname', 'title']);

        if ($displayName === null && $name !== null) {
            $displayName = ucwords(str_replace(['_', '-'], ' ', (string) $name));
        }

        return [
            'name' => $name,
            'display_name' => $displayName,
            'category' => $this->firstNonEmptyValue($normalized, ['category', 'group']),
            'description' => $this->firstNonEmptyValue($normalized, ['description', 'details']),
            'status' => $this->firstNonEmptyValue($normalized, ['status']) ?: 'active',
            'is_system' => $this->firstNonEmptyValue($normalized, ['is_system', 'system']) ?? true,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @param array<int, string> $keys
     */
    private function firstNonEmptyValue(array $row, array $keys): mixed
    {
        foreach ($keys as $key) {
            if (!array_key_exists($key, $row)) {
                continue;
            }

            $value = $row[$key];
            if ($value === null) {
                continue;
            }

            if (is_string($value) && trim($value) === '') {
                continue;
            }

            return $value;
        }

        return null;
    }

    private function authorizePermissionAction($user, array $permissions): void
    {
        $this->ensureAnyPermission($user, $permissions, 'Not authorized to manage permissions');
    }
}
