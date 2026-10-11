# Kling Video for n8n: first video

Create one Kling video, then query its task until the video is ready. This community package connects only the Kling Video service through Ace Data Cloud. The screenshots show a real self-hosted n8n 2.42.3 instance in English. n8n Creator Portal verification is pending.

**Package:** `@acedatacloud/n8n-nodes-kling-video` · [Kling Video API and pricing](https://platform.acedata.cloud/documents/kling-videos?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=klingn8n_readme_documents_kling_videos) · [Source](https://github.com/AceDataCloud/KlingN8N)

## Quick start

### 1. Install the node

In self-hosted n8n, sign in as an owner or admin. Open **Settings → Community nodes → Install**, enter `@acedatacloud/n8n-nodes-kling-video`, check that the author is **Ace Data Cloud**, accept the installation notice and select **Install**. Your server needs HTTPS access to npm and `api.acedata.cloud`. See [n8n's installation guide](https://docs.n8n.io/integrations/community-nodes/installation-and-management/gui-installation/) for prerequisites. n8n Cloud shows a community node in its picker only after verification.

![Kling Video in the local n8n node picker](https://raw.githubusercontent.com/AceDataCloud/KlingN8N/main/_assets/tutorial/01-node-picker.png)

### 2. Get an API key with Kling access

New account? Register and sign in first. If the Applications page has no General application yet, choose **Initialize General Application**, then continue with the key steps below.

1. Sign in at [Ace Data Cloud → Applications](https://platform.acedata.cloud/console/applications?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=klingn8n_readme_api_key).
2. Open **General application** and copy its API key, or choose **Manage Keys → Create** for a separate n8n key.
3. Check Kling access, current price for **Kling V3 Turbo** in Standard mode for 5 seconds, and your balance. If you enable **Allowed APIs**, include `/kling/videos` and `/kling/tasks`. The optional n8n credential test also uses the read-only `/openai/models` metadata route.

![Copy a key or open Manage Keys](https://raw.githubusercontent.com/AceDataCloud/KlingDify/d09e7c0201532a012388a277ce3cc42d2e0716c7/_assets/tutorial/get-api-key-en.png)

![Create a separate key](https://raw.githubusercontent.com/AceDataCloud/KlingDify/d09e7c0201532a012388a277ce3cc42d2e0716c7/_assets/tutorial/create-api-key-en.png)

Copy only the application token. Do not add `Bearer ` or quotation marks, and do not use a platform management token. Keep the token out of workflow exports and screenshots.

### 3. Save the credential in n8n

Add **Kling Video by Ace Data Cloud** to a workflow. In **Credential**, choose **Connect to Kling Video by Ace Data Cloud** and create a new credential. Paste the token into **API Token**. Set **Allowed HTTP Request Domains** to **Specific Domains → `api.acedata.cloud`** and save. Select the same credential on **Create** and **Get Task**.

The credential test checks the token through the read-only `/openai/models` route. If your key restricts API paths, allow that route for the test or check access through the first Kling task query; a successful metadata test alone does not prove Kling access.

![Kling Video credential form in n8n](https://raw.githubusercontent.com/AceDataCloud/KlingN8N/main/_assets/tutorial/02-credential.png)

### 4. Import and run the smallest workflow

[Download the credential-free quickstart](https://github.com/AceDataCloud/KlingN8N/raw/refs/heads/main/examples/quickstart.json). In a new n8n workflow, choose **⋯ → Import → From file** and assign your credential to both Kling Video nodes. The path is **Start → Create → Wait 30 Seconds → Get Task**.

![Imported Kling Video workflow in n8n 2.42.3](https://raw.githubusercontent.com/AceDataCloud/KlingN8N/main/_assets/tutorial/03-workflow.png)

| Create field | First-run value |
| --- | --- |
| Resource / Operation | Video / Create |
| Model | Kling V3 Turbo (`kling-v3-turbo`) |
| Prompt | `A teal cube on a cream table, gentle camera orbit, studio lighting, no text.` |
| Start Image URL | Empty |
| Mode / Aspect Ratio / Duration | Standard / 16:9 / 5 seconds |

Check the current price and balance before running. Keep **Retry On Fail** off and select **Execute workflow** once. Create submits `action=text2video` with `async=true`, then returns `taskId` and `status=submitted`. Submission is not a completed video. **Get Task** uses the expression from **Create → taskId**, so it queries the same task after the wait.

![Kling Video creation settings](https://raw.githubusercontent.com/AceDataCloud/KlingN8N/main/_assets/tutorial/04-configure.png)

### 5. Confirm the result and charge

Open **Get Task** output. A completed video has `status=succeeded`, `finished=true`, `successful=true`, and a link in `videoUrls`. Open the returned link. If the task is still processing, **do not rerun the full workflow**: that would submit another paid video. Import the [query-only workflow](https://github.com/AceDataCloud/KlingN8N/raw/refs/heads/main/examples/query-existing-task.json), replace its placeholder with the original task ID and execute it again later. The [bounded polling workflow](https://github.com/AceDataCloud/KlingN8N/raw/refs/heads/main/examples/generate-and-wait.json) queries that same ID every 15 seconds for at most 30 minutes; it never resubmits Create.

Compare the task's trace ID and time with [Ace Data Cloud usage history](https://platform.acedata.cloud/console?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=klingn8n_readme_console). Any `cost.amount` is in **Credits**, not USD. Price varies by mode, duration and your account package. A previous **Kling V3 Turbo** five-second video completed in Dify and deducted **5.081328 Credits** under that test account; it is not an n8n call or proof of this package's result. A credentialed n8n result and matching bill have not yet been verified for this release.

## Other options and troubleshooting

Add one public HTTPS **Start Image URL** to switch Kling V3 Turbo to image-to-video. Standard and Professional modes, 16:9/9:16/1:1 aspect ratios, and 5/10/15-second durations are exposed. Kling V3 Turbo includes audio; this node does not send an unsupported audio-off override. The node validates inputs before generation. The image-to-video combination has contract tests but no claimed live n8n result. **Task → Get Many** queries up to 50 existing task IDs without creating a video. Other Kling models and separate motion, lip-sync, talking-photo and commerce endpoints are outside this first release.

| What you see | What to check |
| --- | --- |
| 401 or 403 | Check the application token, expiry, Kling access, balance and Allowed APIs for both Kling endpoints. |
| 400 | Check the model, HTTPS first frame, mode, duration and aspect ratio; try the text-to-video fields above first. |
| submitted or processing | Query the original task ID. Do not rerun Create to poll. |
| 429 | Reduce concurrency and keep automatic retries off. |
| Timeout or 5xx | Inspect the original task and usage history before submitting again; the first request may have been accepted. |
| Video link fails | Wait for terminal success, then open the returned URL directly. |

Each input item can create one paid task. The node never automatically retries or follows HTTP redirects, and task output omits known credential, request and internal routing fields. Process only media you are authorized to use. [Privacy](https://github.com/AceDataCloud/KlingN8N/blob/main/PRIVACY.md) · [Report an issue](https://github.com/AceDataCloud/KlingN8N/issues) · dev@acedata.cloud
