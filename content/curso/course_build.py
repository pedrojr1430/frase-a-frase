#!/usr/bin/env python3
"""Gera content/curso/curso.json e data/curso.json a partir dos roteiros em content/curso/roteiros/*.txt.

A unidade a1u1 (escrita à mão) é mantida como está no curso.json. As demais vêm dos roteiros.

Formato do roteiro (uma linha por item; linhas vazias e linhas com // são ignoradas):

  # a1u2 | Título da unidade | Descrição curta
  ## Título da lição | Dica (em português)
  v es = pt; es = pt; ...            (6 a 8 pares de vocabulário)
  f Frase com [palavra] = Tradução ~ errada1, errada2      (completar; 2 por lição)
  b Frase = Tradução                  (montar a tradução; 2 por lição)
  l Frase = Tradução ~ errada1 | errada2                  (ouvir e escolher; 1 por lição)
  q Pergunta em português? = Certa | Errada | Errada      (situação, opções em espanhol; 1 por lição)
  ### frases
  fr Frase = Tradução                 (10 frases; até 2 com [palavra] ~ e1, e2)
  ### texto | Título do diálogo
  t Nome | Frase = Tradução           (8 a 12 falas)
  tq Pergunta? = Certa | Errada | Errada   (4 perguntas, opções em português)
"""
import json, os, random, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, 'curso.json')
OUT_DATA = os.path.join(ROOT, 'data', 'curso.json')
RDIR = os.path.join(HERE, 'roteiros')

FRASES_TIP = 'Agora as frases ficam mais longas: juntam o que você aprendeu nas lições. Ouça cada uma, repita em voz alta e depois responda aos exercícios.'
TEXTO_TIP = 'Leia e ouça o diálogo completo. Use o player para ouvir frase a frase, com a tradução se precisar. Depois, responda às perguntas.'

errors = []


def err(where, msg):
    errors.append(where + ': ' + msg)


def split_eq(s, where):
    if ' = ' not in s:
        err(where, 'falta " = " em: ' + s)
        return s, ''
    a, b = s.split(' = ', 1)
    return a.strip(), b.strip()


def words(s):
    return [w.strip('.,;:!?¿¡«»"()').lower() for w in s.split() if w.strip('.,;:!?¿¡«»"()')]


def parse_fill(body, where):
    alt = []
    if ' ~ ' in body:
        body, a = body.split(' ~ ', 1)
        alt = [x.strip() for x in a.split(',') if x.strip()]
    es, pt = split_eq(body, where)
    m = re.search(r'\[([^\]]+)\]', es)
    if not m:
        err(where, 'frase de completar sem [palavra]: ' + es)
        return None
    if len(alt) < 2:
        err(where, 'completar precisa de 2 opções erradas: ' + es)
    full = es.replace('[', '').replace(']', '')
    return {'full': full, 'blank': es[:m.start()] + '___' + es[m.end():], 'ans': m.group(1), 'alt': alt[:2], 'pt': pt}


def extras_for(pt, pool, rnd):
    have = set(words(pt))
    cand = []
    for s in pool:
        for w in words(s):
            if w not in have and w not in cand and len(w) > 2:
                cand.append(w)
    rnd.shuffle(cand)
    return cand[:2] if len(cand) >= 2 else (cand + ['não', 'muito'])[:2]


