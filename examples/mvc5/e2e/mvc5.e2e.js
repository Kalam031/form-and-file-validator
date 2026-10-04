'use strict';
/*
 * End-to-end trial of the ASP.NET MVC 5 sample, against the site that is running (Mono in Docker, IIS Express or IIS):
 *   BASE_URL=http://localhost:8081 node --test examples/mvc5/e2e/mvc5.e2e.js
 * A real browser types into the form and the same values are POSTed to the server. For every input the errors of the BROWSER
 * (FormValidator in JavaScript) and of the SERVER (ModelState, FormAndFileValidator in .NET) must be identical: same fields, same messages.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, firefox, webkit } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:8081';
const GOOD = { FirstName: 'John', Email: 'john@example.com', Password: 'Abcdefg1', ConfirmPassword: 'Abcdefg1', BirthDate: '29/2/2000', Website: 'https://example.com' };
const rows = (field, values) => values.map(v => Object.assign({}, GOOD, { [field]: v }));

const CASES = [
    GOOD,
    // email
    ...rows('Email', ['', 'a@b', 'a@b.co', 'ü@bücher.de', 'a b@c.de', '@b.co', ' john@example.com ']),
    // names: letters of every alphabet, not digits or spaces
    ...rows('FirstName', ['', 'J', 'Jo', 'J0hn', 'Ünal', 'İlker', 'Иван', '日本語', 'مرحبا', 'Jo hn', '𠮷野']),
    // password rules: capital letter of any script, digit, length
    ...rows('Password', ['', 'abcdefgh', 'ABCDEFGH1', 'Abcdefg', 'Abcdefg1', 'İlkerlik1', 'Дdddddd٣', 'Abcdef٣g']).map(r => Object.assign(r, { ConfirmPassword: r.Password })),
    { ...GOOD, ConfirmPassword: 'Abcdefg2' },
    { ...GOOD, ConfirmPassword: '' },
    // dates in d/M/y: leap years, month lengths, formats
    ...rows('BirthDate', ['', '29/2/2000', '29/2/2001', '31/4/2024', '31/12/1999', '5/3/2024', '05/03/2024', '2024-03-05', '5-3-2024', '0/1/2024', '32/1/2024', '1/13/2024', '1/1/10000', '31/12/2999']),
    // urls: optional field, browser parsers disagree on some of these
    ...rows('Website', ['', 'example.com', 'https://example.com/a?b=c#d', 'http://exa%20mple.com', 'http://exa mple.com', 'ftp://x.com', 'http://localhost', 'http://256.1.1.1', 'http://0x7f.0.0.1', 'https://例え.jp', 'http://[::1]', 'javascript:alert(1)'])
];

const ENGINES = [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]];

/** the per-field messages the server rendered (ModelState) */
const serverErrors = html => {
    const out = {};
    for (const m of html.matchAll(/<span[^>]*data-for="(\w+)"[^>]*>([^<]*)<\/span>/g)) if (m[2].trim()) out[m[1]] = m[2].trim().replace(/&#39;|&amp;|&quot;/g, c => ({ '&#39;': "'", '&amp;': '&', '&quot;': '"' })[c]);
    return out;
};

for (const [name, engine] of ENGINES) {
    describe('ASP.NET MVC 5 sample in ' + name, () => {
        let browser, context;
        before(async () => { browser = await engine.launch(); context = await browser.newContext(); });
        after(async () => { if (browser) await browser.close(); });

        it('the page is served and carries the rules written from the model', async () => {
            const page = await context.newPage();
            const response = await page.goto(BASE + '/Account/Signup');
            assert.equal(response.status(), 200);
            const text = await page.content();
            assert.match(text, /FormValidator\.init\(\{ formId: "signup", rules: \{"Email"/);
            assert.equal(await page.evaluate(() => typeof window.FormValidator), 'object');
            await page.close();
        });

        it('AJAX page: nothing is sent while invalid, a server-only rule shows on the field, a good submission succeeds', async () => {
            const page = await context.newPage();
            let posts = 0;
            page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/Account/SignupAjax')) posts++; });
            await page.goto(BASE + '/Account/SignupAjax');
            const fillAll = async v => { for (const [field, value] of Object.entries(v)) await page.fill('#' + field, value); };

            await fillAll({ ...GOOD, Email: 'not an email' });
            await page.click('#go');
            await page.waitForSelector('.error[data-error-for=Email]:not(:empty)');
            await page.waitForTimeout(300);
            assert.equal(posts, 0, 'the browser stops an invalid form: nothing is sent');

            await fillAll({ ...GOOD, Email: 'taken@example.com' });                  // valid for the browser, refused by a rule only the server knows
            await page.click('#go');
            await page.waitForFunction(() => (document.querySelector('.error[data-error-for=Email]') || {}).textContent === 'Already registered');
            assert.equal(posts, 1);
            assert.equal(page.url().endsWith('/Account/SignupAjax'), true, 'AJAX: the page did not navigate');

            await fillAll({ ...GOOD, Email: 'free@example.com' });
            await page.click('#go');
            await page.waitForFunction(() => document.getElementById('result').textContent === 'Welcome, John!');
            assert.equal(posts, 2);
            await page.close();
        });

        it('browser and server give identical errors for ' + CASES.length + ' form submissions', async () => {
            const page = await context.newPage();
            const different = [];
            for (const values of CASES) {
                // the server: a real POST through the MVC pipeline
                const res = await context.request.post(BASE + '/Account/Signup', { form: values });
                const html = await res.text();
                const server = serverErrors(html);
                const serverOk = /id="welcome"/.test(html);

                // the browser: the user types and presses the button
                await page.goto(BASE + '/Account/Signup');
                for (const [field, v] of Object.entries(values)) await page.fill('#' + field, v);
                await page.click('#go');
                // either the next page (accepted) or the first error message appears
                await page.waitForSelector('#welcome, .error[data-error-for]:not(:empty)', { timeout: 8000 }).catch(() => { /* reported by the comparison below */ });
                const welcomed = await page.locator('#welcome').count();
                const client = welcomed ? {} : await page.evaluate(() => {
                    const map = {};
                    document.querySelectorAll('.error[data-error-for]').forEach(e => { if (e.textContent.trim()) map[e.getAttribute('data-error-for')] = e.textContent.trim(); });
                    return map;
                });
                const clientOk = !!welcomed;

                if (clientOk !== serverOk || JSON.stringify(Object.entries(client).sort()) !== JSON.stringify(Object.entries(server).sort()))
                    different.push(JSON.stringify(values) + '\n   browser: ' + (clientOk ? 'accepted' : JSON.stringify(client)) + '\n   server:  ' + (serverOk ? 'accepted' : JSON.stringify(server)));
            }
            await page.close();
            assert.equal(different.length, 0, different.length + ' of ' + CASES.length + ' submissions differ between browser and server:\n' + different.slice(0, 8).join('\n'));
        });
    });
}
