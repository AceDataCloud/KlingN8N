import { NodeConnectionTypes, NodeOperationError, OperationalError, UserError } from 'n8n-workflow';
import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties, INodeType, INodeTypeDescription } from 'n8n-workflow';

const modelName = 'kling-v3-turbo';
const aspectRatios = ['16:9', '9:16', '1:1'];
const privateFields = new Set([
  'request', 'request_body', 'user_id', 'actor_user_id', 'credential_id',
  'authorization_id', 'application_id', 'api_key', 'api_token', 'token',
  'credential', 'credentials', 'access_token', 'refresh_token', 'authorization',
  'headers', 'supplier', 'supplier_id', 'provider_route', 'upstream',
  'upstream_model', 'actual_model', 'secret',
]);

const properties: INodeProperties[] = [
  {
    displayName: 'Resource', name: 'resource', type: 'options', default: 'video', noDataExpression: true,
    options: [{ name: 'Task', value: 'task' }, { name: 'Video', value: 'video' }],
  },
  {
    displayName: 'Operation', name: 'operation', type: 'options', default: 'create', noDataExpression: true,
    displayOptions: { show: { resource: ['video'] } },
    options: [{ name: 'Create', value: 'create', action: 'Create a video', description: 'Submit one paid video generation task' }],
  },
  {
    displayName: 'Operation', name: 'operation', type: 'options', default: 'get', noDataExpression: true,
    displayOptions: { show: { resource: ['task'] } },
    options: [
      { name: 'Get', value: 'get', action: 'Get a task', description: 'Query one existing task' },
      { name: 'Get Many', value: 'getMany', action: 'Get many tasks', description: 'Query up to 50 existing task IDs' },
    ],
  },
  {
    displayName: 'Model', name: 'model', type: 'options', default: modelName,
    displayOptions: { show: { resource: ['video'] } },
    options: [{ name: 'Kling V3 Turbo', value: modelName }],
    description: 'This first release uses the Kling V3 Turbo model',
  },
  {
    displayName: 'Prompt', name: 'prompt', type: 'string', default: '',
    typeOptions: { rows: 4 }, displayOptions: { show: { resource: ['video'] } },
    description: 'Describe the video',
  },
  {
    displayName: 'Start Image URL', name: 'startImageUrl', type: 'string', default: '',
    displayOptions: { show: { resource: ['video'] } },
    description: 'Optional public HTTPS first frame; leave empty for text to video',
  },
  {
    displayName: 'Mode', name: 'mode', type: 'options', default: 'std',
    displayOptions: { show: { resource: ['video'] } },
    options: [{ name: 'Standard', value: 'std' }, { name: 'Professional', value: 'pro' }],
    description: 'Professional mode has a different price',
  },
  {
    displayName: 'Aspect Ratio', name: 'aspectRatio', type: 'options', default: '16:9',
    displayOptions: { show: { resource: ['video'] } },
    options: [{ name: '16:9', value: '16:9' }, { name: '9:16', value: '9:16' }, { name: '1:1', value: '1:1' }],
    description: 'Output aspect ratio',
  },
  {
    displayName: 'Duration (Seconds)', name: 'duration', type: 'options', default: 5,
    displayOptions: { show: { resource: ['video'] } },
    options: [{ name: '5', value: 5 }, { name: '10', value: 10 }, { name: '15', value: 15 }],
    description: 'Kling V3 Turbo includes audio; price changes with duration',
  },
  {
    displayName: 'Task ID', name: 'taskId', type: 'string', default: '', required: true,
    displayOptions: { show: { resource: ['task'], operation: ['get'] } },
    description: 'The task ID returned by Create',
  },
  {
    displayName: 'Task IDs', name: 'taskIds', type: 'string', default: '', required: true,
    displayOptions: { show: { resource: ['task'], operation: ['getMany'] } },
    description: 'One to 50 existing task IDs, separated by commas or new lines',
  },
];

function object(value: unknown): IDataObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as IDataObject : {};
}

function text(value: unknown, label: string, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum)
    throw new UserError(`${label} must be at most ${maximum} characters`);
  return value.trim();
}

function requiredText(value: unknown, label: string, maximum: number): string {
  const result = text(value, label, maximum);
  if (!result) throw new UserError(`${label} is required`);
  return result;
}

