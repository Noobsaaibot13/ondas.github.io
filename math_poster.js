/* Adaptador local para el contenido matemático del póster, sin conexión externa. */
window.renderMathInElement = function renderPosterMath(root) {
  if (!window.katex) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeValue.includes('$') && !node.parentElement.closest('script, style, pre, code, textarea, .katex')
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue;
    const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
    const fragment = document.createDocumentFragment();
    let match, last = 0, found = false;
    while ((match = pattern.exec(text))) {
      found = true;
      fragment.append(document.createTextNode(text.slice(last, match.index)));
      const target = document.createElement('span');
      window.katex.render((match[1] || match[2]).replace(/\\\\/g, '\\'), target, {
        displayMode: Boolean(match[1]), throwOnError: false, strict: 'ignore'
      });
      fragment.append(target);
      last = pattern.lastIndex;
    }
    if (found) { fragment.append(document.createTextNode(text.slice(last))); node.replaceWith(fragment); }
  }
};
