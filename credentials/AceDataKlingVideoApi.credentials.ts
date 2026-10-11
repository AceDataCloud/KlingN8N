import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class AceDataKlingVideoApi implements ICredentialType {
  name = 'aceDataKlingVideoApi';
  displayName = 'Kling Video by Ace Data Cloud API';
  documentationUrl = 'https://github.com/AceDataCloud/KlingN8N#3-save-the-credential-in-n8n';
  icon = 'file:../nodes/KlingVideo/icon.svg' as const;
  properties: INodeProperties[] = [{
    displayName: 'API Token', name: 'apiToken', type: 'string',
    typeOptions: { password: true }, default: '', required: true,
    description: 'An Ace Data Cloud application API token with Kling Video access',
  }];
  authenticate: IAuthenticateGeneric = {
    type: 'generic', properties: { headers: { Authorization: '=Bearer {{$credentials.apiToken}}' } },
  };
  test: ICredentialTestRequest = {
    request: { baseURL: 'https://api.acedata.cloud', url: '/openai/models', method: 'GET' },
  };
}