def parse(path):
    units, u, cur, sect = [], None, None, None
    for n, raw in enumerate(open(path, encoding='utf-8'), 1):
        line = raw.strip()
        if not line or line.startswith('//'):
            continue
        where = os.path.basename(path) + ':' + str(n)
        if line.startswith('### '):
            head = line[4:]
            if head.startswith('frases'):
                sect = 'frases'; u['frases'] = []
            elif head.startswith('texto'):
                sect = 'texto'; u['texto'] = {'title': head.split('|', 1)[1].strip(), 'lines': [], 'q': []}
            elif head.startswith('leitura'):
                sect = 'leitura'; u['leitura'] = {'title': head.split('|', 1)[1].strip(), 'lines': [], 'q': [], 'tf': []}
            continue
        if line.startswith('## '):
            t, tip = [x.strip() for x in line[3:].split('|', 1)]
            cur = {'title': t, 'tip': tip, 'vocab': [], 'f': [], 'b': [], 'l': [], 'q': [], 'where': where}
            u['lessons'].append(cur); sect = 'lesson'
            continue
        if line.startswith('# '):
            parts = [x.strip() for x in line[2:].split('|')] + ['', '']
            u = {'id': parts[0], 'title': parts[1], 'desc': parts[2], 'lessons': [], 'where': where}
            units.append(u); sect = None
            continue
        tag, _, body = line.partition(' ')
        body = body.strip()
        if sect == 'lesson':
            if tag == 'v':
                for p in body.split(';'):
                    if p.strip():
                        cur['vocab'].append(list(split_eq(p.strip(), where)))
            elif tag == 'f':
                x = parse_fill(body, where)
                if x: cur['f'].append(x)
            elif tag == 'b':
                cur['b'].append(split_eq(body, where))
            elif tag == 'l':
                alt = []
                if ' ~ ' in body:
                    body, a = body.split(' ~ ', 1); alt = [x.strip() for x in a.split('|')]
                es, pt = split_eq(body, where); cur['l'].append((es, pt, alt))
            elif tag == 'q':
                qq, a = split_eq(body, where); cur['q'].append((qq, [x.strip() for x in a.split('|')]))
            else:
                err(where, 'linha desconhecida na lição: ' + line)
        elif sect == 'frases' and tag == 'fr':
            if '[' in body:
                x = parse_fill(body, where)
                if x: u['frases'].append(x)
            else:
                es, pt = split_eq(body, where); u['frases'].append({'full': es, 'pt': pt})
        elif sect == 'texto' and tag == 't':
            who, rest = body.split('|', 1)
            es, pt = split_eq(rest.strip(), where); u['texto']['lines'].append([who.strip(), es, pt])
        elif sect == 'texto' and tag == 'tq':
            qq, a = split_eq(body, where); u['texto']['q'].append((qq, [x.strip() for x in a.split('|')]))
        elif sect == 'leitura' and tag == 'n':
            es, pt = split_eq(body, where); u['leitura']['lines'].append(['', es, pt])
        elif sect == 'leitura' and tag == 'tq':
            qq, a = split_eq(body, where); u['leitura']['q'].append((qq, [x.strip() for x in a.split('|')]))
        elif sect == 'leitura' and tag == 'tv':
            qq, a = split_eq(body, where)
            if a not in ('V', 'F'): err(where, 'tv precisa terminar em = V ou = F')
            u['leitura']['tf'].append((qq, a == 'V'))
        else:
            err(where, 'linha fora de lugar: ' + line)
    return units


LEVEL_OF = lambda uid: uid[:2].upper()


def es_extras(es, pool, rnd, n=2):
    have = set(words(es))
    cand = []
    for s_ in pool:
        for k, w in enumerate(s_.split()):
            if k == 0:
                continue  # evita palavras com maiúscula de início de frase
            c = w.strip('.,;:!?¿¡«»"()')
            if c and c.lower() not in have and c not in cand and len(c) > 2:
                cand.append(c)
    rnd.shuffle(cand)
    return cand[:n]


class Mk:
    """Fábrica de exercícios de uma lição ou bloco."""
    def __init__(self, rnd, es_pool, pt_pool):
        self.rnd, self.es_pool, self.pt_pool = rnd, es_pool, pt_pool

    def order(self, es, pt):
        return {'t': 'order', 'pt': pt, 'es': es, 'extra': es_extras(es, self.es_pool, self.rnd)}

    def build(self, es, pt):
        return {'t': 'build', 'es': es, 'pt': pt, 'extra': extras_for(pt, self.pt_pool, self.rnd)}

    def type(self, es, pt):
        return {'t': 'type', 'pt': pt, 'es': es}

    def dict(self, es, pt):
        return {'t': 'dictation', 'es': es, 'pt': pt}

    def speak(self, es, pt):
        return {'t': 'speak', 'es': es, 'pt': pt}

    def listen(self, es, pt, alt):
        if len(alt) < 2:
            alt = self.rnd.sample([p for p in self.pt_pool if p != pt], 2)
        return {'t': 'listen', 'es': es, 'o': [pt] + alt[:2]}

    def fill(self, f):
        return {'t': 'fill', 'es': f['blank'], 'o': [f['ans']] + f['alt'], 'pt': f['pt']}


