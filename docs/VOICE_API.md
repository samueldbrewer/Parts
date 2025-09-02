# Voice API Documentation

## Overview

The Voice API provides real-time, bidirectional voice communication using OpenAI's Realtime API. It supports speech-to-speech conversations with low latency through WebSocket connections.

## Prerequisites

1. **OpenAI API Key**: Set the `OPENAI_API_KEY` environment variable
2. **WebSocket Support**: Client must support WebSocket connections
3. **Audio Format**: PCM16 24kHz mono (default) or G.711 µ-law/A-law

## Endpoints

### REST Endpoints

#### Get Connection Token

```
GET /api/v1/voice/token
```

Returns a JWT token and WebSocket URL for establishing voice connection.

**Response:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "url": "wss://your-api.com/api/v1/voice/realtime",
    "expiresIn": 3600,
    "model": "gpt-realtime",
    "supportedFormats": ["pcm16", "g711_ulaw", "g711_alaw"],
    "defaultFormat": "pcm16",
    "sampleRate": 24000
  }
}
```

#### Get Session History

```
GET /api/v1/voice/sessions?limit=10&offset=0&status=completed
```

Retrieve voice session history for the authenticated user.

#### Get Session Details

```
GET /api/v1/voice/sessions/:sessionId
```

Get detailed information about a specific voice session.

#### Get Usage Statistics

```
GET /api/v1/voice/usage?period=7d
```

Get usage statistics including token counts and estimated costs.

Periods: `1h`, `1d`, `7d`, `30d`

#### Health Check

```
GET /api/v1/voice/health
```

Check voice service health and configuration status.

### WebSocket Endpoint

```
wss://your-api.com/api/v1/voice/realtime?token=YOUR_TOKEN
```

Connect to this endpoint with the token from `/api/v1/voice/token`.

## WebSocket Protocol

### Client → Server Messages

#### Send Audio

```json
{
  "type": "input_audio_buffer.append",
  "audio": "base64_encoded_audio_data"
}
```

#### Commit Audio Buffer

```json
{
  "type": "input_audio_buffer.commit"
}
```

#### Clear Audio Buffer

```json
{
  "type": "input_audio_buffer.clear"
}
```

#### Send Text Message

```json
{
  "type": "conversation.item.create",
  "item": {
    "content": [
      {
        "text": "Hello, how are you?"
      }
    ]
  }
}
```

#### Create Response

```json
{
  "type": "response.create"
}
```

#### Cancel Response

```json
{
  "type": "response.cancel"
}
```

### Server → Client Messages

#### Session Created

```json
{
  "type": "session.created",
  "data": {
    "session": {
      "id": "session_123",
      "model": "gpt-realtime"
    }
  }
}
```

#### Audio Response Delta

```json
{
  "type": "response.audio.delta",
  "data": {
    "delta": "base64_encoded_audio_chunk"
  }
}
```

#### Text Response Delta

```json
{
  "type": "response.text.delta",
  "data": {
    "delta": "partial text response"
  }
}
```

#### Transcription Completed

```json
{
  "type": "input_audio_transcription.completed",
  "data": {
    "transcript": "What the user said"
  }
}
```

#### Response Done

```json
{
  "type": "response.done",
  "data": {
    "response": {
      "usage": {
        "input_tokens": 100,
        "output_tokens": 150
      }
    }
  }
}
```

## Audio Processing

### Supported Formats

- **PCM16**: 16-bit PCM at 24kHz mono (recommended)
- **G.711 µ-law**: 8-bit µ-law at 8kHz
- **G.711 A-law**: 8-bit A-law at 8kHz

### JavaScript Example

```javascript
// Get microphone access
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    channelCount: 1,
    sampleRate: 24000,
    sampleSize: 16,
  },
});

// Create audio context
const audioContext = new AudioContext({ sampleRate: 24000 });
const source = audioContext.createMediaStreamSource(stream);
const processor = audioContext.createScriptProcessor(4096, 1, 1);

// Connect to WebSocket
const ws = new WebSocket(`wss://api.example.com/api/v1/voice/realtime?token=${token}`);

// Process audio
processor.onaudioprocess = (e) => {
  const inputData = e.inputBuffer.getChannelData(0);
  const pcm16 = convertFloat32ToPCM16(inputData);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64,
      }),
    );
  }
};

// Handle responses
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'response.audio.delta') {
    // Decode and play audio
    const audioData = atob(message.data.delta);
    playAudio(audioData);
  }
};
```

## Usage Tracking

The API tracks:

- **Input/Output Tokens**: Text tokens processed
- **Audio Tokens**: Audio data processed
- **Session Duration**: Time from start to end
- **Estimated Costs**: Based on OpenAI pricing

### Pricing (as of Dec 2024)

- Text Input: $5 per 1M tokens
- Text Output: $20 per 1M tokens
- Audio Input: $100 per 1M tokens (~$0.06/minute)
- Audio Output: $200 per 1M tokens (~$0.24/minute)

## Error Handling

WebSocket errors will be sent as:

```json
{
  "type": "error",
  "error": "Error description"
}
```

Common errors:

- Missing or invalid token
- OpenAI API key not configured
- Rate limit exceeded
- Invalid audio format
- Network timeout

## Testing

Use the provided test script:

```bash
node test-voice-api.js
```

For WebSocket testing, use a tool like `wscat`:

```bash
npm install -g wscat
wscat -c "ws://localhost:3000/api/v1/voice/realtime?token=YOUR_TOKEN"
```

## Security

- JWT tokens expire after 1 hour
- WebSocket connections timeout after 10 minutes of inactivity
- Rate limiting applies to token generation
- All sessions are logged for auditing
- Audio data is not stored by default

## Limitations

- Maximum session duration: 10 minutes
- Audio buffer size: 15 minutes
- Concurrent sessions per user: Limited by rate limits
- Supported languages: Best with English, limited multilingual support

## Development Tips

1. **Local Testing**: Set `OPENAI_API_KEY` in `.env` file
2. **Debug Mode**: Enable WebSocket debug logs with `LOG_LEVEL=debug`
3. **Mock Mode**: Use `OPENAI_API_KEY=mock` to test without real API calls
4. **Railway Deployment**: API key is auto-injected if configured in Railway dashboard

## Support

For issues or questions:

- Check health endpoint: `/api/v1/voice/health`
- Review logs for session IDs
- Monitor usage at: `/api/v1/voice/usage`
