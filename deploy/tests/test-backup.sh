#!/usr/bin/env bash
# AI-assisted regression self-check, OpenAI Codex, Iteration 2 (2026-10-31).
set -euo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
python3 - "$script_dir/../backup.sh" <<'PYTEST'
"""Synthetic command doubles: no Docker daemon, providers, real data or root changes."""
import atexit
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile

SCRIPT = Path(sys.argv[1]).resolve()
FIXTURE_ROOT = Path(tempfile.mkdtemp(prefix='outloud-backup-check-'))
atexit.register(shutil.rmtree, FIXTURE_ROOT)
project = FIXTURE_ROOT / 'project'
bin_dir = FIXTURE_ROOT / 'bin'
(project / 'deploy').mkdir(parents=True)
bin_dir.mkdir()
shutil.copy2(SCRIPT, project / 'deploy/backup.sh')
(project / 'compose.production.yaml').write_text('# synthetic fixture\n')
(project / 'deploy/.env').write_text('PRIVATE_FIXTURE=must-not-be-archived-or-printed\n')

mock_docker = r'''#!/usr/bin/env python3
import io,json,os,sys,tarfile
from pathlib import Path
args=sys.argv[1:]
with open(os.environ['MOCK_LOG'],'a') as out:
    out.write(json.dumps(args)+'\n')
if args[0]=='compose':
    args=args[5:]
    action=args[0]
    if action=='config':
        if os.getenv('MOCK_FAIL')=='config': sys.exit(20)
        print(json.dumps({'volumes':{'media_data':{'name':'fixture-media'}},'services':{'api':{'image':'fixture-backend'}},'private':'must-not-be-archived-or-printed'}))
    elif action=='ps':
        if os.getenv('MOCK_FAIL')=='ps': sys.exit(21)
        print(os.environ.get('MOCK_RUNNING','db\nredis\napi\nproxy'))
    elif action in ('stop','start'):
        if os.getenv('MOCK_FAIL')==action: sys.exit(22)
    elif action=='exec':
        if args[3]=='sh':
            if os.getenv('MOCK_FAIL')=='dump': sys.exit(23)
            sys.stdout.buffer.write(b'PG-MOCK-DUMP\n')
        elif args[3]=='pg_restore':
            assert sys.stdin.buffer.read()==b'PG-MOCK-DUMP\n'
        else: raise AssertionError(args)
    else: raise AssertionError(args)
elif args[:2] in (['volume','inspect'],['image','inspect']):
    print('[]')
elif args[0]=='run':
    if os.getenv('MOCK_FAIL')=='archive': sys.exit(24)
    assert '--read-only' in args and '--network' in args and args[args.index('--network')+1]=='none'
    mounts=[args[i+1] for i,v in enumerate(args) if v=='--mount']
    assert 'type=volume,source=fixture-media,target=/media,readonly' in mounts
    backup=next(m.split(',')[1].split('=',1)[1] for m in mounts if m.startswith('type=bind,'))
    with tarfile.open(Path(backup)/'media.tar.gz','w:gz') as archive:
        item=tarfile.TarInfo('fixture.txt'); body=b'synthetic media fixture\n'; item.size=len(body)
        archive.addfile(item,io.BytesIO(body))
    (Path(backup)/'media.tar.gz').chmod(0o644)
else: raise AssertionError(args)
'''

helpers = {
    'docker': mock_docker,
    'id': '#!/bin/sh\nif [ "$1" = -u ]; then echo "${MOCK_UID:-0}"; else exec /usr/bin/id "$@"; fi\n',
    'flock': '#!/bin/sh\n[ "${MOCK_FAIL:-}" != lock ]\n',
    'stat': '#!/usr/bin/env python3\nimport os,stat,sys\nassert sys.argv[1:3]==["-c","%a"]\nprint(oct(stat.S_IMODE(os.stat(sys.argv[3]).st_mode))[2:])\n',
    'sha256sum': r'''#!/usr/bin/env python3
import hashlib,sys
from pathlib import Path
if sys.argv[1]=='--check':
    for line in Path(sys.argv[2]).read_text().splitlines():
        expected,name=line.split('  ',1)
        assert hashlib.sha256(Path(name).read_bytes()).hexdigest()==expected
else:
    for name in sys.argv[1:]: print(hashlib.sha256(Path(name).read_bytes()).hexdigest()+'  '+name)
''',
}
for name, content in helpers.items():
    p=bin_dir/name
    p.write_text(content)
    p.chmod(0o755)