def nwords(s_):
    return len(s_.split())


def build_lesson(uid, i, L):
    lid = '%sl%d' % (uid, i + 1)
    lvl = LEVEL_OF(uid)
    w = L['where'] + ' (' + L['title'] + ')'
    rnd = random.Random(lid)
    V = L['vocab']
    if len(V) < 6: err(w, 'vocabulário com menos de 6 pares')
    if len(L['f']) != 2 or len(L['b']) != 2 or len(L['l']) != 1 or len(L['q']) != 1:
        err(w, 'precisa de 2 f, 2 b, 1 l e 1 q (tem %d/%d/%d/%d)' % (len(L['f']), len(L['b']), len(L['l']), len(L['q'])))
        return None
    f0, f1 = L['f']; b0, b1 = L['b']; les, lpt, lalt = L['l'][0]; qq, qo = L['q'][0]
    if len(qo) != 3: err(w, 'pergunta precisa de 3 opções: ' + qq)
    es_pool = [f0['full'], f1['full'], b0[0], b1[0], les] + [x[0] for x in V]
    pt_pool = [f0['pt'], f1['pt'], b0[1], b1[1], lpt]
    mk = Mk(rnd, es_pool, pt_pool)
    v = V[:]
    diff = [x for x in v if x[0].lower() != x[1].lower()]
    if len(diff) < 3: diff = v
    a, bq, c = diff[0], diff[1], diff[2]
    short = [x for x in diff if nwords(x[0]) <= 3 and x not in (a, bq, c)] or [x for x in v if nwords(x[0]) <= 3] or v
    d = short[0]
    d2 = short[1] if len(short) > 1 else d
    def far(x): return x[0].lower() != x[1].lower() and x[0][:4].lower() != x[1][:4].lower()
    pool = [x for x in v if x not in (a, bq) and far(x)]
    pool += [x for x in v if x not in pool and x not in (a, bq)]
    pool += [x for x in v if x not in pool]
    E = {
        'cv': lambda: {'t': 'choice', 'q': 'Como se diz "%s"?' % a[1], 'o': [a[0]] + [x[0] for x in rnd.sample([y for y in v if y is not a], 2)], 'say': '', 'oes': True},
        'lv': lambda: {'t': 'listen', 'es': bq[0], 'o': [bq[1]] + [x[1] for x in rnd.sample([y for y in v if y is not bq], 2)]},
        'means': lambda: {'t': 'choice', 'q': '"%s" significa:' % c[0], 'o': [c[1]] + [x[1] for x in rnd.sample([y for y in v if y is not c], 2)], 'say': c[0], 'oes': False},
        'match': lambda: {'t': 'match', 'pairs': [list(x) for x in pool[:4]]},
        'fill0': lambda: mk.fill(f0), 'fill1': lambda: mk.fill(f1),
        'q': lambda: {'t': 'choice', 'q': qq, 'o': qo, 'say': '', 'oes': True},
        'listenL': lambda: mk.listen(les, lpt, lalt),
        'build_b0': lambda: mk.build(*b0), 'build_b1': lambda: mk.build(*b1), 'build_f0': lambda: mk.build(f0['full'], f0['pt']),
        'order_b0': lambda: mk.order(*b0), 'order_b1': lambda: mk.order(*b1), 'order_f1': lambda: mk.order(f1['full'], f1['pt']),
        'type_b0': lambda: mk.type(*b0) if nwords(b0[0]) <= 10 else mk.order(*b0),
        'type_b1': lambda: mk.type(*b1) if nwords(b1[0]) <= 10 else mk.order(*b1),
        'typeword_a': lambda: mk.type(a[0], a[1]) if nwords(a[0]) <= 4 else mk.type(d[0], d[1]),
        'typeword_d': lambda: mk.type(d[0], d[1]),
        'typeword_bq': lambda: mk.type(bq[0], bq[1]) if nwords(bq[0]) <= 4 else mk.type(d2[0], d2[1]),
        'dict_b0': lambda: mk.dict(*b0), 'dict_L': lambda: mk.dict(les, lpt), 'dict_f0': lambda: mk.dict(f0['full'], f0['pt']),
        'speak_b0': lambda: mk.speak(*b0), 'speak_b1': lambda: mk.speak(*b1), 'speak_f0': lambda: mk.speak(f0['full'], f0['pt']), 'speak_L': lambda: mk.speak(les, lpt),
    }
    T = {
        'A1': ['cv', 'lv', 'match', 'fill0', 'build_b0', 'listenL', 'order_b1', 'q', 'fill1', 'means', 'speak_b0', 'typeword_d'],
        'A2': ['cv', 'match', 'fill0', 'order_b0', 'listenL', 'build_b1', 'q', 'typeword_d', 'fill1', 'means', 'dict_b0', 'speak_f0', 'order_f1'],
        'B1': ['match', 'fill0', 'order_b0', 'dict_L', 'q', 'typeword_a', 'type_b1', 'fill1', 'build_f0', 'speak_b0', 'order_f1', 'means', 'typeword_bq', 'speak_L'],
        'B2': ['match', 'fill0', 'type_b0', 'dict_L', 'order_f1', 'q', 'typeword_a', 'type_b1', 'fill1', 'speak_b1', 'typeword_bq', 'dict_f0', 'means', 'speak_L'],
    }[lvl]
    ex = [E[k]() for k in T]
    for b in (b0, b1):
        if nwords(b[1]) > 11: err(w, 'tradução longa demais para montar: ' + b[1])
    return {'id': lid, 'title': L['title'], 'tip': L['tip'], 'vocab': [list(x) for x in V], 'ex': ex}


