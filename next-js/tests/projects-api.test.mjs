import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const original = await readFile(new URL('../lib/projects.js', import.meta.url), 'utf8');
const code = original.replace("import { APP_CONFIG } from './config';", "const APP_CONFIG = { BACKEND_URL: 'https://test.invalid' };")
    .replace("'./project-domain.mjs'", JSON.stringify(new URL('../lib/project-domain.mjs', import.meta.url).href));
const api = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const draft = { name: 'Web', description: '', project_type: 'frontend', languages: ['javascript'], frameworks: ['nextjs'], runtimes: ['nodejs'], database_categories: [] };
const wire = { id: 'p1', name: 'Web', description: '', projectType: 'frontend', settings: { languages: ['javascript'], frameworks: ['nextjs'], runtimes: ['node'], databaseCategories: [] }, revision: 1, status: 'active', createdAt: 1, updatedAt: 1 };
function mock(t, handler) {
    const previous = globalThis.fetch;
    globalThis.fetch = handler;
    t.after(() => { globalThis.fetch = previous; });
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
test('create sends nested settings and maps nodejs to node, then normalizes response', async t => {
    mock(t, async (url, options) => {
        assert.equal(url, 'https://test.invalid/v1/projects'); assert.equal(options.method, 'POST');
        assert.equal(options.credentials, 'include'); assert.equal(options.cache, 'no-store');
        assert.deepEqual(JSON.parse(options.body), { name: 'Web', description: '', projectType: 'frontend', settings: wire.settings });
        return json(wire, 201);
    });
    const project = await api.createProject(draft);
    assert.equal(project.project_type, 'frontend'); assert.deepEqual(project.runtimes, ['nodejs']);
    assert.deepEqual(project.languages, ['javascript']); assert.deepEqual(project.frameworks, ['nextjs']);
});
test('update uses PUT and preserves quoted revision precondition', async t => {
    mock(t, async (url, options) => {
        assert.equal(options.method, 'PUT'); assert.equal(options.headers['If-Match'], '"1"');
        assert.equal(JSON.parse(options.body).projectType, 'frontend'); return json({ ...wire, revision: 2 });
    });
    assert.equal((await api.updateProject('p1', 1, draft)).revision, 2);
});
test('list consumes paginated items and propagates abort signal', async t => {
    const controller = new AbortController(); let calls = 0;
    mock(t, async (url, options) => {
        calls++; assert.equal(options.signal, controller.signal);
        assert.equal(new URL(url).searchParams.get('page'), String(calls));
        return json({ items: [{ ...wire, id: `p${calls}` }], page: calls, pageSize: 1, total: 2 });
    });
    assert.deepEqual((await api.listProjects(controller.signal)).map(p => p.id), ['p1', 'p2']);
});
test('204 confirms soft deletion', async t => {
    mock(t, async (url, options) => {
        assert.equal(options.method, 'DELETE'); assert.equal(options.headers['If-Match'], '"1"');
        return new Response(null, { status: 204 });
    });
    assert.deepEqual(await api.softDeleteProject('p1', 1), { id: 'p1', status: 'deleted' });
});
test('validation rejection remains readable and distinguishable', async t => {
    mock(t, async () => json({ detail: [{ loc: ['body', 'settings'], msg: 'Field required' }] }, 422));
    await assert.rejects(api.createProject(draft), e => e.status === 422 && /body.settings: Field required/.test(e.message));
});
test('stale update remains a 412 error', async t => {
    mock(t, async () => json({ detail: 'Revision conflict' }, 412));
    await assert.rejects(api.updateProject('p1', 1, draft), e => e.status === 412);
});
test('invalid success response is not accepted', async t => {
    mock(t, async () => json({ id: 'p1' }, 201));
    await assert.rejects(api.createProject(draft), /incompatible response/);
});
test('unexpected deletion status is not treated as confirmation', async t => {
    mock(t, async () => json({}, 200));
    await assert.rejects(api.softDeleteProject('p1', 1), /expected deletion acknowledgement/);
});
test('invalid project IDs fail before making a request', async t => {
    let calls = 0;

    mock(t, async () => {
        calls += 1;
        throw new Error('An invalid project ID must not reach fetch.');
    });

    for (const id of [undefined, null, '', ' ', 'undefined', 'null']) {
        await assert.rejects(
            api.getProject(id),
            error => error.code === 'invalid_project_id',
        );
    }

    assert.equal(calls, 0);
});
