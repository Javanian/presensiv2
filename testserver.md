Expo Dev Server on Docker — Port Analysis & Fix
1. Relevant Expo Ports (none are currently open)
Port	Purpose	Required?
8081	Metro bundler (bundle serving)	Yes — always
19000	Expo Go classic connection	Yes (SDK <49)
19001	Metro inspector proxy	Optional
19002	Expo DevTools web UI	Optional
Your current ports 8008/8009 are unrelated. None of the Expo ports are exposed yet.

2. Which Mode to Use
You have Tailscale (100.85.26.99). Three options ranked by reliability:

Mode	When to use	QR code contains
--tunnel	Phone not on same LAN or Tailscale	ngrok URL — works anywhere, slow
--lan	Phone on same LAN or Tailscale	LAN/Tailscale IP
--localhost	Only for emulators on same machine	localhost — won't work on phone
Best option: If your phone has Tailscale installed → use --lan with Tailscale IP.
Fallback: --tunnel works anywhere, no firewall config needed.

3. docker-compose.yml Configuration

services:
  expo:
    image: node:20-alpine   # or your existing image
    working_dir: /app
    volumes:
      - ./:/app
    command: npx expo start --lan
    ports:
      - "8081:8081"     # Metro bundler — REQUIRED
      - "19000:19000"   # Expo Go connection — REQUIRED
      - "19001:19001"   # Metro inspector
      - "19002:19002"   # DevTools (optional, browser UI)
    environment:
      # CRITICAL: tells Metro what IP to put in the QR code
      # Use Tailscale IP if phone is on Tailscale, otherwise LAN IP
      - REACT_NATIVE_PACKAGER_HOSTNAME=100.85.26.99
    network_mode: host   # Alternative to port mapping — simpler but less isolated
If using network_mode: host, remove the ports: block entirely — all container ports are directly on the host. This avoids Docker NAT issues with Metro's WebSocket connection.

If keeping bridge networking (with ports:), the REACT_NATIVE_PACKAGER_HOSTNAME env var is mandatory — otherwise Metro advertises 172.17.x.x (Docker internal IP) in the QR code, which your phone can't reach.

4. For Tunnel Mode (no firewall changes needed)

command: npx expo start --tunnel
environment:
  - EXPO_TOKEN=your_expo_token  # needed for tunnel auth in CI/non-interactive
Remove the ports: block — tunnel goes outbound only.

5. Firewall Checks

# Check if ufw is active
sudo ufw status

# If active, open Expo ports
sudo ufw allow 8081/tcp
sudo ufw allow 19000/tcp
sudo ufw allow 19001/tcp

# Verify ports are actually listening after container starts
ss -tulnp | grep -E '8081|19000|19001'

# Test from phone's perspective (run on a device on the same network)
# Or test locally:
curl http://100.85.26.99:8081/status
# Should return: {"status":"Metro is running"}
6. Pre-scan Verification Checklist

# 1. Container is up and Metro is running
docker compose logs expo | grep "Metro waiting"

# 2. Port is bound on host (not just in container)
ss -tulnp | grep 8081

# 3. Metro responds
curl http://localhost:8081/status

# 4. Reachable via Tailscale IP
curl http://100.85.26.99:8081/status

# 5. Check QR code URL matches your accessible IP
docker compose logs expo | grep "exp://"
# Should show exp://100.85.26.99:8081 — not exp://172.17.x.x
Summary Recommendation
Since you have Tailscale, the cleanest setup:

Install Tailscale on your phone
Use --lan mode with REACT_NATIVE_PACKAGER_HOSTNAME=100.85.26.99
Expose ports 8081 and 19000 in docker-compose
No firewall rules needed for Tailscale traffic (it's already authenticated)
If you don't want Tailscale on the phone, use --tunnel — zero config, works through any network.