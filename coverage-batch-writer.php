<?php

declare(strict_types=1);

/**
 * Recursively sort object keys while preserving list order.
 *
 * @param mixed $value
 * @return mixed
 */
function escomi_coverage_canonicalize($value)
{
    if (!is_array($value)) {
        return $value;
    }

    if (array_is_list($value)) {
        return array_map('escomi_coverage_canonicalize', $value);
    }

    ksort($value, SORT_STRING);
    foreach ($value as $key => $nested) {
        $value[$key] = escomi_coverage_canonicalize($nested);
    }
    return $value;
}

/** @param mixed $value */
function escomi_coverage_canonical_json($value): string
{
    $json = json_encode(
        escomi_coverage_canonicalize($value),
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
    );
    return (string) $json;
}

/** @param mixed $value */
function escomi_coverage_current_hash(string $field, bool $exists, $value): string
{
    return hash('sha256', escomi_coverage_canonical_json([
        'field' => $field,
        'exists' => $exists,
        'value' => $value,
    ]));
}

/** @param mixed $payload */
function escomi_coverage_payload_hash($payload): string
{
    return hash('sha256', escomi_coverage_canonical_json($payload));
}
