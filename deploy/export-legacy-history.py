#!/usr/bin/env python3
"""Export only the supported legacy history, without modifying its database.

AI-assisted by OpenAI Codex, October 31, 2026; see the active collaboration log.
Keep the full original pg_dump beside this export for legacy-only provenance.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess


FORMAT = "outloud-legacy-history-v1"
SOURCE_MIGRATIONS = [
    "0001_initial",
    "0002_attempt_upload_hash_deck_content_hash_and_more",
    "0003_attempt_feedback_state_attempt_metrics_and_more",
    "0004_generation_providerproject_attempt_feedback_key_and_more",
    "0005_deck_description_source_key_deck_descriptions_edited_and_more",
]
QUERY = r"""
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_build_object(
  'format', 'outloud-legacy-history-v1',
  'source_migrations', (SELECT jsonb_agg(name ORDER BY name) FROM django_migrations WHERE app='rehearsals'),
  'unsupported_counts', jsonb_build_object(
    'generations', (SELECT count(*) FROM rehearsals_generation),
    'provider_projects', (SELECT count(*) FROM rehearsals_providerproject),
    'provider_requests', (SELECT count(*) FROM rehearsals_providerrequest),
    'cached_descriptions', (SELECT count(*) FROM rehearsals_deck WHERE descriptions <> '[]'::jsonb OR description_revision <> 0),
    'edited_descriptions', (SELECT count(*) FROM rehearsals_deck WHERE descriptions_edited),
    'active_attempts', (SELECT count(*) FROM rehearsals_attempt WHERE status='processing' OR transcription_state NOT IN ('pending','complete','failed'))
  ),
  'decks', (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY id), '[]'::jsonb) FROM (
    SELECT id,title,pdf,page_count,created_at,content_hash,preparation_version FROM rehearsals_deck
  ) d),
  'slides', (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY id), '[]'::jsonb) FROM (
    SELECT id,deck_id,slide_index,image,extracted_text FROM rehearsals_slide
  ) s),
  'attempts', (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id), '[]'::jsonb) FROM (
    SELECT id,deck_id,audio,duration_ms,slide_events,audience,status,transcript,feedback,error,
           created_at,upload_hash,metrics,visits,queued_at FROM rehearsals_attempt
  ) a)
);
COMMIT;
"""


def media_file(root, name):
    if not isinstance(name, str) or not name or "\\" in name or "\0" in name:
        raise ValueError("A source media path is unsafe.")
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or str(path) != name:
        raise ValueError("A source media path is unsafe.")
    resolved = (root / name).resolve(strict=True)
    try:
        resolved.relative_to(root)
    except ValueError:
        raise ValueError("A source media path escapes the supplied media directory.") from None
    if not resolved.is_file():
        raise ValueError("A referenced media file is missing.")
    return resolved


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-container", required=True)
    parser.add_argument("--media-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        root = args.media_dir.resolve(strict=True)
        if not root.is_dir():
            raise ValueError("The media directory does not exist.")
        result = subprocess.run(
            ["docker", "exec", "-i", args.source_container, "sh", "-c",
             'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
            input=QUERY, capture_output=True, text=True, check=True,
        )
        document = json.loads(result.stdout)
        if document["format"] != FORMAT or document["source_migrations"] != SOURCE_MIGRATIONS:
            raise ValueError("The source migration stamp is unsupported.")
        if any(type(value) is not int or value != 0 for value in document["unsupported_counts"].values()):
            raise ValueError("The source contains unsupported legacy or active processing records.")
        paths = {record[field] for group, field in (("decks", "pdf"), ("slides", "image"), ("attempts", "audio"))
                 for record in document[group]}
        manifest = []
        for name in sorted(paths):
            path = media_file(root, name)
            digest = hashlib.sha256()
            with path.open("rb") as source:
                for chunk in iter(lambda: source.read(1024 * 1024), b""):
                    digest.update(chunk)
            manifest.append({"path": name, "size_bytes": path.stat().st_size, "sha256": digest.hexdigest()})
        document["media"] = manifest
        # Exclusive creation refuses to overwrite a prior private export or follow a symlink.
        descriptor = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as output:
                json.dump(document, output, ensure_ascii=False, allow_nan=False)
                output.write("\n")
        except BaseException:
            args.output.unlink()
            raise
    except subprocess.CalledProcessError:
        parser.exit(1, "Source database export failed; no history was imported.\n")
    except (OSError, ValueError, KeyError, TypeError):
        parser.exit(1, "Export failed validation or could not create a new private output file.\n")
    print(f"Exported {len(document['decks'])} decks, {len(document['slides'])} slides, "
          f"{len(document['attempts'])} attempts and {len(manifest)} media hashes; source unchanged.")


if __name__ == "__main__":
    main()
