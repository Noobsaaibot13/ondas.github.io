const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const environment={window:{},document:{compatMode:'CSS1Compat'},console};
vm.runInNewContext(fs.readFileSync(path.join(root,'vendor/katex/katex-local.js'),'utf8'),environment);
const data=vm.runInNewContext(fs.readFileSync(path.join(root,'script.js'),'utf8')+'\nSECTIONS_DATA',environment);
const html=fs.readFileSync(path.join(root,fs.readdirSync(root).find(n=>n.includes('p_lsares')&&n.endsWith('.html'))),'utf8');
let formulas=0;
function verify(text) {
  for(const match of text.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g)) {
    environment.window.katex.renderToString((match[1]||match[2]).replace(/\\\\/g,'\\'),{throwOnError:true,strict:'ignore'});
    formulas++;
  }
}
for(const section of data){for(const text of section.cards)verify(text);if(section.latexFormula)verify(section.latexFormula);}
verify(html.replace(/data:image\/[^"\s]+/g,''));
for(const name of ['fisica','universidad']) {
  const svg=fs.readFileSync(path.join(root,`images/logo_${name}_recortado.svg`),'utf8');
  const embedded=svg.match(/data:image\/jpeg;base64,([^"]+)/)[1];
  if(!Buffer.from(embedded,'base64').equals(fs.readFileSync(path.join(root,`images/logo_${name}_original.jpg`))))throw new Error('Cambió el logo '+name);
}
const css=fs.readFileSync(path.join(root,'vendor/katex/katex.min.css'),'utf8');
const fonts=Array.from(css.matchAll(/url\(([^)]+\.woff2)\)/g),m=>m[1]);
for(const font of fonts)if(!fs.existsSync(path.join(root,'vendor/katex',font)))throw new Error('Falta fuente '+font);
console.log(JSON.stringify({mathFormulas:formulas,unchangedLogos:2,localFonts:fonts.length,katex:environment.window.katex.version}));
