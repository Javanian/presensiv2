# Expo Dev Server on Docker (AWS EC2) — Setup Guide

> Context: Running `npx expo start` inside Docker on AWS EC2, testing on a personal
> phone from a different network (mobile data / home WiFi), with IAM restrictions
> preventing Security Group changes.

---

## Prerequisites

- EC2 instance with Docker + docker-compose installed
- Expo SDK 52 / React Native project
- EC2 has Tailscale installed (verify: `sudo tailscale status`)

---

## Option A: Tunnel Mode (ngrok via Expo)

Use when: you cannot install Tailscale on the phone, or are demoing to others.

### 1. Get EXPO_TOKEN

```bash
# On your LOCAL machine (not EC2):
npx expo login                        # login interactively
npx expo whoami                       # verify

# Recommended: generate a dedicated Access Token
# → expo.dev → Account Settings → Access Tokens → Create Token
# Copy the token — shown only once
```

### 2. Store token securely

```bash
echo "EXPO_TOKEN=your_token_here" > .env
echo ".env" >> .gitignore
```

### 3. docker-compose.yml

```yaml
version: "3.8"

services:
  expo:
    build: .
    working_dir: /app
    volumes:
      - ./:/app
      - /app/node_modules
    command: npx expo start --tunnel --non-interactive
    ports: []                        # no ports needed — tunnel is outbound only
    env_file:
      - .env                         # contains EXPO_TOKEN=...
    restart: unless-stopped
```

> Do NOT set `REACT_NATIVE_PACKAGER_HOSTNAME` in tunnel mode — it is ignored.

### 4. If ngrok is missing in container

```dockerfile
# Add to your Dockerfile:
RUN npm install -g @expo/ngrok@^4.0.0
```

### 5. Verify tunnel before scanning

```bash
# Watch for tunnel URL in logs
docker compose logs -f expo | grep -E "tunnel|exp://"

# Expected output:
# › Metro waiting on exp://xx-xxxx.your-username.exp.direct
# › Tunnel ready

# Test from your laptop:
curl https://xx-xxxx.your-username.exp.direct/status
# Expected: {"status":"Metro is running"}
```

### 6. QR code URL format

```
exp://u.expo.dev/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx+...
# or (older):
exp://xx-xxxx.anonymous.exp.direct:80
```

### 7. Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Error: Not logged in` | Missing/invalid `EXPO_TOKEN` | Regenerate token at expo.dev |
| `Tunnel connection failed` | ngrok rate limit (free tier) | Wait 1 min or upgrade ngrok |
| Tunnel URL in logs but QR won't scan | Tunnel not fully ready | Wait ~30s after "Tunnel ready" |
| `spawn ngrok ENOENT` | ngrok not in container | Add `@expo/ngrok` to Dockerfile |

### Pros / Cons

| Pros | Cons |
|------|------|
| Zero network config | 200–800ms HMR latency (relayed via ngrok) |
| Works on any network | Tunnel occasionally drops |
| No Tailscale on phone | Requires Expo account + token |
| Good for sharing/demos | Free ngrok has connection limits |

---

## Option B: Tailscale Mode (Recommended for daily dev)

Use when: EC2 already has Tailscale and you can install Tailscale on your phone.
No Security Group changes needed — Tailscale uses outbound UDP (port 41641).

### 1. Install Tailscale on phone

**Android:** Play Store → search "Tailscale" → Install

**iOS:** App Store → search "Tailscale" → Install

### 2. Join the same Tailscale network

```
1. Open Tailscale app on phone
2. Tap "Log in"
3. Sign in with the SAME account used on EC2
   (check EC2: sudo tailscale status — shows tailnet/account name)
4. If admin approval required:
   → admin.tailscale.com → Machines → Approve your phone
5. Verify: Tailscale app shows "Connected"
6. Verify EC2 is visible: Machines list should show 100.85.26.99
```

### 3. Verify Tailscale connectivity