def build_frases(uid, F, where):
    rnd = random.Random(uid + 'f')
    lvl = LEVEL_OF(uid)
    if len(F) < 10: err(where, 'bloco de frases com menos de 10 itens')
    items = [[x['full'], x['pt']] for x in F]
    allpt = [x['pt'] for x in F]
    mk = Mk(rnd, [x['full'] for x in F], allpt)
    fills = [x for x in F if 'blank' in x]
    plain = [x for x in F if 'blank' not in x]
    plan = {
        'A1': ['l', 'b', 'f', 'l', 'o', 'b', 'f', 'l', 's'],
        'A2': ['l', 'b', 'f', 'o', 'd', 'b', 'f', 'o', 'l', 's'],
        'B1': ['l', 'o', 'f', 'd', 'b', 'f', 'o', 'y', 'd', 'l', 's'],
        'B2': ['o', 'f', 'd', 'y', 'l', 'f', 'd', 'o', 'y', 's', 's'],
    }[lvl]
    used = set(); ex = []; fi = 0
    def pick(maxw=99):
        for x in plain:
            if id(x) not in used and nwords(x['full']) <= maxw:
                used.add(id(x)); return x
        for x in plain:
            if nwords(x['full']) <= maxw: return x
        return plain[0]
    for k in plan:
        if k == 'f':
            if fi < len(fills): ex.append(mk.fill(fills[fi])); fi += 1
            continue
        if k == 'l':
            x = pick(); ex.append(mk.listen(x['full'], x['pt'], []))
        elif k == 'b':
            x = pick(12); ex.append(mk.build(x['full'], x['pt']))
        elif k == 'o':
            x = pick(12); ex.append(mk.order(x['full'], x['pt']))
        elif k == 'd':
            x = pick(14); ex.append(mk.dict(x['full'], x['pt']))
        elif k == 'y':
            x = pick(10); ex.append(mk.type(x['full'], x['pt']))
        elif k == 's':
            x = pick(14); ex.append(mk.speak(x['full'], x['pt']))
    return {'id': uid + 'f', 'title': 'Frases da unidade', 'tip': FRASES_TIP, 'items': items, 'ex': ex}


