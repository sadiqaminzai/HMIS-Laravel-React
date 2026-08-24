<?php

namespace App\Http\Controllers\Concerns;

/**
 * Names are stored in capitals.
 *
 * Every document this hospital produces prints names in capitals, and staff
 * match them that way -- against a card, a shelf label, a referral slip. Doing
 * the conversion only at print time left the register itself showing whatever
 * casing each clerk happened to type, so the same patient read one way on
 * screen and another on paper, and two spellings of one name sorted apart in
 * the list.
 *
 * Applied on the way in, so what is stored is what is shown and printed. Only
 * the fields that name a person, product or procedure are touched -- addresses,
 * notes and free text keep their own casing, where capitals would read as
 * shouting rather than as a label.
 *
 * Scripts without letter case -- Pashto, Dari, Arabic -- pass through unchanged,
 * which is why this is safe to apply without checking the language first.
 */
trait StoresNamesInUpperCase
{
    /**
     * Upper-case the given keys of a validated payload, in place.
     *
     * Missing keys are skipped rather than created: a partial update must not
     * gain a field it did not send, or it would blank the stored value.
     */
    protected function upperCaseNames(array $data, array $keys): array
    {
        foreach ($keys as $key) {
            if (!array_key_exists($key, $data)) {
                continue;
            }

            $value = $data[$key];
            if (!is_string($value) || $value === '') {
                continue;
            }

            // Collapse runs of whitespace at the same time: "ALI   AHMAD" and
            // "ALI AHMAD" are the same name and should not sort apart.
            $data[$key] = preg_replace('/\s+/u', ' ', mb_strtoupper(trim($value), 'UTF-8'));
        }

        return $data;
    }
}