```bash
# From EC2 — check phone is visible on the tailnet
sudo tailscale status

# After container is running, test from laptop (if also on Tailscale):
curl http://100.85.26.99:8081/status
# Expected: {"status":"Metro is running"}
```

### 4. docker-compose.yml

```yaml
version: "3.8"

services:
  expo:
    build: .
    working_dir: /app
    volumes:
      - ./:/app
      - /app/node_modules
    command: npx expo start --lan --non-interactive
    ports:
      - "8081:8081"              # Metro bundler (JS bundle + HMR WebSocket)
      - "19000:19000"            # Expo Go handshake
      - "19001:19001"            # Metro inspector (optional)
    environment:
      - REACT_NATIVE_PACKAGER_HOSTNAME=100.85.26.99   # Tailscale IP
    restart: unless-stopped
```

### 5. QR code URL format

```
exp://100.85.26.99:8081
```

> If QR shows `exp://172.17.x.x:8081` (Docker internal IP) → `REACT_NATIVE_PACKAGER_HOSTNAME`
> is not being picked up. Verify: `docker compose exec expo env | grep HOSTNAME`

### 6. Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| QR shows `172.17.x.x` | Env var not set | Check `docker compose exec expo env \| grep HOSTNAME` |
| Bundle never loads after scan | Tailscale disconnected on phone | Toggle Tailscale off/on in phone app |
| `Connection refused` on port 8081 | Container not running or port not mapped | `docker compose ps` + `ss -tulnp \| grep 8081` |
| Phone can't reach 100.85.26.99 | Different Tailscale account | `sudo tailscale status` — confirm tailnet name |
| Connected but no traffic | MagicDNS/subnet conflict | Disable MagicDNS in admin.tailscale.com temporarily |

### Pros / Cons

| Pros | Cons |
|------|------|
| ~10–50ms HMR (direct P2P) | Requires Tailscale on phone |
| Stable — rarely drops | One-time setup needed |
| No Expo account needed | |
| No Security Group changes | |
| Works on any carrier/network | |

---

## Hybrid Setup (both options in one file)

```yaml
version: "3.8"

services:
  expo-tailscale:
    profiles: ["tailscale"]
    build: .
    working_dir: /app
    volumes:
      - ./:/app
      - /app/node_modules
    command: npx expo start --lan --non-interactive
    ports:
      - "8081:8081"
      - "19000:19000"
      - "19001:19001"
    environment:
      - REACT_NATIVE_PACKAGER_HOSTNAME=100.85.26.99

  expo-tunnel:
    profiles: ["tunnel"]
    build: .
    working_dir: /app
    volumes:
      - ./:/app
      - /app/node_modules
    command: npx expo start --tunnel --non-interactive
    env_file:
      - .env                     # contains EXPO_TOKEN=...
```

```bash
# Daily development (fast):
docker compose --profile tailscale up

# Sharing with others / no Tailscale on phone:
docker compose --profile tunnel up
```

---

## Speed Comparison

```
Tailscale  ████████████  ~10–50ms    direct P2P, same as LAN
Tunnel     ████░░░░░░░░  ~200–800ms  relayed through ngrok
```

---

## Security Notes (if you ever open Security Group ports)

After testing, immediately close ports 8081 / 19000 / 19001:
- EC2 → Security Groups → Inbound rules → delete or restrict to your IP
- Metro has no authentication — anyone with access to those ports can pull your full JS bundle
- EC2 public IPs are port-scanned within minutes of exposure

With Tailscale, no public ports are needed — all traffic is encrypted peer-to-peer.

---

## Quick Reference

| Scenario | Option | Key setting |
|----------|--------|-------------|
| Daily dev, phone has Tailscale | **Option B** | `REACT_NATIVE_PACKAGER_HOSTNAME=100.85.26.99` |
| Demo to others / no Tailscale | **Option A** | `EXPO_TOKEN=...` + `--tunnel` |
| Phone on same LAN as EC2 | Option B with LAN IP | Replace with actual LAN IP |
| Emulator on same machine | Neither — use `--localhost` | No env var needed |
