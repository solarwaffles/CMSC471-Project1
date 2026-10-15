"""Package an offline HTML copy and an editable source ZIP of this static Site."""
from pathlib import Path
import json
import zipfile

ROOT = Path(__file__).resolve().parent
DIST = ROOT / 'dist'
html = (DIST / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>' + (DIST / 'styles.css').read_text() + '</style>')
for tag in ['vendor/d3.min.js', 'vendor/topojson-client.min.js', 'app.js']:
    html = html.replace(f'<script src="{tag}" defer></script>', '')
app = (DIST / 'app.js').read_text()
data = [json.loads((DIST / 'data/schools.json').read_text()), json.loads((DIST / 'data/us-states.json').read_text()), json.loads((DIST / 'data/origin-state-totals.json').read_text()), json.loads((DIST / 'data/state-populations-2014.json').read_text())]
app = app.replace("Promise.all([d3.json('data/schools.json'),d3.json('data/us-states.json'),d3.json('data/origin-state-totals.json'),d3.json('data/state-populations-2014.json')])", 'Promise.resolve(' + json.dumps(data, separators=(',', ':')) + ')')
scripts = '<script>' + (DIST / 'vendor/d3.min.js').read_text() + '</script>'
scripts += '<script>' + (DIST / 'vendor/topojson-client.min.js').read_text() + '</script>'
scripts += '<script>' + app + '</script>'
html = html.replace('</body>', scripts + '</body>')
for filename, url in [
    ('college-admissions.csv', 'https://opportunityinsights.org/wp-content/uploads/2023/07/CollegeAdmissions_Data.csv'),
    ('mrc_table2.csv', 'https://opportunityinsights.org/wp-content/uploads/2018/04/mrc_table2.csv'),
    ('mrc_table10.csv', 'https://opportunityinsights.org/wp-content/uploads/2018/04/mrc_table10.csv'),
    ('mrc_table11.csv', 'https://opportunityinsights.org/wp-content/uploads/2018/04/mrc_table11.csv'),
    ('ef2014c-dict.zip', 'https://nces.ed.gov/ipeds/datacenter/data/EF2014C_Dict.zip'),
    ('census-state-population-2014.csv', 'https://www2.census.gov/programs-surveys/popest/tables/2010-2014/state/totals/nst-est2014-01.csv'),
    ('hd2014.zip', 'https://nces.ed.gov/ipeds/datacenter/data/HD2014.zip'),
]:
    html = html.replace(f'href="data/{filename}"', f'href="{url}"')
(DIST / 'college-access-explorer.html').write_text(html)
with zipfile.ZipFile(DIST / 'college-access-source.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    files = [*sorted(DIST.rglob('*')), ROOT / 'README.md', ROOT / 'prepare_data.py', ROOT / 'prepare_origins.py', ROOT / 'build_portable.py', ROOT / 'THIRD_PARTY_NOTICES.txt']
    for item in files:
        if item.is_file() and item.name != 'college-access-source.zip':
            archive.write(item, str(item.relative_to(ROOT)))
print(json.dumps({'standalone_bytes': (DIST / 'college-access-explorer.html').stat().st_size, 'zip_bytes': (DIST / 'college-access-source.zip').stat().st_size}))
