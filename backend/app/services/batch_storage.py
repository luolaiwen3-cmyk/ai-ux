import gzip
import json
import os
from pathlib import Path


def canonical_records(records: list[dict]) -> bytes:
    return json.dumps(records, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def write_batch(data_dir: Path, session_id: str, stream: str, sequence: int, payload: bytes) -> Path:
    directory = data_dir / "sessions" / session_id / stream
    directory.mkdir(parents=True, exist_ok=True)
    destination = directory / f"{sequence:06d}.json.gz"
    temporary = destination.with_suffix(".tmp")
    with gzip.open(temporary, "wb", compresslevel=6) as output:
        output.write(payload)
    os.replace(temporary, destination)
    return destination
