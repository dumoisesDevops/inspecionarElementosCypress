const puppeteer = require('puppeteer');
const fs = require('fs');

const LOGIN_URL = 'https://front.serverest.dev/login'; // URL da página de login
const PAGE_AFTER_LOGIN = 'https://front.serverest.dev/home'; // URL após login, onde vai coletar seletores

const CREDENTIALS = {
  email: 'eduardo.moisesqa@hotmail.com',
  password: '123456',
};

function normalizeName(text) {
  return text
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toUpperCase();
}

function selectorForElement(element) {
  if (element.id) {
    // Usa seletor input[name="id"]
    if (element.tagName === 'INPUT' || element.tagName === 'BUTTON' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
      return `${element.tagName.toLowerCase()}[name="${element.id}"]`;
    }
    return `#${element.id}`;
  }
  if (element.name) {
    return `${element.tagName.toLowerCase()}[name="${element.name}"]`;
  }
  // fallback XPath, para simplificar usar tag com texto (contains)
  if (element.textContent && element.textContent.trim().length > 0) {
    let text = element.textContent.trim();
    if (text.length > 30) text = text.slice(0, 30);
    return `${element.tagName.toLowerCase()}:contains("${text}")`;
  }
  // fallback genérico
  return element.tagName.toLowerCase();
}

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Vai para página de login
  await page.goto(LOGIN_URL);

  // Faz login - adapte os seletores aqui para seu site
  await page.type('#email', CREDENTIALS.email);
  await page.type('#password', CREDENTIALS.password);
  await page.click('button[type=submit]');

  // Espera página carregada
  await page.waitForNavigation();

  // Navega para página que deseja coletar seletores (pode já estar na página correta)
  await page.goto(PAGE_AFTER_LOGIN, { waitUntil: 'networkidle2' });

  // Extrai info dos elementos da página
  const elements = await page.evaluate(() => {
    // Coleta todos inputs, buttons, selects e textareas visíveis
    const elems = Array.from(document.querySelectorAll('input, button, select, textarea'));
    return elems.map(el => {
      return {
        tagName: el.tagName,
        id: el.id || null,
        name: el.getAttribute('name') || null,
        textContent: el.textContent || '',
      };
    });
  });

  // Cria linhas da classe Cypress
  const classLines = ['class PageElements {'];
  elements.forEach(el => {
    let selector = null;

    if (el.id) {
      // Use padrão Cypress: input[name="id"]
      if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
        selector = `${el.tagName.toLowerCase()}[name="${el.id}"]`;
      } else {
        selector = `#${el.id}`;
      }
    } else if (el.name) {
      selector = `${el.tagName.toLowerCase()}[name="${el.name}"]`;
    } else if (el.textContent.trim()) {
      let text = el.textContent.trim();
      if (text.length > 30) text = text.slice(0, 30);
      selector = `${el.tagName.toLowerCase()}:contains("${text}")`;
    } else {
      selector = el.tagName.toLowerCase();
    }

    const propName = el.id || el.name || el.tagName.toLowerCase();
    const propKey = propName.toUpperCase().replace(/\W+/g, '_');

    classLines.push(`  static ${propKey} = '${selector}';`);
  });
  classLines.push('}');

  // Salva arquivo JS
  const className = 'PageElements';
  const fileName = `${className}.js`;
  fs.writeFileSync(fileName, classLines.join('\n'), 'utf8');

  console.log(`Arquivo ${fileName} gerado com sucesso!`);

  await browser.close();
})();
