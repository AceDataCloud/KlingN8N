const { test } = require('node:test');
const assert = require('node:assert/strict');
const { KlingVideo, videoBody, taskResult } = require('../dist/nodes/KlingVideo/KlingVideo.node.js');
const { AceDataKlingVideoApi } = require('../dist/credentials/AceDataKlingVideoApi.credentials.js');

const base = {
  resource: 'video', operation: 'create', model: 'kling-v3-turbo',
  prompt: 'A teal cube rotates on a cream tabletop', startImageUrl: '',
  mode: 'std', aspectRatio: '16:9', duration: 5,
};
function body(parameters) { return videoBody(name => parameters[name] ?? ''); }
function context(parameters, responses = [], continueOnFail = false, credentials = { apiToken: 'test-token' }) {
  const calls = [];
  let next = 0;
  return {
    calls,
    getInputData: () => parameters.map(() => ({ json: {} })),
    getNode: () => ({ name: 'Kling Video', type: '@acedatacloud/n8n-nodes-kling-video.klingVideo', typeVersion: 1, position: [0, 0], parameters: {} }),
    getNodeParameter: (name, index, fallback) => parameters[index][name] ?? fallback,
    getCredentials: async () => credentials,
    continueOnFail: () => continueOnFail,
    helpers: { httpRequestWithAuthentication: async (credential, options) => {
      calls.push({ credential, ...options });
      const response = responses[next++];
      if (response instanceof Error) throw response;
      return response;
    } },
  };
}

const node = new KlingVideo();
test('one input submits one asynchronous video task with no retry', async () => {
  const ctx = context([base], [{ task_id: 'video-1', trace_id: 'trace-1', success: true }]);
  const [items] = await node.execute.call(ctx);
  assert.equal(ctx.calls.length, 1);
  assert.equal(ctx.calls[0].credential, 'aceDataKlingVideoApi');
  assert.equal(ctx.calls[0].url, 'https://api.acedata.cloud/kling/videos');
  assert.equal(ctx.calls[0].method, 'POST');
  assert.equal(ctx.calls[0].disableFollowRedirect, true);
  assert.deepEqual(ctx.calls[0].body, {
    model: base.model, action: 'text2video', prompt: base.prompt,
    mode: 'std', aspect_ratio: '16:9', duration: 5, async: true,
  });
  assert.deepEqual(items[0], {
    json: { taskId: 'video-1', status: 'submitted', finished: false, successful: null, traceId: 'trace-1' },
    pairedItem: { item: 0 },
  });
});

test('invalid model and parameter combinations stop before a paid request', async () => {
  const bad = [
    { ...base, model: 'other' },
    { ...base, prompt: '' },
    { ...base, startImageUrl: 'http://example.com/image.jpg' },
    { ...base, startImageUrl: 'https://user:secret@example.com/image.jpg' },
    { ...base, mode: '4k' }, { ...base, aspectRatio: '4:3' },
    { ...base, duration: 6 },
  ];
  for (const parameters of bad) {
    const ctx = context([parameters]);
    await assert.rejects(node.execute.call(ctx));
    assert.equal(ctx.calls.length, 0);
  }
});

test('a first-frame image selects image-to-video without optional audio override', () => {
  const image = body({ ...base, startImageUrl: 'https://example.com/a.jpg', mode: 'pro' });
  assert.equal(image.action, 'image2video');
  assert.equal(image.start_image_url, 'https://example.com/a.jpg');
  assert.equal(image.mode, 'pro');
  assert.equal(image.generate_audio, undefined);
});

test('Get queries the original task and exposes only completed media', async () => {
  const task = { id: 'video-1', finished_at: '2026-10-11T00:00:00Z',
    request: { prompt: 'private' }, credential_id: 'private',
    response: { success: true, trace_id: 'trace-1', data: [{ state: 'succeed', video_url: 'https://example.com/video.mp4', supplier: 'private' }] } };
  const ctx = context([{ resource: 'task', operation: 'get', taskId: 'video-1' }], [task]);
  const [items] = await node.execute.call(ctx);
  assert.deepEqual(ctx.calls[0].body, { action: 'retrieve', id: 'video-1' });
  assert.equal(items[0].json.status, 'succeeded');
  assert.deepEqual(items[0].json.videoUrls, ['https://example.com/video.mp4']);
  assert.equal(items[0].json.data[0].supplier, undefined);
  assert.equal(items[0].json.taskId, 'video-1');
});

test('root response video URL is returned when Kling task omits a data array', async () => {
  const task = {
    id: 'kling-task', finished_at: 1769263509.094,
    request: { prompt: 'private input' }, credential_id: 'private',
    response: { success: true, state: 'completed', task_id: 'kling-task', video_url: 'https://example.com/final.mp4' },
  };
  const ctx = context([{ resource: 'task', operation: 'get', taskId: 'kling-task' }], [task]);
  const [items] = await node.execute.call(ctx);
  assert.equal(items[0].json.status, 'succeeded');
  assert.deepEqual(items[0].json.videoUrls, ['https://example.com/final.mp4']);
  assert.equal(items[0].json.data.video_url, 'https://example.com/final.mp4');
  assert.equal(JSON.stringify(items[0].json).includes('private'), false);
});

test('pending is not complete; failed task does not expose media', () => {
  const pending = taskResult({ id: 'video-1', finished_at: null, response: { success: true, data: [{ state: 'pending' }] } });
  assert.equal(pending.status, 'processing');
  assert.equal(pending.finished, false);
  assert.deepEqual(pending.videoUrls, []);
  const failed = taskResult({ id: 'video-2', finished_at: 'now', response: { success: false, data: [{ state: 'failed', video_url: 'https://example.com/bad.mp4' }] } });
  assert.equal(failed.status, 'failed');
  assert.deepEqual(failed.videoUrls, []);
});

test('Get Many uses the task query endpoint without generation', async () => {
  const ctx = context([{ resource: 'task', operation: 'getMany', taskIds: 'video-1,video-2' }], [
    { items: [{ id: 'video-1', finished_at: null }, { id: 'video-2', finished_at: null }] },
  ]);
  const [items] = await node.execute.call(ctx);
  assert.equal(ctx.calls.length, 1);
  assert.equal(ctx.calls[0].url, 'https://api.acedata.cloud/kling/tasks');
  assert.deepEqual(ctx.calls[0].body, { action: 'retrieve_batch', ids: ['video-1', 'video-2'] });
  assert.equal(items.length, 2);
});

test('uncertain transport failure never retries generation', async () => {
  const ctx = context([base, base], [new Error('connection lost'), { task_id: 'video-2' }], true);
  const [items] = await node.execute.call(ctx);
  assert.equal(ctx.calls.length, 2);
  assert.match(items[0].json.error, /request history/i);
  assert.equal(items[1].json.taskId, 'video-2');
});

test('credential is masked and tested on free metadata route', async () => {
  const credential = new AceDataKlingVideoApi();
  assert.equal(credential.properties[0].typeOptions.password, true);
  assert.match(credential.authenticate.properties.headers.Authorization, /Bearer/);
  assert.equal(credential.test.request.url, '/openai/models');
  const ctx = context([base], [], false, { apiToken: '' });
  await assert.rejects(node.execute.call(ctx), /credential is required/i);
  assert.equal(ctx.calls.length, 0);
});