function publicUrl(value: string): string {
  if (!URL.canParse(value)) throw new UserError('Each image URL must be public HTTPS');
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password)
    throw new UserError('Each image URL must be public HTTPS without embedded credentials');
  return parsed.toString();
}

function taskIds(value: unknown): string[] {
  const ids = requiredText(value, 'Task IDs', 4096).split(/[,\n]/).map(v => v.trim()).filter(Boolean);
  if (ids.length < 1 || ids.length > 50) throw new UserError('Provide one to 50 task IDs');
  return ids.map(id => requiredText(id, 'Task ID', 128));
}

export function videoBody(get: (name: string) => unknown): IDataObject {
  const model = requiredText(get('model'), 'Model', 80);
  if (model !== modelName) throw new UserError('Select the supported Kling V3 Turbo model');
  const prompt = requiredText(get('prompt'), 'Prompt', 4000);
  const image = text(get('startImageUrl'), 'Start Image URL', 2048);
  const mode = requiredText(get('mode'), 'Mode', 10);
  if (mode !== 'std' && mode !== 'pro') throw new UserError('Select Standard or Professional mode');
  const aspectRatio = requiredText(get('aspectRatio'), 'Aspect Ratio', 10);
  if (!aspectRatios.includes(aspectRatio)) throw new UserError('Select a supported aspect ratio');
  const duration = get('duration');
  if (duration !== 5 && duration !== 10 && duration !== 15)
    throw new UserError('Select a supported 5, 10 or 15 second duration');
  const action = image ? 'image2video' : 'text2video';
  const body: IDataObject = { model, action, prompt, mode, duration, aspect_ratio: aspectRatio, async: true };
  if (image) body.start_image_url = publicUrl(image);
  return body;
}

function publicData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !privateFields.has(key.toLowerCase())
      && !/(^internal(?:_|$)|supplier|upstream|(?:^|_)secret(?:_|$))/i.test(key))
    .map(([key, item]) => [key, publicData(item)]));
}

function videoUrls(value: unknown): string[] {
  const found: string[] = [];
  function walk(node: unknown): void {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    for (const [key, item] of Object.entries(node)) {
      if ((key === 'video_url' || key === 'url') && typeof item === 'string' && item.startsWith('https://'))
        found.push(item);
      else if (item && typeof item === 'object') walk(item);
    }
  }
  walk(value);
  return [...new Set(found)];
}

export function taskResult(record: IDataObject): IDataObject {
  const response = object(record.response);
  const data = publicData(response.data ?? response.content ?? record.data ?? record.content ?? response);
  const items = Array.isArray(data) ? data : [];
  const states = items.map(item => String(object(item).state ?? '').toLowerCase()).filter(Boolean);
  const state = String(record.state ?? record.status ?? response.state ?? response.status ?? '').toLowerCase();
  const unfinished = Object.prototype.hasOwnProperty.call(record, 'finished_at') && record.finished_at === null;
  const failed = !unfinished && (response.success === false || record.success === false || Boolean(response.error ?? record.error)
    || ['failed', 'error', 'cancelled', 'canceled', 'rejected'].includes(state)
    || states.some(item => ['failed', 'error', 'cancelled', 'canceled', 'rejected'].includes(item)));
  const urls = videoUrls(data);
  const finished = Boolean(record.finished_at);
  const complete = !failed && !unfinished && (
    ['succeeded', 'success', 'completed', 'complete', 'succeed', 'finished'].includes(state)
    || (states.length > 0 && states.every(item => ['succeeded', 'success', 'completed', 'complete', 'succeed', 'finished'].includes(item)))
    || (finished && response.success === true && urls.length > 0));
  return {
    taskId: record.id ?? record.task_id ?? '',
    status: failed ? 'failed' : complete ? 'succeeded' : 'processing',
    finished: failed || complete,
    successful: failed ? false : complete ? true : null,
    videoUrls: complete ? urls : [],
    data: complete ? data as IDataObject | IDataObject[] | null : null,
    error: failed ? { code: 'task_failed', message: 'The task failed; inspect its task or trace ID.' } : null,
    traceId: record.trace_id ?? response.trace_id ?? null,
    cost: publicData(response.cost ?? null) as IDataObject | null,
  };
}

