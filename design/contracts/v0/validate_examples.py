"""Static contract review utility; requires jsonschema==4.26.0, no network reads."""
import hashlib
import base64
import json
from copy import deepcopy
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

HERE = Path(__file__).resolve().parent
BASE = 'https://schemas.openprospector.invalid/v0/'


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def canonical(value):
    # Examples are ASCII and safe integers. Production requires full op-jcs-int-v0.
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()


def digest(value):
    return 'sha256:' + hashlib.sha256(canonical(value)).hexdigest()


schemas = [load(path) for path in HERE.glob('*.schema.json')]
for schema in schemas:
    Draft202012Validator.check_schema(schema)
registry = Registry().with_resources((schema['$id'], Resource.from_contents(schema)) for schema in schemas)


def validate(value, schema):
    Draft202012Validator({'$ref': BASE + schema}, registry=registry).validate(value)


def rejects(value, schema):
    from jsonschema import ValidationError
    try:
        validate(value, schema)
    except ValidationError:
        return
    raise AssertionError('Expected rejection: ' + schema)


def validate_links(contestation):
    alternatives = contestation['alternatives']
    ids = [a['alternative_id'] for a in alternatives]
    assert ids == contestation['alternative_ids'] and len(set(ids)) == len(ids)
    for alternative in alternatives:
        assert alternative['contestation_id'] == contestation['contestation_id']
        assert alternative['preserved_goal_id'] == contestation['preserved_goal_id']
        assert alternative['hazard_id'] == contestation['hazard_id']


fixture_dir = HERE.parents[1] / 'fixtures/vertical-slice'
for path in fixture_dir.glob('*.json'):
    artifact = load(path)
    validate(artifact, artifact['schema_version'].removesuffix('-v0') + '.schema.json')

exchange = load(HERE / 'examples/negotiation.json')
for name, schema in [('original', 'directive.schema.json'), ('revision', 'directive.schema.json'),
                     ('contestation', 'contestation.schema.json'), ('emit_frame', 'ipc-frame.schema.json'),
                     ('acceptance', 'protocol-payload.schema.json#/$defs/AlternativeAcceptance')]:
    validate(exchange[name], schema)
validate_links(exchange['contestation'])
original, revision = exchange['original'], exchange['revision']
assert revision['supersedes_directive_id'] == original['directive_id']
assert revision['revision'] == original['revision'] + 1
assert revision['accepted_alternative'] == exchange['acceptance']
for field in ['goal', 'target', 'budget', 'campaign_id', 'asset_id', 'author_id',
              'operating_envelope', 'earliest_start_tick', 'deadline_tick', 'safe_idle',
              'permitted_substitutions']:
    assert revision[field] == original[field], field
assert revision['observation_cell'] == exchange['contestation']['alternatives'][0]['proposed_cell']
assert 'advisory_route' not in revision and 'source_text' not in revision

finish = 0
for ordinal, message in enumerate(exchange['scheduled_messages']):
    validate(message, 'channel-message.schema.json')
    assert message['creation_ordinal'] == ordinal
    assert message['payload_hash'] == digest(message['payload'])
    assert message['payload_bytes'] == len(canonical(message['payload']))
    finish = max(finish, message['sent_tick']) + max(1, (message['payload_bytes'] + 4095) // 4096)
    assert message['deliver_at_tick'] == finish + 3000
    identifier = hashlib.sha256(canonical([message['run_id'], 'message', message['sent_tick'], ordinal])).hexdigest()[:24]
    assert message['message_id'] == 'message:' + identifier
assert exchange['acceptance']['accepted_tick'] == exchange['scheduled_messages'][1]['deliver_at_tick'] + 10
assert exchange['scheduled_messages'][2]['sent_tick'] == exchange['acceptance']['accepted_tick']

budget = load(HERE / 'examples/budget-exhaustion.json')
validate(budget, 'ipc-frame.schema.json')
assert budget['intent']['payload']['payload']['budget_used']['traverse_mm'] == original['budget']['traverse_mm']
locked = load(HERE / 'examples/no-alternative.json')
validate(locked, 'contestation.schema.json')
validate_links(locked)
transition = load(HERE / 'examples/no-alternative-transition.json')
validate(transition, 'endpoint-event.schema.json')
assert transition['payload']['cause_id'] == locked['contestation_id']

bad = deepcopy(exchange['contestation'])
bad.pop('alternatives')
rejects(bad, 'contestation.schema.json')
bad = deepcopy(exchange['contestation'])
bad.update(alternative_ids=[], alternatives=[])
rejects(bad, 'contestation.schema.json')
bad = deepcopy(locked)
bad['alternatives'] = exchange['contestation']['alternatives']
rejects(bad, 'contestation.schema.json')
bad = deepcopy(exchange['emit_frame'])
bad['intent']['deliver_at_tick'] = 1
rejects(bad, 'ipc-frame.schema.json')
bad = deepcopy(revision)
bad.pop('observation_cell')
rejects(bad, 'directive.schema.json')
bad = deepcopy(transition)
bad['payload'].pop('cause_id')
rejects(bad, 'endpoint-event.schema.json')
bad = deepcopy(original)
bad['safe_idle'] = 'return-to-start'
rejects(bad, 'directive.schema.json')
bad = deepcopy(exchange['contestation'])
bad['alternative_ids'].reverse()
try:
    validate_links(bad)
except AssertionError:
    pass
else:
    raise AssertionError('Mismatched alternative links accepted')

rejects({'one_way_latency_ticks': 0, 'tier1_bytes_per_tick': 0, 'tier2_bytes_per_tick': 1024},
        'run-manifest.schema.json#/properties/channel')
bad = deepcopy(exchange['scheduled_messages'][2])
bad.update(payload_kind='alternative-acceptance', priority=230, payload=exchange['acceptance'])
rejects(bad, 'channel-message.schema.json')

content = b'[]'
artifact = {'reference': {'artifact_id': 'artifact:bytes-example',
                         'artifact_hash': 'sha256:' + hashlib.sha256(content).hexdigest(),
                         'media_type': 'application/json', 'byte_length': len(content)},
            'content_base64': base64.b64encode(content).decode('ascii')}
validate(artifact, 'protocol-payload.schema.json#/$defs/ScienceArtifact')
assert len(canonical(artifact)) > len(content)
bad = deepcopy(artifact)
bad['reference'].pop('byte_length')
rejects(bad, 'protocol-payload.schema.json#/$defs/ScienceArtifact')

reflex = deepcopy(locked)
reflex.update(level=0, severity='reflex', disposition='safe-hold', window_open=False,
              time_to_harm_ticks=27, reflex_inputs={'distance_mm': 3000,
              'speed_mm_per_tick': 100, 'reaction_ticks': 1,
              'braking_mm_per_tick2': 25, 'stopping_distance_mm': 300})
validate(reflex, 'contestation.schema.json')
bad = deepcopy(reflex)
bad.pop('reflex_inputs')
rejects(bad, 'contestation.schema.json')

print(f'PASS: {len(schemas)} schemas, fixture documents, exchange, failure, artifact and reflex examples; 12 rejection cases.')