def run_case(name, running='db\nredis\napi\nproxy', fail='', uid='0', insecure=False):
    case=FIXTURE_ROOT/name
    case.mkdir()
    destination=case/'backups'
    if insecure:
        destination.mkdir(mode=0o755)
    command_log=case/'commands.jsonl'
    env={**os.environ, 'PATH':str(bin_dir)+os.pathsep+os.environ['PATH'], 'MOCK_LOG':str(command_log), 'MOCK_RUNNING':running, 'MOCK_FAIL':fail, 'MOCK_UID':uid}
    result=subprocess.run(['bash',str(project/'deploy/backup.sh'),str(destination)],env=env,capture_output=True,text=True)
    commands=[json.loads(line) for line in command_log.read_text().splitlines()] if command_log.exists() else []
    assert 'must-not-be-archived-or-printed' not in result.stdout+result.stderr
    stops=[a[6:] for a in commands if a[0]=='compose' and a[5]=='stop']
    starts=[a[6:] for a in commands if a[0]=='compose' and a[5]=='start']
    snapshots=[a for a in commands if a[0]=='run' or (a[0]=='compose' and a[5]=='exec')]
    return result,commands,stops,starts,snapshots,destination


result,commands,stops,starts,snapshots,dest=run_case('only-api')
assert result.returncode==0,result.stderr
assert stops==[['--timeout','330','api']] and starts==[['api']]
backup=Path(result.stdout.strip())
assert backup.is_dir() and stat.S_IMODE(backup.stat().st_mode)==0o700
assert {p.name for p in backup.iterdir()}=={'database.dump','media.tar.gz','manifest.txt','SHA256SUMS'}
assert all(stat.S_IMODE(p.stat().st_mode)==0o600 for p in backup.iterdir())
assert 'environment_included=false' in (backup/'manifest.txt').read_text()
assert len(snapshots)==3
assert next(i for i,a in enumerate(commands) if a[0]=='compose' and a[5]=='stop') < next(i for i,a in enumerate(commands) if a[0]=='compose' and a[5]=='exec')
assert next(i for i,a in enumerate(commands) if a[0]=='run') < next(i for i,a in enumerate(commands) if a[0]=='compose' and a[5]=='start')

result,_,stops,starts,_,_=run_case('all-writers',running='db\nscheduler\napi\nworker\nproxy')
assert result.returncode==0 and stops==[['--timeout','330','scheduler','api','worker']] and starts==[['scheduler','api','worker']]
result,_,stops,starts,_,_=run_case('no-writers',running='db\nredis\nproxy')
assert result.returncode==0,result.stderr
assert not stops and not starts

for failure in ('dump','archive','stop'):
    result,_,stops,starts,_,dest=run_case('failed-'+failure,running='db\napi\nworker\nproxy',fail=failure)
    assert result.returncode!=0 and not result.stdout,(failure,result)
    assert stops==[['--timeout','330','api','worker']] and starts==[['api','worker']],failure
    backups=[p for p in dest.iterdir() if p.is_dir()]
    assert len(backups)==1 and not (backups[0]/'manifest.txt').exists(),failure

result,_,_,starts,_,dest=run_case('restart-failure',fail='start')
assert result.returncode!=0 and starts==[['api']] and not result.stdout
assert 'Could not resume' in result.stderr
assert len([p for p in dest.iterdir() if p.is_dir() and (p/'manifest.txt').is_file()])==1

for failure in ('config','ps','lock'):
    result,_,stops,starts,snapshots,dest=run_case('preflight-'+failure,fail=failure)
    assert result.returncode!=0 and not stops and not starts and not snapshots,failure
    assert not [p for p in dest.iterdir() if p.is_dir()],failure

result,commands,_,_,_,dest=run_case('nonroot',uid='999')
assert result.returncode!=0 and not commands and not dest.exists()
result,commands,_,_,_,dest=run_case('insecure-destination',insecure=True)
assert result.returncode!=0 and not commands and stat.S_IMODE(dest.stat().st_mode)==0o755
print('12 synthetic backup state/failure checks passed.')

PYTEST
