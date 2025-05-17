const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

function formatName(tag, label) {
  return (
    tag.toUpperCase() +
    '_' +
    label
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  );
}

(async () => {
  const url = process.argv[2];
  const className = process.argv[3] || 'GeneratedPage';

  if (!url) {
    console.error('❌ Informe a URL como primeiro argumento');
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle0' });

  const elements = await page.$$eval(
    'input, button, select, textarea, a, label',
    (nodes) =>
      nodes.map((el) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id,
        name: el.name,
        text: el.innerText.trim(),
        type: el.type || '',
        classes: el.className || '',
      }))
  );

  const output = [];
  const usedKeys = new Set();

  elements.forEach((el, i) => {
    let selector = '';
    let key = '';

    if (el.name) {
      selector = `${el.tag}[name="${el.name}"]`;
      key = formatName(el.tag, el.name);
    } else if (el.id) {
      selector = `${el.tag}#${el.id}`;
      key = formatName(el.tag, el.id);
    } else if (el.text && el.tag === 'button') {
      selector = `${el.tag}:contains("${el.text}")`;
      key = formatName(el.tag, el.text);
    } else {
      // fallback para XPath (não usado diretamente em Cypress, só placeholder)
      selector = `xpath=//${el.tag}[${i + 1}]`;
      key = formatName(el.tag, `unknown_${i + 1}`);
    }

    if (!usedKeys.has(key)) {
      usedKeys.add(key);
      output.push(`  static ${key} = '${selector}';`);
    }
  });

  const finalClass = `export class ${className} {\n${output.join('\n')}\n}\n`;

  const filename = `${className}.js`;
  fs.writeFileSync(path.join(process.cwd(), filename), finalClass);

  console.log(`✅ Arquivo '${filename}' criado com sucesso!`);

  await browser.close();
})();
