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
            continue
        if line.startswith('## '):
            t, tip = [x.strip() for x in line[3:].split('|', 1)]
            cur = {'title': t, 'tip': tip, 'vocab': [], 'f': [], 'b': [], 'l': [], 'q': [], 'where': where}
            u['lessons'].append(cur); sect = 'lesson'
            continue
        if line.startswith('# '):
            parts = [x.strip() for x in line[2:].split('|')]
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
        else:
            err(where, 'linha fora de lugar: ' + line)
    return units


def build_lesson(uid, i, L):
    lid = '%sl%d' % (uid, i + 1)
    w = L['where'] + ' (' + L['title'] + ')'
    rnd = random.Random(lid)
    V = L['vocab']
    if len(V) < 6: err(w, 'vocabulário com menos de 6 pares')
    if len(L['f']) != 2 or len(L['b']) != 2 or len(L['l']) != 1 or len(L['q']) != 1:
        err(w, 'precisa de 2 f, 2 b, 1 l e 1 q (tem %d/%d/%d/%d)' % (len(L['f']), len(L['b']), len(L['l']), len(L['q'])))
        return None
    sent_pt = [x['pt'] for x in L['f']] + [x[1] for x in L['b']] + [L['l'][0][1]]
    v = V[:]
    diff = [x for x in v if x[0].lower() != x[1].lower()]
    if len(diff) < 3: diff = v
    a, bq, c = diff[0], diff[1], diff[2]
    ex = []
    d = rnd.sample([x for x in v if x is not a], 2)
    ex.append({'t': 'choice', 'q': 'Como se diz "%s"?' % a[1], 'o': [a[0]] + [x[0] for x in d], 'say': '', 'oes': True})
    d = rnd.sample([x for x in v if x is not bq], 2)
    ex.append({'t': 'listen', 'es': bq[0], 'o': [bq[1]] + [x[1] for x in d]})
    f0 = L['f'][0]
    ex.append({'t': 'fill', 'es': f0['blank'], 'o': [f0['ans']] + f0['alt'], 'pt': f0['pt']})
    def far(x): return x[0].lower() != x[1].lower() and x[0][:4].lower() != x[1][:4].lower()
    pool = [x for x in v if x not in (a, bq) and far(x)]
    pool += [x for x in v if x not in pool and x not in (a, bq)]
    pool += [x for x in v if x not in pool]
    mp = pool[:4]
    ex.append({'t': 'match', 'pairs': [list(x) for x in mp]})
    b0 = L['b'][0]
    ex.append({'t': 'build', 'es': b0[0], 'pt': b0[1], 'extra': extras_for(b0[1], sent_pt, rnd)})
    les, lpt, lalt = L['l'][0]
    if len(lalt) < 2:
        lalt = [p for p in sent_pt if p != lpt][:2]
    ex.append({'t': 'listen', 'es': les, 'o': [lpt] + lalt[:2]})
    qq, qo = L['q'][0]
    if len(qo) != 3: err(w, 'pergunta precisa de 3 opções: ' + qq)
    ex.append({'t': 'choice', 'q': qq, 'o': qo, 'say': '', 'oes': True})
    f1 = L['f'][1]
    ex.append({'t': 'fill', 'es': f1['blank'], 'o': [f1['ans']] + f1['alt'], 'pt': f1['pt']})
    d = rnd.sample([x for x in v if x is not c], 2)
    ex.append({'t': 'choice', 'q': '"%s" significa:' % c[0], 'o': [c[1]] + [x[1] for x in d], 'say': c[0], 'oes': False})
    b1 = L['b'][1]
    ex.append({'t': 'build', 'es': b1[0], 'pt': b1[1], 'extra': extras_for(b1[1], sent_pt, rnd)})
    for b in (b0, b1):
        if len(b[1].split()) > 11: err(w, 'tradução longa demais para montar: ' + b[1])
    return {'id': lid, 'title': L['title'], 'tip': L['tip'], 'vocab': [list(x) for x in V], 'ex': ex}


