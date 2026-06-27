---
name: voice-input-integration
description: >
  Integrate ElevenLabs Scribe v2 Realtime voice-to-text as a companion input method
  for infrastructure requirements. Enables users to describe infrastructure needs
  verbally with real-time transcription via WebSocket streaming.
metadata:
  slash-command: enabled
---

## Voice Input Integration

Enable voice-based infrastructure requirement capture using ElevenLabs Scribe v2 Realtime
as a companion input method. Users describe their infrastructure needs verbally, and the
transcription feeds into GitLab issues or chat interactions.

### Architecture Overview

```
  ┌──────────────┐    WebSocket     ┌──────────────────┐
  │ Browser /    │◀───streaming────▶│ ElevenLabs       │
  │ Client App   │                  │ Scribe v2        │
  └──────┬───────┘                  │ Realtime         │
         │                          └──────────────────┘
         │ HTTP (token request)
         │
  ┌──────▼───────┐
  │ Token        │    ElevenLabs API
  │ Endpoint     │───────────────────▶ Single-use token
  │ (server)     │
  └──────────────┘
```

### How It Works

1. **Server-side token generation**: A backend endpoint creates single-use tokens
   using the ElevenLabs API. The API key never leaves the server.
2. **Client-side WebSocket**: The browser connects to ElevenLabs Scribe using the
   single-use token and streams microphone audio directly.
3. **Real-time transcription**: Partial and committed transcripts arrive via WebSocket
   events with ~150ms latency.
4. **Issue creation**: The transcribed text populates GitLab issue fields or is sent
   as a chat message to the Skyrchitect agent.

### Token Endpoint Pattern

```python
from elevenlabs import ElevenLabs
from fastapi import FastAPI, HTTPException
import os

app = FastAPI()

@app.get("/api/scribe-token")
async def get_scribe_token():
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Voice input not configured")

    client = ElevenLabs(api_key=api_key)
    token_response = client.tokens.single_use.create(
        token_type="realtime_scribe"
    )

    return {
        "token": token_response.token,
        "expires_at": token_response.expires_at
    }
```

### Client-Side Integration Pattern

```typescript
import { Scribe } from "@elevenlabs/client";

async function startVoiceCapture(onTranscript: (text: string) => void) {
  const res = await fetch("/api/scribe-token");
  const { token } = await res.json();

  const connection = Scribe.connect({
    token,
    modelId: "scribe_v2_realtime",
    microphone: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  connection.on("transcript", (event) => {
    if (event.type === "committed") {
      onTranscript(event.text);
    }
  });

  return connection;
}
```

### Integration with GitLab Workflow

Voice input can be integrated at several points in the Skyrchitect workflow:

1. **Issue creation**: A web form or companion app lets users dictate infrastructure
   requirements. The transcription is formatted as a GitLab issue using the
   `infrastructure_request` template and created via the GitLab API.

2. **Chat interaction**: Users dictate messages to the Skyrchitect custom agent
   through a voice-enabled interface, which posts transcribed text to GitLab Duo Chat.

3. **MCP server**: An MCP server could expose the voice transcription as a tool,
   allowing the agent to request voice input during interactive sessions.

### Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `ELEVENLABS_API_KEY` | ElevenLabs API key (starts with `sk_...`) | Yes |

### Pricing

- ~$0.0025 per minute of audio
- Typical infrastructure description (30-60 seconds): $0.0025-0.005
- Monthly estimate (30 descriptions): ~$0.11

### Security

- API key is server-side only, never exposed to the client
- Tokens are single-use and expire after 15 minutes
- Audio is streamed directly to ElevenLabs, not stored on any intermediate server
- No persistent recording or audio storage

### References

- [ElevenLabs Scribe v2 Realtime Documentation](https://elevenlabs.io/docs/developers/guides/cookbooks/speech-to-text/realtime/client-side-streaming)
- [ElevenLabs Client SDK](https://www.npmjs.com/package/@elevenlabs/client)
