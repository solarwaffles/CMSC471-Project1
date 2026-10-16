"""Attach actual student home-state flows from revised IPEDS Fall Enrollment 2014."""
import csv
import io
import json
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
STATE_FIPS = {'01','02','04','05','06','08','09','10','11','12','13','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','44','45','46','47','48','49','50','51','53','54','55','56'}

def zip_csv(filename, member, encoding):
    with zipfile.ZipFile(DATA / filename) as archive:
        return list(csv.DictReader(io.StringIO(archive.read(member).decode(encoding))))

schools = json.loads((DATA / 'schools.json').read_text())
ids = {s['id'] for s in schools}
with (DATA / 'mrc_table11.csv').open(newline='') as stream:
    crosswalk = {r['opeid']: r['super_opeid'] for r in csv.DictReader(stream)}
hd = zip_csv('hd2014.zip', 'hd2014.csv', 'cp1252')
residence = zip_csv('ef2014c.zip', 'ef2014c_rv.csv', 'utf-8-sig')

unit_to_school = {}
for record in hd:
    raw_opeid = record['OPEID'].strip()
    if not raw_opeid.isdigit():
        continue
    root_opeid = str(int(raw_opeid) // 100)
    identifier = crosswalk.get(root_opeid)
    # Later admissions files sometimes use a stand-alone OPEID instead of an
    # older pooled ID (e.g. Ohio State); use the exact OPEID in that case.
    if identifier not in ids:
        identifier = root_opeid if root_opeid in ids else None
    if identifier:
        unit_to_school[record['UNITID'].strip()] = identifier

flows = defaultdict(Counter)
totals = Counter()
coverage = defaultdict(set)
national_state_totals = Counter()
missing_cells = []
for record in residence:
    unit = record['UNITID'].strip()
    fips = record['EFCSTATE'].strip().zfill(2)
    value = record['EFRES01'].strip()
    if not value:
        if unit in unit_to_school:
            missing_cells.append((unit, fips))
        continue
    count = int(value)
    assert count >= 0
    if fips in STATE_FIPS:
        national_state_totals[fips] += count
    identifier = unit_to_school.get(unit)
    if not identifier:
        continue
    coverage[identifier].add(unit)
    if fips in STATE_FIPS:
        flows[identifier][fips] += count
    elif fips == '99':
        totals[identifier] += count

assert not missing_cells, f'Missing selected-college counts: {missing_cells}'
assert set(coverage) == ids
assert set(national_state_totals) == STATE_FIPS
for school in schools:
    identifier = school['id']
    school['homeStateCounts'] = dict(sorted(flows[identifier].items()))
    school['originTotalStudents'] = totals[identifier]
    school['originKnownUSStudents'] = sum(flows[identifier].values())
    school['originOtherStudents'] = totals[identifier] - school['originKnownUSStudents']
    school['originUnitIds'] = sorted(coverage[identifier])
    assert school['originOtherStudents'] >= 0

(DATA / 'schools.json').write_text(json.dumps(schools, separators=(',', ':')))
(DATA / 'origin-state-totals.json').write_text(json.dumps(dict(sorted(national_state_totals.items())), separators=(',', ':')))
print(json.dumps({
    'year': 2014, 'schools_matched': len(coverage),
    'mapped_ipeds_units_with_residence_data': sum(len(v) for v in coverage.values()),
    'selected_known_us_students': sum(s['originKnownUSStudents'] for s in schools),
    'selected_other_or_unknown_students': sum(s['originOtherStudents'] for s in schools),
    'all_ipeds_known_us_students': sum(national_state_totals.values()),
}, indent=2))
