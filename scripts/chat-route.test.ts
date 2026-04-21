import assert from 'node:assert/strict';

const envKeys = [
  'ARK_API_KEY',
  'SILICONFLOW_API_KEY',
  'AUTH_TEST_BYPASS',
] as const;

async function main() {
  const previousEnv = new Map<string, string | undefined>();

  for (const key of envKeys) {
    previousEnv.set(key, process.env[key]);
    delete process.env[key];
  }

  try {
    process.env.AUTH_TEST_BYPASS = 'true';
    const { POST } = await import('../src/app/api/chat/route');

    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'paperboyfriend_session=test-session-token',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: '打招呼' }],
        characterPrompt: '你是一个温柔的男朋友',
      }),
    });

    const response = await POST(request as never);
    const data = await response.json();

    assert.equal(response.status, 401, 'missing AI config should surface a 401 business error');
    assert.equal(data.code, 'UNAUTHORIZED');
    assert.match(data.error, /鉴权失败|密钥配置/);

    console.log('chat route unauthorized test passed.');
  } finally {
    for (const [key, value] of previousEnv.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
