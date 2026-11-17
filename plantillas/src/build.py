import re,os
sh=open('shell.html').read(); nuc=open('nucleo.js').read()
out='/home/claude/mor/repo/plantillas'; os.makedirs(out,exist_ok=True)
for n in ['arcade','plataformas','cenital']:
    js=open(n+'.js').read()
    # niveles: igualar el largo de las filas
    def igualar(m):
        filas=m.group(1).split('\n'); L=max(len(f) for f in filas); return '`'+'\n'.join(f.ljust(L,'.') for f in filas)+'`'
    js=re.sub(r'`([.#oE^PFX\n]+)`',igualar,js)
    tit=re.search(r"titulo:'([^']+)'",js).group(1)
    open(f'{out}/{n}.html','w').write(sh.replace('%%TITULO%%',tit).replace('%%JUEGO%%',js).replace('%%NUCLEO%%',nuc))
    print(n, len(open(f'{out}/{n}.html').read()))
