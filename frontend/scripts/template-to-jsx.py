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
# HTMLParser lowercases attribute names, so the prototype's onChange arrives as
# `onchange`. React silently ignores lowercase on* props: the state picker
# shipped dead that way. Event handlers are camel-cased here instead.
EVENTS = {'onchange':'onChange','oninput':'onInput','onclick':'onClick','onkeydown':'onKeyDown',
          'onkeyup':'onKeyUp','onsubmit':'onSubmit','onfocus':'onFocus','onblur':'onBlur',
          'onmouseenter':'onMouseEnter','onmouseleave':'onMouseLeave','onpointerdown':'onPointerDown'}
HOLE = re.compile(r'^\s*\{\{(.+?)\}\}\s*$', re.S)

# The prototype's canvases carry no accessible name -- nine of the eleven blocks
# are canvas, so without these a screen reader gets the readouts (which are real
# HTML) but nothing at all for the pictographs. Applied in document order, which
# is block order. Kept here rather than in the generated file so re-running the
# converter against a new prototype does not silently drop them.
CANVAS_LABELS = [
    "A globe showing shipping through six straits. Gold particles move along each "
    "route at a rate set by the ships counted per day. Traffic through the Strait "
    "of Hormuz falls from 83 a day before the war to 4, while the other five "
    "straits hold near their baselines.",

    "A seismograph-style chart of the daily closing price of WTI crude through "
    "2026. The trace runs from $57 a barrel in January to a peak of $115 five "
    "weeks after the 28 February strike, falls back under the ceasefires, and "
    "climbs again when strikes resume. Red marks are his acts, blue are ceasefires.",

    "A map of the Strait of Hormuz with the real Traffic Separation Scheme lane "
    "and the 33 kilometre gate between Musandam and Larak. The lane is full of ships "
    "at the pre-war 83 a day, then nearly empty at the latest seven-day count, with "
    "one ship on screen for each ship a day. A side-by-side compares the "
    "claim of 30 ships a night against the count.",

    "Two crowds of small human figures, one figure per 10,000 jobs. The left stand "
    "shows the 2021-25 average of 320,938 jobs a month; the right shows what has "
    "actually been added each month since January 2025, a far smaller crowd. Below, "
    "100 figures show the share of the unemployed out of work six months or more.",

    "A four-row ledger of what the war has cost: 18 cream stars for US service "
    "members killed, 42 aircraft silhouettes for those lost or damaged, a bar for "
    "$37.5 billion spent against a dashed outline for the $67.1 billion more "
    "requested, and 100 triangles showing roughly one in three Patriot interceptors "
    "left.",

    "The 42 lost aircraft beside a large equals sign, and a pile of gold squares "
    "showing what the same money buys: PlayStation 5s, gallons of diesel, years of "
    "in-state tuition, Costco hot dogs. The sequence ends with the whole war's "
    "$37.5 billion as a pile roughly fourteen times larger, running off the top of "
    "the frame.",

    "A vault cage holding one gold ingot per tonne of foreign gold held at the New "
    "York Fed. Ingots leave the stack month by month as foreign governments "
    "withdraw, 159 tonnes over ten months with none coming in. Alongside, a falling "
    "blue bar shows Treasuries held for foreign officials.",
]


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
        self.canvases = 0    # index into CANVAS_LABELS

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
            name = ATTR.get(k) or EVENTS.get(k, k)
            if name.startswith('on') and name == name.lower():
                sys.exit('unmapped event attribute %r: add it to EVENTS' % name)
            if v is None:
                parts.append(name); continue
            m = HOLE.match(v)
            if k == 'style':
                parts.append('style={%s}' % style_obj(v))
            elif m:
                parts.append('%s={%s}' % (name, m.group(1).strip()))
            else:
                parts.append('%s="%s"' % (name, v.replace('"', '&quot;')))
        if tag == 'canvas' and not any(p.startswith('aria-label') for p in parts):
            if self.canvases < len(CANVAS_LABELS):
                label = CANVAS_LABELS[self.canvases].replace('"', '&quot;')
                parts += ['role="img"', 'aria-label="%s"' % label]
            self.canvases += 1
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
