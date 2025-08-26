#!/bin/bash

# Full API Test Script
API_URL="https://parts.up.railway.app"

echo "🎯 Testing Parts API on Railway"
echo "================================"

echo -e "\n1️⃣ Testing Health Endpoint..."
curl -s $API_URL/health | python3 -m json.tool

echo -e "\n2️⃣ Testing Voice Health..."
curl -s $API_URL/api/v1/voice/health | python3 -m json.tool

echo -e "\n3️⃣ Getting Connection Token..."
TOKEN_RESPONSE=$(curl -s $API_URL/api/v1/voice/token)
echo "$TOKEN_RESPONSE" | python3 -m json.tool

# Extract token
TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null)

if [ ! -z "$TOKEN" ]; then
    echo -e "\n✅ Token obtained successfully!"
    echo "Token (first 50 chars): ${TOKEN:0:50}..."
else
    echo -e "\n❌ Failed to obtain token"
fi

echo -e "\n4️⃣ Testing Usage Stats..."
curl -s $API_URL/api/v1/voice/usage?period=1d | python3 -m json.tool

echo -e "\n5️⃣ Testing Sessions..."
curl -s $API_URL/api/v1/voice/sessions | python3 -m json.tool

echo -e "\n================================"
echo "✅ API Test Complete!"
echo ""
echo "📝 WebSocket Connection Info:"
echo "URL: wss://parts.up.railway.app/api/v1/voice/realtime"
echo "Token: Use token from /api/v1/voice/token endpoint"
echo ""
echo "🎙️ Voice API is ready for frontend development!"