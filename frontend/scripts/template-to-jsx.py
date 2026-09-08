"""Convert the prototype's template markup into JSX.

Mechanical, not interpretive: the point is that no hex code, spacing value or
piece of copy passes through a human. The last redesign drifted because the
prototype was read for its words and rebuilt by hand.

Handles the two template directives the runtime uses (<sc-for>, <sc-if>),
{{ expr }} holes in text and attributes, inline style strings (respecting
quotes and parens so the data-URI chevron background survives), and the void
elements JSX insists on closing.
"""
import json, re, sys
from html.parser import HTMLParser

VOID = {'br','img','input','link','meta','hr','source','area','base','col','embed','track','wbr'}
ATTR = {'class':'className','for':'htmlFor','tabindex':'tabIndex','colspan':'colSpan',
        'rowspan':'rowSpan','maxlength':'maxLength','autocomplete':'autoComplete',
        'srcset':'srcSet','contenteditable':'contentEditable','spellcheck':'spellCheck'}
HOLE = re.compile(r'^\s*\{\{(.+?)\}\}\s*$', re.S)


def split_top(s, sep):
    """Split on `sep` only at depth 0 and outside quotes."""
    out, buf, depth, q = [], [], 0, None
    for ch in s:
        if q:
            buf.append(ch)
            if ch == q: q = None
            continue
        if ch in '"\'':
            q = ch; buf.append(ch); continue
        if ch in '([': depth += 1
        elif ch in ')]': depth -= 1
        if ch == sep and depth == 0:
            out.append(''.join(buf)); buf = []
        else:
            buf.append(ch)
    if buf: out.append(''.join(buf))
    return out


def camel(prop):
    prop = prop.strip()
    if prop.startswith('--'): return None          # custom property: keep as-is via quotes
    parts = prop.split('-')
    return parts[0] + ''.join(p.capitalize() for p in parts[1:])


def style_obj(css):
    decls = []
    for d in split_top(css, ';'):
        if not d.strip(): continue
        bits = split_top(d, ':')
        if len(bits) < 2: continue
        prop, val = bits[0], ':'.join(bits[1:])
        key = camel(prop)
        val = val.strip()
        # A declaration value can itself carry a {{ hole }} -- the split-flap
        # cells and the share-card tiles set width/color/opacity that way.
        # Whole-value holes become the bare expression; mixed ones a template
        # literal. Treating these as literal text silently drops the colour.
        m = re.match(r'^\{\{(.+?)\}\}$', val.strip(), re.S)
        if m:
            js = m.group(1).strip()
        elif '{{' in val:
            js = '`' + re.sub(r'\{\{(.+?)\}\}', lambda x: '${' + x.group(1).strip() + '}', val) + '`'
        else:
            js = json.dumps(val)   # JSON string escaping is valid JS
        if key is None:
            decls.append("'%s': %s" % (prop.strip(), js))
        else:
            decls.append('%s: %s' % (key, js))
    return '{' + ', '.join(decls) + '}'


class ToJSX(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.stack = []      # tracks sc-for / sc-if so end tags close correctly

    # ---- text -------------------------------------------------------------
    def handle_data(self, data):
        # {{ expr }} holes become JSX expressions; every other brace is escaped.
        pos, buf = 0, []
        for m in re.finditer(r'\{\{(.+?)\}\}', data, re.S):
            buf.append(self.text(data[pos:m.start()]))
            buf.append('{' + m.group(1).strip() + '}')
            pos = m.end()
        buf.append(self.text(data[pos:]))
        self.out.append(''.join(buf))

    @staticmethod
    def text(s):
        return s.replace('{', '{"{"}').replace('}', '{"}"}')

    # ---- tags -------------------------------------------------------------
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'sc-for':
            lst = HOLE.match(a.get('list', '')).group(1).strip()
            it = a.get('as', 'x')
            self.out.append('{(%s || []).map((%s, _i%d) => (<React.Fragment key={_i%d}>'
                            % (lst, it, len(self.stack), len(self.stack)))
            self.stack.append('for'); return
        if tag == 'sc-if':
            val = HOLE.match(a.get('value', '')).group(1).strip()
            self.out.append('{(%s) ? (<>' % val)
            self.stack.append('if'); return

        parts = []
        for k, v in attrs:
            if k.startswith('hint-'): continue          # prototype authoring hints
            name = ATTR.get(k, k)
            if v is None:
                parts.append(name); continue
            m = HOLE.match(v)
            if k == 'style':
                parts.append('style={%s}' % style_obj(v))
            elif m:
                parts.append('%s={%s}' % (name, m.group(1).strip()))
            else:
                parts.append('%s="%s"' % (name, v.replace('"', '&quot;')))
        s = ' '.join(parts)
        self.out.append('<%s%s%s>' % (tag, (' ' + s) if s else '', ' /' if tag in VOID else ''))
        if tag not in VOID: self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID and self.stack and self.stack[-1] == tag:
            self.stack.pop(); self.out.append('</%s>' % tag)

    def handle_endtag(self, tag):
        if tag in VOID: return
        if tag in ('sc-for', 'sc-if'):
            kind = self.stack.pop()
            self.out.append('</React.Fragment>))}' if kind == 'for' else '</>) : null}')
            return
        if self.stack and self.stack[-1] == tag: self.stack.pop()
        self.out.append('</%s>' % tag)


src = open(sys.argv[1], encoding='utf-8').read().split('\n')
lo, hi = int(sys.argv[2]), int(sys.argv[3])
p = ToJSX()
p.feed('\n'.join(src[lo - 1:hi]))
p.close()
open(sys.argv[4], 'w', encoding='utf-8').write(''.join(p.out))
print('wrote %s  (%d chars, stack depth left: %d)' % (sys.argv[4], len(''.join(p.out)), len(p.stack)))