function requestFailure(error: unknown): OperationalError {
  const value = error && typeof error === 'object' ? error as {
    httpCode?: unknown; statusCode?: unknown; response?: { statusCode?: unknown; status?: unknown };
  } : {};
  const code = String(value.httpCode ?? value.statusCode ?? value.response?.statusCode ?? value.response?.status ?? '');
  const status = /^\d{3}$/.test(code) ? code : '';
  return new OperationalError(status
    ? `Ace Data Cloud returned HTTP ${status}. Check the original task or request history before retrying.`
    : 'The Kling Video request did not complete. Check task or request history before retrying; generation may have been charged.');
}

async function request(context: IExecuteFunctions, endpoint: string, body: IDataObject): Promise<IDataObject> {
  let result: unknown;
  try {
    result = await context.helpers.httpRequestWithAuthentication.call(context, 'aceDataKlingVideoApi', {
      method: 'POST', url: `https://api.acedata.cloud${endpoint}`, body,
      json: true, disableFollowRedirect: true, timeout: 60000,
    });
  } catch (error) { throw requestFailure(error); }
  if (!result || typeof result !== 'object' || Array.isArray(result))
    throw new OperationalError('The service returned an unexpected response');
  const value = object(result);
  if (value.success === false || value.error)
    throw new OperationalError('The service rejected the request. Inspect its task or trace ID.');
  return value;
}

export class KlingVideo implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Kling Video by Ace Data Cloud', name: 'klingVideo',
    icon: { light: 'file:icon.svg', dark: 'file:icon.dark.svg' },
    group: ['transform'], version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Generate a Kling video and retrieve the same task until it finishes',
    defaults: { name: 'Kling Video by Ace Data Cloud' },
    inputs: [NodeConnectionTypes.Main], outputs: [NodeConnectionTypes.Main],
    usableAsTool: true, credentials: [{ name: 'aceDataKlingVideoApi', required: true }], properties,
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const output: INodeExecutionData[] = [];
    for (let index = 0; index < this.getInputData().length; index++) {
      try {
        let hasToken = false;
        try {
          const credentials = await this.getCredentials('aceDataKlingVideoApi');
          hasToken = typeof credentials.apiToken === 'string' && Boolean(credentials.apiToken.trim());
        } catch { /* n8n did not provide a credential. */ }
        if (!hasToken)
          throw new NodeOperationError(this.getNode(), 'A Kling Video by Ace Data Cloud credential is required.');

        const resource = this.getNodeParameter('resource', index) as string;
        const operation = this.getNodeParameter('operation', index) as string;
        if (resource === 'task') {
          const body: IDataObject = operation === 'get'
            ? { action: 'retrieve', id: requiredText(this.getNodeParameter('taskId', index), 'Task ID', 128) }
            : operation === 'getMany'
              ? { action: 'retrieve_batch', ids: taskIds(this.getNodeParameter('taskIds', index)) }
              : {};
          if (!body.action) throw new UserError('Select a supported task operation');
          const result = await request(this, '/kling/tasks', body);
          const records = operation === 'getMany' ? result.items : [result];
          if (!Array.isArray(records)) throw new OperationalError('The service returned an unexpected task list');
          for (const item of records) {
            const record = object(item);
            if (!record.id && !record.task_id) throw new OperationalError('The task was not found');
            output.push({ json: taskResult(record), pairedItem: { item: index } });
          }
          continue;
        }
        if (resource !== 'video' || operation !== 'create')
          throw new UserError('Select a supported Kling Video operation');
        const body = videoBody(name => this.getNodeParameter(name, index, ''));
        const result = await request(this, '/kling/videos', body);
        const taskId = result.task_id ?? object(result.task).id;
        if (typeof taskId !== 'string' || !taskId)
          throw new OperationalError('The service did not return a task ID; inspect request history before retrying');
        output.push({
          json: { taskId, status: 'submitted', finished: false, successful: null, traceId: result.trace_id ?? null },
          pairedItem: { item: index },
        });
      } catch (error) {
        if (!this.continueOnFail())
          throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: index });
        output.push({ json: { error: (error as Error).message }, pairedItem: { item: index } });
      }
    }
    return [output];
  }
}
