import type { Root, RootContent, Image } from 'mdast';
import { inlineImages } from './markdown-images';

/** Convert only a complete img tag into a safe image node; skip all other HTML. */
export function remarkImages() {
  return (tree: Root) => {
    function visit(parent: { children: RootContent[]; type: string }) {
      parent.children = parent.children.map(node => {
        if ('children' in node) visit(node as typeof parent);
        if (node.type !== 'html') return node;
        const raw = node.value.trim();
        if (!/^<img\b/i.test(raw) || !/^<img\b(?:[^"'<>]|"[^"]*"|'[^']*')*>$/i.test(raw)) return node;
        const image = inlineImages(raw)[0]; if (!image) return node;
        const result: Image = { type: 'image', url: image.src, alt: image.alt, title: image.title, position: node.position,
          data: { hProperties: { ...(image.width ? { width: image.width } : {}), ...(image.height ? { height: image.height } : {}) } } };
        return parent.type === 'root' || parent.type === 'blockquote' ? { type: 'paragraph', children: [result], position: node.position } : result;
      });
    }
    visit(tree);
  };
}
