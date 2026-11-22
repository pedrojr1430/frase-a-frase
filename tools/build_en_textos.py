"""Gera os textos em inglês a partir de tools/en_src/textos_*.txt.

Cada bloco: '### i | Título' + frases em inglês (mesma quantidade e ordem do espanhol)
+ 'w: kw1 ; kw2 ...' (mesma quantidade de palavras do espanhol).
O português (frases, palavras) e as perguntas vêm do texto em espanhol correspondente.
Saída: content/en/textos/<mesmos arquivos>.json e data/en/textos.json
"""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

files = sorted(glob.glob('content/textos/*.json'))
es = []
for f in files:
    for t in json.load(open(f, encoding='utf-8')):
        es.append((os.path.basename(f), t))

en = {}
for src in sorted(glob.glob('tools/en_src/textos_*.txt')):
    cur = None
    for line in open(src, encoding='utf-8'):
        line = line.rstrip('\n').strip()
        if not line:
            continue
        m = re.match(r'^### (\d+) \| (.+)$', line)
        if m:
            cur = int(m.group(1))
            if cur in en:
                sys.exit(f'duplicado: {cur}')
            en[cur] = {'title': m.group(2).strip(), 's': [], 'w': None}
        elif line.startswith('w:'):
            en[cur]['w'] = [x.strip() for x in line[2:].split(';')]
        else:
            en[cur]['s'].append(line)

erros = []
out_by_file = {}
alltx = []
for i, (fname, t) in enumerate(es):
    e = en.get(i)
    if not e:
        erros.append(f'{i}: falta'); continue
    if len(e['s']) != len(t['sentences']):
        erros.append(f"{i}: frases {len(e['s'])} != {len(t['sentences'])}")
    if not e['w'] or len(e['w']) != len(t['words']):
        erros.append(f"{i}: palavras {len(e['w'] or [])} != {len(t['words'])}")
    if any(not x for x in e['s'] + (e['w'] or [])):
        erros.append(f'{i}: campo vazio')
    nt = {
        'tema': t['tema'], 'title': e['title'], 'nivel': t['nivel'],
        'sentences': [[a, b[1]] for a, b in zip(e['s'], t['sentences'])],
        'words': [[a, b[1]] for a, b in zip(e['w'] or [], t['words'])],
        'questions': t.get('questions', []),
    }
    out_by_file.setdefault(fname, []).append(nt)
    alltx.append(nt)
extra = set(en) - set(range(len(es)))
if extra:
    erros.append(f'índices sobrando: {sorted(extra)}')
if erros:
    print('\n'.join(erros)); sys.exit(1)

os.makedirs('content/en/textos', exist_ok=True)
for fname, arr in out_by_file.items():
    json.dump(arr, open('content/en/textos/' + fname, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
os.makedirs('data/en', exist_ok=True)
json.dump(alltx, open('data/en/textos.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'OK: {len(alltx)} textos, {sum(len(t["sentences"]) for t in alltx)} frases, {len(out_by_file)} arquivos')
