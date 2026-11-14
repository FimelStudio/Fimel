import { DOMParser, onErrorStopParsing } from '@xmldom/xmldom';

export const MAX_SVG_SIZE = 1024 * 1024;
const SVG = 'http://www.w3.org/2000/svg', XLINK = 'http://www.w3.org/1999/xlink';
const tags = new Set(('svg g defs symbol use title desc path rect circle ellipse line polyline polygon text tspan textPath clipPath mask pattern linearGradient radialGradient stop filter feDropShadow feGaussianBlur feOffset feFlood feComposite feMerge feMergeNode feBlend feColorMatrix').split(' '));
const attrs = new Set(('id role aria-label aria-labelledby aria-describedby viewBox width height x y x1 x2 y1 y2 dx dy cx cy r rx ry d points transform fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset stroke-miterlimit opacity color clip-path clip-rule mask filter font-family font-size font-weight font-style text-anchor dominant-baseline alignment-baseline letter-spacing word-spacing textLength lengthAdjust startOffset offset stop-color stop-opacity gradientUnits gradientTransform spreadMethod fx fy fr patternUnits patternContentUnits patternTransform preserveAspectRatio shape-rendering vector-effect filterUnits primitiveUnits stdDeviation flood-color flood-opacity in in2 result operator mode type values k1 k2 k3 k4').split(' '));
const css = new Set(('fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset opacity color font-family font-size font-weight font-style text-anchor dominant-baseline letter-spacing word-spacing').split(' '));
const fragment = /^#[a-zA-Z_][\w.-]*$/;
const fail = () => { throw new Error('SVG 仅支持静态矢量图形，请移除脚本、外部引用、动画或不支持的标记。'); };

/** Validate, never rewrite: the accepted SVG bytes and SHA-256 stay identical. */
export function validateSvg(bytes: Uint8Array): void {
  if (!bytes.length || bytes.length > MAX_SVG_SIZE) throw new Error('SVG 每张须大于 0 且不超过 1 MiB。');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return fail(); }
  // Reject DTD/entities and processing instructions before parsing, including external stylesheets.
  const source = text.replace(/^\s*<\?xml\s+version\s*=\s*(['"])1\.0\1(?:\s+encoding\s*=\s*(['"])UTF-8\2)?\s*\?>/i, '');
  if (source.includes('<?') || /<![^-]|<!-(?!-)/.test(source) || (source.match(/</g)?.length ?? 0) > 10000) return fail();
  try {
    const doc = new DOMParser({ onError: onErrorStopParsing }).parseFromString(source, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.localName !== 'svg' || root.namespaceURI !== SVG) return fail();
    let count = 0;
    function visit(node: NonNullable<typeof root>, depth: number) {
      if (depth > 48 || ++count > 5000 || node.namespaceURI !== SVG || !tags.has(node.localName ?? '') || node.attributes.length > 64) return fail();
      for (let index = 0; index < node.attributes.length; index++) {
        const attribute = node.attributes.item(index)!, name = attribute.localName ?? attribute.name, value = attribute.value;
        if (attribute.namespaceURI === 'http://www.w3.org/2000/xmlns/') {
          if (!(attribute.name === 'xmlns' && value === SVG || attribute.name === 'xmlns:xlink' && value === XLINK)) return fail();
          continue;
        }
        if (attribute.namespaceURI && !(attribute.namespaceURI === XLINK && name === 'href')) return fail();
        if (name === 'href') { if (!fragment.test(value)) return fail(); continue; }
        if (/[\\@<>]/.test(value) || Array.from(value).some(character => character.charCodeAt(0) < 32 && !'\t\n\r'.includes(character))) return fail();
        for (const url of value.matchAll(/url\s*\(([^)]*)\)/gi)) if (!fragment.test(url[1].trim().replace(/^(['"])(.*)\1$/, '$2'))) return fail();
        if (name === 'style') {
          for (const declaration of value.split(';').filter(item => item.trim())) {
            const pair = /^\s*([a-z-]+)\s*:\s*([#\w\s.,()%+-]+)\s*$/i.exec(declaration);
            if (!pair || !(css.has(pair[1]) || /^--[a-z][a-z\d-]*$/i.test(pair[1])) || /url\s*\(/i.test(pair[2])) return fail();
          }
        } else if (!attrs.has(name)) return fail();
      }
      for (let child = node.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 1) visit(child as NonNullable<typeof root>, depth + 1);
        else if (![3, 8].includes(child.nodeType)) return fail();
      }
    }
    visit(root, 0);
    for (let node = doc.firstChild; node; node = node.nextSibling) if (node !== root && (node.nodeType !== 8 && (node.nodeType !== 3 || node.nodeValue?.trim()))) return fail();
  } catch { return fail(); }
}
