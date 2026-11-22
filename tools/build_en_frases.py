"""Gera as frases em inglês (content/en/frases/*.json e data/en/frases.json).
Fonte: tools/en_src/frases_*.txt (linhas "English | nota", na mesma ordem das frases em espanhol).
A tradução em português vem da frase equivalente em espanhol, exceto onde o conteúdo foi adaptado
à cultura de língua inglesa (PT_OVERRIDE). O espanhol não é tocado."""
import json, glob, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'en_src')

PT_OVERRIDE = {
  '17-banco': {17: 'Não aceitamos notas de cem dólares.'},
  '21-email-telefone': {0: 'Prezado senhor Smith,'},
  '23-vendas': {11: 'O frete é grátis em pedidos acima de cem dólares.'},
  '25-comida': {0: 'Como se faz torta de maçã?', 4: 'Peixe com batata frita é um prato típico britânico.', 5: 'Adoro hambúrguer.',
                6: 'O clam chowder é feito com mariscos e creme.', 10: 'Preaqueça o forno a 350 graus Fahrenheit.',
                11: 'As tortas são assadas no forno.', 12: 'Hoje vou fazer panquecas.', 17: 'No café da manhã como torrada com ovos.'},
  '26-esportes': {1: 'Sou torcedor dos Lakers.'},
  '29-cinema-musica': {8: 'Adoro música pop.', 14: 'O jazz nasceu em Nova Orleans.', 19: 'Me recomenda uma série boa?'},
  '30-historia-sociedade': {0: 'Os Estados Unidos declararam independência em 1776.', 3: 'Os romanos construíram a Muralha de Adriano na Grã-Bretanha.',
                            4: 'O inglês é falado em mais de cinquenta países.', 8: 'Stonehenge foi construído há milhares de anos.',
                            10: 'O Dia de Ação de Graças é uma tradição americana.', 15: 'Martin Luther King Jr. lutou pelos direitos civis.',
                            19: 'O 4 de Julho é muito importante nos Estados Unidos.'},
}

def parse():
    out = {}
    for f in sorted(glob.glob(os.path.join(SRC, 'frases_*.txt'))):
        cur = None
        for line in open(f, encoding='utf-8'):
            line = line.rstrip('\n')
            if not line.strip(): continue
            if line.startswith('## '):
                cur = line[3:].strip(); out[cur] = []; continue
            en, nota = [x.strip() for x in line.split(' | ', 1)]
            out[cur].append((en, nota))
    return out

def main():
    en = parse()
    os.makedirs(os.path.join(ROOT, 'content', 'en', 'frases'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'data', 'en'), exist_ok=True)
    allc = []; errs = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'content', 'frases', '*.json'))):
        stem = os.path.basename(f)[:-5]
        es = json.load(open(f, encoding='utf-8'))
        rows = en.get(stem)
        if rows is None: errs.append('faltando ' + stem); continue
        if len(rows) != len(es['items']): errs.append('%s: %d em inglês, %d em espanhol' % (stem, len(rows), len(es['items'])))
        ov = PT_OVERRIDE.get(stem, {})
        items = []
        for i, (t, nota) in enumerate(rows):
            pt = ov.get(i, es['items'][i]['pt'] if i < len(es['items']) else '')
            if not t or not pt or not nota: errs.append('%s[%d] vazio' % (stem, i))
            items.append({'es': t, 'pt': pt, 'nota': nota})  # campo "es" = frase no idioma estudado
        cat = {'id': es['id'], 'name': es['name'], 'group': es['group'], 'items': items}
        json.dump(cat, open(os.path.join(ROOT, 'content', 'en', 'frases', stem + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        allc.append(cat)
    seen = {}
    for c in allc:
        for it in c['items']:
            k = it['es'].lower()
            if k in seen: errs.append('repetida: %s (%s e %s)' % (it['es'], seen[k], c['id']))
            seen[k] = c['id']
    if errs:
        print('\n'.join(errs)); sys.exit(1)
    json.dump(allc, open(os.path.join(ROOT, 'data', 'en', 'frases.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('ok:', len(allc), 'categorias,', sum(len(c['items']) for c in allc), 'frases')

main()
