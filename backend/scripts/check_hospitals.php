<?php

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$active = App\Models\Hospital::query()->orderBy('name')->get(['id', 'name', 'deleted_at']);
$all = App\Models\Hospital::withTrashed()->orderBy('name')->get(['id', 'name', 'deleted_at']);

echo "Hospitals (not deleted): {$active->count()}\n";
foreach ($active as $h) {
    echo "- {$h->id}: {$h->name}\n";
}

echo "\nHospitals (with trashed): {$all->count()}\n";
foreach ($all as $h) {
    $suffix = $h->deleted_at ? ' (trashed)' : '';
    echo "- {$h->id}: {$h->name}{$suffix}\n";
}