def dialog_extras(T, rnd, lvl, mk):
    ex = []
    lines = T['lines']
    speakers = []
    for x in lines:
        if x[0] and x[0] not in speakers: speakers.append(x[0])
    # quem disse
    if len(speakers) >= 2:
        cand = [x for x in lines if 4 <= nwords(x[1]) <= 14]
        if cand:
            ln = cand[len(cand) // 3]
            others = [s_ for s_ in speakers if s_ != ln[0]][:2]
            ex.append({'t': 'choice', 'q': 'Quem diz: "%s"' % ln[1], 'o': [ln[0]] + others, 'say': ln[1], 'oes': False})
    # qual é a resposta (próxima fala)
    n_next = 1 if lvl in ('A1', 'A2') else 2
    idxs = [k for k in range(len(lines) - 1) if lines[k][0] != lines[k + 1][0] and '?' in lines[k][1] and nwords(lines[k][1]) >= 2]
    rnd.shuffle(idxs)
    for k in sorted(idxs[:n_next]):
        wrong = [x[1] for j, x in enumerate(lines) if j not in (k, k + 1) and x[0] == lines[k + 1][0]]
        if len(wrong) < 2:
            wrong = [x[1] for j, x in enumerate(lines) if j not in (k, k + 1)]
        wrong = rnd.sample(wrong, 2)
        ex.append({'t': 'choice', 'q': '%s pergunta: "%s" Qual é a resposta?' % (lines[k][0], lines[k][1]), 'o': [lines[k + 1][1]] + wrong, 'say': lines[k][1], 'oes': True})
    return ex


def build_texto(uid, T, where, suffix='r', narrative=False):
    rnd = random.Random(uid + suffix)
    lvl = LEVEL_OF(uid)
    lines = T['lines']
    minl = {'A1': 6, 'A2': 8, 'B1': 10, 'B2': 12}[lvl] if narrative else 8
    if len(lines) < minl: err(where, '%s com %d frases (mínimo %d no %s)' % ('leitura' if narrative else 'diálogo', len(lines), minl, lvl))
    if len(T['q']) < (3 if narrative else 4): err(where, 'poucas perguntas em ' + T['title'])
    mk = Mk(rnd, [x[1] for x in lines], [x[2] for x in lines])
    ex = []
    for qq, o in T['q']:
        if len(o) != 3: err(where, 'pergunta sem 3 opções: ' + qq)
        ex.append({'t': 'choice', 'q': qq, 'o': o, 'say': ''})
    for st_, val in T.get('tf', []):
        ex.append({'t': 'choice', 'q': 'Verdadeiro ou falso? ' + st_, 'o': ['Verdadeiro', 'Falso'] if val else ['Falso', 'Verdadeiro'], 'say': ''})
    if not narrative:
        ex += dialog_extras(T, rnd, lvl, mk)
    cands = [x for x in lines if 4 <= nwords(x[1]) <= 12]
    if not cands: cands = lines
    ln = cands[len(cands) // 2]
    ex.append(mk.listen(ln[1], ln[2], []))
    rest = [x for x in cands if x is not ln]
    if rest:
        if narrative or lvl != 'A1':
            o = rest[0]; ex.append(mk.order(o[1], o[2]))
        if lvl in ('A2', 'B1', 'B2') and len(rest) > 1:
            dd = rest[-1]; ex.append(mk.dict(dd[1], dd[2]))
        if lvl in ('B1', 'B2') and len(rest) > 2:
            sp = rest[len(rest) // 2]; ex.append(mk.speak(sp[1], sp[2]))
    tip = TEXTO_TIP if not narrative else 'Leia e ouça o texto com calma. Use o player para ouvir frase a frase e mostre a tradução só se precisar. Depois, responda às perguntas.'
    return {'id': uid + suffix, 'title': T['title'], 'tip': tip, 'lines': lines, 'ex': ex}


def enhance_handmade(unit):
    """Acrescenta exercícios de montar e falar às lições escritas à mão (a1u1), sem mudar as existentes."""
    for l in unit['lessons']:
        if any(e['t'] in ('order', 'speak') for e in l['ex']):
            continue
        rnd = random.Random(l['id'] + 'x')
        builds = [e for e in l['ex'] if e['t'] == 'build']
        pool = [e['es'] for e in builds] + [v[0] for v in l['vocab']]
        mk = Mk(rnd, pool, [e['pt'] for e in builds])
        if builds:
            l['ex'].append(mk.order(builds[0]['es'], builds[0]['pt']))
            l['ex'].append(mk.speak(builds[-1]['es'], builds[-1]['pt']))


def check_ex(where, e):
    if e['t'] in ('choice', 'listen', 'fill'):
        o = e['o']
        n = 2 if (e['t'] == 'choice' and len(o) == 2) else 3
        if len(o) != n or len(set(x.lower() for x in o)) != n or not all(o):
            err(where, 'opções repetidas ou vazias: ' + json.dumps(e, ensure_ascii=False))
    if e['t'] == 'fill' and e['es'].count('___') != 1:
        err(where, 'lacuna inválida: ' + e['es'])


def main():
    course = json.load(open(SRC, encoding='utf-8'))
    units = {}
    for fn in sorted(os.listdir(RDIR)):
        if fn.endswith('.txt'):
            for u in parse(os.path.join(RDIR, fn)):
                if u['id'] in units and not u['lessons']:
                    units[u['id']]['leitura'] = u.get('leitura')
                elif u['id'] in units:
                    u['leitura'] = u.get('leitura') or units[u['id']].get('leitura'); units[u['id']] = u
                else:
                    units[u['id']] = u
    built = 0
    for lv in course['levels']:
        for k, unit in enumerate(lv['units']):
            if unit['id'] == 'a1u1':
                enhance_handmade(unit)
                src = units.get('a1u1')
                if src and src.get('leitura'):
                    unit['texto2'] = build_texto('a1u1', src['leitura'], src['where'], 'r2', True)
                continue
            if unit['id'] not in units:
                continue
            src = units[unit['id']]
            if src['title'] != unit['title'] and src['id'] != 'a1u1':
                err(src['where'], 'título diferente do mapa: %s x %s' % (src['title'], unit['title']))
            if len(src['lessons']) != 5:
                err(src['where'], 'unidade %s tem %d lições (precisa de 5)' % (src['id'], len(src['lessons'])))
            lessons = [build_lesson(src['id'], i, L) for i, L in enumerate(src['lessons'])]
            new = {'id': unit['id'], 'title': unit['title'], 'desc': src['desc'], 'lessons': [x for x in lessons if x]}
            if src.get('frases'): new['frases'] = build_frases(src['id'], src['frases'], src['where'])
            else: err(src['where'], 'sem bloco de frases')
            if src.get('texto'): new['texto'] = build_texto(src['id'], src['texto'], src['where'])
            else: err(src['where'], 'sem diálogo')
            if src.get('leitura'): new['texto2'] = build_texto(src['id'], src['leitura'], src['where'], 'r2', True)
            else: err(src['where'], 'sem leitura narrativa')
            lv['units'][k] = new
            built += 1
    for lv in course['levels']:
        for unit in lv['units']:
            blocks = unit.get('lessons', []) + [unit[x] for x in ('frases', 'texto', 'texto2') if unit.get(x)]
            for b in blocks:
                for e in b['ex']:
                    check_ex(unit['id'] + '/' + b['id'], e)
    missing = [u['id'] for lv in course['levels'] for u in lv['units'] if not u.get('lessons')]
    if errors:
        print('\n'.join(errors)); print(len(errors), 'erro(s). Nada foi gravado.'); sys.exit(1)
    json.dump(course, open(SRC, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(OUT_DATA, 'w', encoding='utf-8').write(json.dumps(course, ensure_ascii=False, separators=(',', ':')))
    print('ok: %d unidades geradas; sem conteúdo: %s' % (built, ', '.join(missing) or 'nenhuma'))


if __name__ == '__main__':
    main()