def build_frases(uid, F, where):
    rnd = random.Random(uid + 'f')
    if len(F) < 10: err(where, 'bloco de frases com menos de 10 itens')
    items = [[x['full'], x['pt']] for x in F]
    allpt = [x['pt'] for x in F]
    fills = [x for x in F if 'blank' in x]
    plain = [x for x in F if 'blank' not in x]
    short = [x for x in plain if len(x['pt'].split()) <= 10]
    builds = short[:3]
    listens = [x for x in plain if x not in builds][:3]
    ex = []
    seq = []
    for k in range(3):
        if k < len(listens): seq.append(('l', listens[k]))
        if k < len(builds): seq.append(('b', builds[k]))
        if k < len(fills): seq.append(('f', fills[k]))
    for kind, x in seq[:8]:
        if kind == 'l':
            ex.append({'t': 'listen', 'es': x['full'], 'o': [x['pt']] + rnd.sample([p for p in allpt if p != x['pt']], 2)})
        elif kind == 'b':
            ex.append({'t': 'build', 'es': x['full'], 'pt': x['pt'], 'extra': extras_for(x['pt'], allpt, rnd)})
        else:
            ex.append({'t': 'fill', 'es': x['blank'], 'o': [x['ans']] + x['alt'], 'pt': x['pt']})
    return {'id': uid + 'f', 'title': 'Frases da unidade', 'tip': FRASES_TIP, 'items': items, 'ex': ex}


def build_texto(uid, T, where):
    rnd = random.Random(uid + 'r')
    if len(T['lines']) < 8: err(where, 'diálogo com menos de 8 falas')
    if len(T['q']) < 4: err(where, 'diálogo com menos de 4 perguntas')
    ex = []
    for qq, o in T['q']:
        if len(o) != 3: err(where, 'pergunta do diálogo sem 3 opções: ' + qq)
        ex.append({'t': 'choice', 'q': qq, 'o': o, 'say': ''})
    cands = [x for x in T['lines'] if 4 <= len(x[1].split()) <= 12]
    ln = cands[len(cands) // 2] if cands else T['lines'][2]
    others = [x[2] for x in T['lines'] if x is not ln]
    ex.append({'t': 'listen', 'es': ln[1], 'o': [ln[2]] + rnd.sample(others, 2)})
    return {'id': uid + 'r', 'title': T['title'], 'tip': TEXTO_TIP, 'lines': T['lines'], 'ex': ex}


def check_ex(where, e):
    if e['t'] in ('choice', 'listen', 'fill'):
        o = e['o']
        if len(o) != 3 or len(set(x.lower() for x in o)) != 3 or not all(o):
            err(where, 'opções repetidas ou vazias: ' + json.dumps(e, ensure_ascii=False))
    if e['t'] == 'fill' and e['es'].count('___') != 1:
        err(where, 'lacuna inválida: ' + e['es'])


def main():
    course = json.load(open(SRC, encoding='utf-8'))
    units = {}
    for fn in sorted(os.listdir(RDIR)):
        if fn.endswith('.txt'):
            for u in parse(os.path.join(RDIR, fn)):
                units[u['id']] = u
    built = 0
    for lv in course['levels']:
        for k, unit in enumerate(lv['units']):
            if unit['id'] == 'a1u1' or unit['id'] not in units:
                continue
            src = units[unit['id']]
            if src['title'] != unit['title']:
                err(src['where'], 'título diferente do mapa: %s x %s' % (src['title'], unit['title']))
            if len(src['lessons']) != 5:
                err(src['where'], 'unidade %s tem %d lições (precisa de 5)' % (src['id'], len(src['lessons'])))
            lessons = [build_lesson(src['id'], i, L) for i, L in enumerate(src['lessons'])]
            new = {'id': unit['id'], 'title': unit['title'], 'desc': src['desc'], 'lessons': [x for x in lessons if x]}
            if src.get('frases'): new['frases'] = build_frases(src['id'], src['frases'], src['where'])
            else: err(src['where'], 'sem bloco de frases')
            if src.get('texto'): new['texto'] = build_texto(src['id'], src['texto'], src['where'])
            else: err(src['where'], 'sem diálogo')
            lv['units'][k] = new
            built += 1
    for lv in course['levels']:
        for unit in lv['units']:
            blocks = unit.get('lessons', []) + [unit[x] for x in ('frases', 'texto') if unit.get(x)]
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
