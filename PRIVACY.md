# Privacy

The node sends your prompt, optional media URLs, settings and API token to `https://api.acedata.cloud/kling/videos`. It queries existing task IDs at `https://api.acedata.cloud/kling/tasks`. The node does not fetch input media itself, contact another host, read local files or environment variables, or add telemetry. n8n stores the token in its credential store; workflow exports should not contain it. Process only media you are authorized to use.

See the [Ace Data Cloud privacy policy](https://platform.acedata.cloud/privacy) and [current Kling Video details](https://platform.acedata.cloud/documents/kling-videos).
