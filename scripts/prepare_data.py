"""Join the published Opportunity Insights files without imputing missing values."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'

def read(name):
    with (DATA / name).open(newline='', encoding='utf-8-sig') as stream:
        return list(csv.DictReader(stream))

def number(value):
    return float(value) if value not in ('', None) else None

income = {row['super_opeid']: row for row in read('mrc_table2.csv')}
characteristics = {row['super_opeid']: row for row in read('mrc_table10.csv')}
pipeline = {}
for row in read('college-admissions.csv'):
    pipeline.setdefault(row['super_opeid'], []).append(row)

schools = []
for identifier, rows in pipeline.items():
    first = rows[0]
    info = characteristics[identifier]
    inc = income.get(identifier, {})
    bins = {row['par_income_lab']: row for row in rows}
    rich = number(bins['Top 1']['attend'])
    middle = number(bins['40-60']['attend'])
    rejection = number(info['scorecard_rej_rate_2013'])
    race = [number(info[field]) for field in [
        'asian_or_pacific_share_fall_2000', 'black_share_fall_2000',
        'hisp_share_fall_2000', 'alien_share_fall_2000']]
    race = race + [max(0, 1 - sum(race))] if all(v is not None for v in race) else None
    schools.append({
        'id': identifier,
        'name': first['name'],
        'state': info['state'],
        'fips': info['fips'].zfill(2),
        'group': first['test_band_tier'],
        'public': first['public'] == 'Public',
        'multi': info['multi'] == '1',
        'admitRate': 1-rejection if rejection is not None else None,
        'income': [number(inc.get(f'par_q{i}')) for i in range(1,6)] if inc else None,
        'cohortCount': number(inc.get('count')),
        'race': race,
        'enrollment2000': number(info['ipeds_enrollment_2000']),
        'enrollment2013': number(info['ipeds_enrollment_2013']),
        'bottom20': number(inc.get('par_q1')),
        'top20': number(inc.get('par_q5')),
        'attendanceGap': rich / middle if rich is not None and middle and middle > 0 else None,
        'incomePipeline': [{
            'bin': row['par_income_lab'],
            'relativeAttendance': number(row['rel_attend']),
            'relativeApplication': number(row['rel_apply'])
        } for row in rows],
    })

assert len(schools) == 139
assert len({s['id'] for s in schools}) == len(schools)
for school in schools:
    if school['income']:
        assert abs(sum(school['income'])-1) < .001
    if school['race']:
        assert abs(sum(school['race'])-1) < .001
    if school['admitRate'] is not None:
        assert 0 <= school['admitRate'] <= 1

(DATA / 'schools.json').write_text(json.dumps(schools, separators=(',', ':')))
print(json.dumps({
    'schools': len(schools),
    'income_coverage': sum(s['income'] is not None for s in schools),
    'race_coverage': sum(s['race'] is not None for s in schools),
    'admissions_coverage': sum(s['admitRate'] is not None for s in schools),
    'missing_income': [s['name'] for s in schools if s['income'] is None]
}, indent=2))
