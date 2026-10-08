const test = require('node:test');
const assert = require('node:assert');
const app = require('./server');

test('backend de referencia', async t => {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => server.close());

  await t.test('/health responde ok', async () => {
    const body = await (await fetch(`${base}/health`)).json();
    assert.equal(body.ok, true);
  });

  await t.test('/download entrega exactamente los bytes pedidos', async () => {
    const response = await fetch(`${base}/download/1048576`);
    assert.equal(response.headers.get('x-payload-bytes'), '1048576');
    assert.equal((await response.arrayBuffer()).byteLength, 1048576);
  });

  await t.test('/upload devuelve los bytes recibidos', async () => {
    const response = await fetch(`${base}/upload`, {method: 'POST', headers: {'Content-Type': 'application/octet-stream'}, body: Buffer.alloc(300000)});
    assert.equal(response.headers.get('x-bytes-received'), '300000');
    assert.equal((await response.json()).bytesReceived, 300000);
  });
});
