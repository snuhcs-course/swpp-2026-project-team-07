#!/usr/bin/env python3
# AI-assisted with OpenAI Codex, 2026-10-20.
"""Select explicitly reviewed development sessions from a private course-exporter ZIP.

This never infers topic from cwd or keywords and never changes source files.
Selection does not replace full-history review or owner privacy approval.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import tempfile
import zipfile


def fingerprint(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def private_path(value, new=False):
    path = Path(value).expanduser().resolve()
    if any((parent / '.git').exists() for parent in (path.parent, *path.parents)):
        raise ValueError('Keep source archives, decisions and outputs outside every Git worktree')
    if new and path.exists():
        raise ValueError('Output already exists; choose a new private filename')
    if not path.parent.is_dir():
        raise ValueError('Create the private output directory first')
    return path


def load_manifest(archive):
    names = archive.namelist()
    if len(names) != len(set(names)):
        raise ValueError('Duplicate ZIP entries')
    for name in names:
        path = PurePosixPath(name)
        if path.is_absolute() or '..' in path.parts or '\\' in name or ':' in name:
            raise ValueError('Unsafe archive path')
    manifest = json.loads(archive.read('manifest.json'))
    if manifest.get('format_version') != 1 or manifest.get('generator', {}).get('name') != 'session-exporter':
        raise ValueError('Expected a format-1 course session-exporter archive')
    expected, keys = {'manifest.json'}, set()
    for session in manifest['sessions']:
        key = (session['tool'], session['session_id'])
        if key in keys:
            raise ValueError('Duplicate session in source manifest')
        keys.add(key)
        for item in session['files']:
            name = item['archive_path']
            if name in expected:
                raise ValueError('Duplicate file in source manifest')
            expected.add(name)
    if set(names) != expected:
        raise ValueError('ZIP file list does not match its manifest')
    return manifest


def write_new(path, writer):
    # Publish without replacing a pre-existing result, including a concurrent writer's file.
    fd, name = tempfile.mkstemp(prefix='.session-selection-', dir=path.parent)
    temporary = Path(name)
    os.close(fd)
    try:
        writer(temporary)
        os.link(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def initialize(source, selection):
    with zipfile.ZipFile(source) as archive:
        manifest = load_manifest(archive)
    document = {'format_version': 1, 'source_archive_sha256': fingerprint(source),
                'scope': 'outloud-development-only',
                'sessions': [{'tool': s['tool'], 'session_id': s['session_id'],
                              'decision': 'pending', 'reason': ''} for s in manifest['sessions']]}
    write_new(selection, lambda path: path.write_text(json.dumps(document, indent=2) + '\n', encoding='utf-8'))
    print('Created private selection with {} pending decisions; no ZIP created'.format(len(document['sessions'])))


def build(source, selection, output):
    document = json.loads(selection.read_text(encoding='utf-8'))
    source_hash = fingerprint(source)
    if (document.get('format_version') != 1 or document.get('scope') != 'outloud-development-only'
            or document.get('source_archive_sha256') != source_hash):
        raise ValueError('Selection does not match this source archive and scope')
    decisions = {}
    for item in document['sessions']:
        key = (item['tool'], item['session_id'])
        if key in decisions:
            raise ValueError('Duplicate session decision')
        if item.get('decision') not in ('include', 'exclude'):
            raise ValueError('A session is pending or has an unknown decision')
        if not isinstance(item.get('reason'), str) or not item['reason'].strip():
            raise ValueError('Every session decision needs a content-based reason')
        decisions[key] = item
    with zipfile.ZipFile(source) as archive:
        manifest = load_manifest(archive)
        keys = {(s['tool'], s['session_id']) for s in manifest['sessions']}
        if keys != set(decisions):
            raise ValueError('Exactly one decision is required for every source session')
        included = [s for s in manifest['sessions'] if decisions[(s['tool'], s['session_id'])]['decision'] == 'include']
        if not included:
            raise ValueError('No development sessions selected; no ZIP created')
        excluded = [item for item in decisions.values() if item['decision'] == 'exclude']
        derived = {'format_version': 1,
                   'generator': {'name': 'onloud-development-session-selector', 'version': '1'},
                   'created_at': datetime.now(timezone.utc).isoformat(), 'query': manifest['query'],
                   'selection': {'source_archive_sha256': source_hash,
                                 'source_generator': manifest['generator'],
                                 'scope': document['scope'],
                                 'basis': 'Explicit topic decisions; full-history and owner privacy review are separate'},
                   'summary': {'sessions_exported': len(included),
                               'files_exported': sum(len(s['files']) for s in included),
                               'sessions_excluded_by_topic_review': len(excluded)},
                   'sessions': included,
                   'excluded_sessions': [{'tool': item['tool'], 'session_id': item['session_id'],
                                          'reason': 'Excluded by topic review; rationale retained privately'}
                                         for item in excluded],
                   'privacy': {'source_redaction_retained': True, 'new_redaction_performed': False,
                               'owner_privacy_review': 'pending'}}

        def write_archive(path):
            with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_DEFLATED) as result:
                for session in included:
                    for item in session['files']:
                        digest, size = hashlib.sha256(), 0
                        with archive.open(item['archive_path']) as raw, result.open(item['archive_path'], 'w', force_zip64=True) as dest:
                            for chunk in iter(lambda: raw.read(1024 * 1024), b''):
                                digest.update(chunk)
                                size += len(chunk)
                                dest.write(chunk)
                        if digest.hexdigest() != item['exported_sha256'] or size != item['exported_bytes']:
                            raise ValueError('Source file size/hash mismatch: ' + item['archive_path'])
                result.writestr('manifest.json', json.dumps(derived, indent=2, ensure_ascii=False) + '\n')
        write_new(output, write_archive)
    print(json.dumps(derived['summary'], sort_keys=True))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    for name in ('init', 'build'):
        command = commands.add_parser(name)
        command.add_argument('source')
        command.add_argument('selection')
        if name == 'build':
            command.add_argument('output')
    args = parser.parse_args()
    try:
        source = private_path(args.source)
        selection = private_path(args.selection, new=args.command == 'init')
        if args.command == 'init':
            initialize(source, selection)
        else:
            build(source, selection, private_path(args.output, new=True))
    except (ValueError, KeyError, TypeError, OSError, zipfile.BadZipFile) as exc:
        parser.exit(2, 'Selection aborted: {}\n'.format(exc))


if __name__ == '__main__':
    main()
