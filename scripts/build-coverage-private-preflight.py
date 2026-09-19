#!/usr/bin/env python3
"""Emit candidate-only read-only PHP to SSH stdin; never include private data."""
from pathlib import Path
root = Path(__file__).resolve().parents[1]
parts = []
for name in ('coverage-private-runtime.php', 'coverage-batch-writer.php'):
    source = (root / name).read_text()
    if not source.startswith('<?php\n'):
        raise SystemExit('Unexpected PHP entrypoint')
    source = source[6:].replace('declare(strict_types=1);', '', 1)
    if name == 'coverage-batch-writer.php':
        dependency = "require_once __DIR__ . '/coverage-private-runtime.php';"
        if source.count(dependency) != 1:
            raise SystemExit('Unexpected coverage dependency contract')
        source = source.replace(dependency, '')
    parts.append(source)
print('declare(strict_types=1);\n' + '\n'.join(parts))
print((root / 'scripts/coverage-private-preflight-body.php').read_text().removeprefix('<?php\n'))
