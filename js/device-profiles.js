// Switch — Device auto-setup generators
// Generates config profiles, scripts, and links for each platform

// Detect current platform
export function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/macintosh|mac os x/.test(ua)) return 'macos';
  if (/android/.test(ua)) return 'android';
  if (/windows/.test(ua)) return 'windows';
  if (/linux/.test(ua)) return 'linux';
  return 'unknown';
}

// --- iOS / macOS .mobileconfig ---

export function generateMobileConfig(dnsConfig, platform = 'ios') {
  const uuid1 = crypto.randomUUID().toUpperCase();
  const uuid2 = crypto.randomUUID().toUpperCase();
  const uuid3 = crypto.randomUUID().toUpperCase();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>DNSSettings</key>
      <dict>
        <key>DNSProtocol</key>
        <string>HTTPS</string>
        <key>ServerURL</key>
        <string>${escapeXml(dnsConfig.dohEndpoint)}</string>
      </dict>
      <key>OnDemandRules</key>
      <array>
        <dict>
          <key>Action</key>
          <string>EvaluateConnection</string>
          <key>ActionParameters</key>
          <array>
            <dict>
              <key>DomainAction</key>
              <string>NeverConnect</string>
              <key>Domains</key>
              <array>
                <string>${escapeXml(dnsConfig.dotHostname)}</string>
              </array>
            </dict>
          </array>
        </dict>
        <dict>
          <key>Action</key>
          <string>Connect</string>
        </dict>
      </array>
      <key>PayloadDisplayName</key>
      <string>SwitchBoard DNS Protection</string>
      <key>PayloadIdentifier</key>
      <string>com.switchboard.dns.${uuid2}</string>
      <key>PayloadType</key>
      <string>com.apple.dnsSettings.managed</string>
      <key>PayloadUUID</key>
      <string>${uuid2}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>ProhibitDisablement</key>
      <false/>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Configures DNS-over-HTTPS to route through your Switch DNS filter, blocking distracting and harmful websites.</string>
  <key>PayloadDisplayName</key>
  <string>SwitchBoard DNS Protection</string>
  <key>PayloadIdentifier</key>
  <string>com.switchboard.profile.${uuid1}</string>
  <key>PayloadOrganization</key>
  <string>Switch</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${uuid3}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
  <key>ConsentText</key>
  <dict>
    <key>default</key>
    <string>This profile sets your DNS to route through Cloudflare Gateway with your Switch blocking rules. You can remove it anytime in Settings.</string>
  </dict>
</dict>
</plist>`;

  return xml;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function downloadMobileConfig(dnsConfig, platform) {
  const xml = generateMobileConfig(dnsConfig, platform);
  const blob = new Blob([xml], { type: 'application/x-apple-aspen-config' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Switch-DNS.mobileconfig';
  a.click();
  URL.revokeObjectURL(url);
}

// --- Windows PowerShell Script ---

export function generateWindowsScript(dnsConfig) {
  return `# SwitchBoard DNS Protection Setup for Windows
# This script configures DNS-over-HTTPS with your Switch blocking rules.
# Right-click this file and select "Run with PowerShell" (as Administrator)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "  SwitchBoard DNS Protection Installer" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "This will configure your DNS to use your Switch blocking rules."
Write-Host "DoH endpoint: ${dnsConfig.dohEndpoint}"
Write-Host ""

# Check for admin privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Restarting as Administrator..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File \`"$PSCommandPath\`"" -Verb RunAs
    exit
}

# Configure DoH for Windows 11+
$osVersion = [System.Environment]::OSVersion.Version
if ($osVersion.Build -ge 22000) {
    Write-Host "Configuring DNS-over-HTTPS (Windows 11+)..." -ForegroundColor Cyan

    # Add the DoH template
    $dohTemplate = "${dnsConfig.dohEndpoint}"
    try {
        netsh dns add encryption server="${dnsConfig.ipv4 || '1.1.1.1'}" dohtemplate="$dohTemplate" autoupgrade=yes udpfallback=no
        Write-Host "  DoH template added." -ForegroundColor Green
    } catch {
        Write-Host "  Note: Could not add DoH template. Falling back to standard DNS." -ForegroundColor Yellow
    }
}

# Set DNS on all active adapters
$adapters = Get-NetAdapter | Where-Object { $_.Status -eq "Up" }
foreach ($adapter in $adapters) {
    Write-Host "Configuring adapter: $($adapter.Name)..." -ForegroundColor Cyan
    Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses ("${dnsConfig.ipv4 || '172.64.36.1'}", "${dnsConfig.ipv6 || '2606:4700:4700::1111'}")
    Write-Host "  DNS set." -ForegroundColor Green
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your devices are now protected by Switch."
Write-Host "To undo, set DNS back to 'Automatic' in Network Settings."
Write-Host ""
Read-Host "Press Enter to close"
`;
}

export function downloadWindowsScript(dnsConfig) {
  const script = generateWindowsScript(dnsConfig);
  const blob = new Blob([script], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Switch-DNS-Setup.ps1';
  a.click();
  URL.revokeObjectURL(url);
}

// --- Linux Shell Script ---

export function generateLinuxScript(dnsConfig) {
  return `#!/bin/bash
# SwitchBoard DNS Protection Setup for Linux
# Run: chmod +x switch-setup.sh && sudo ./switch-setup.sh

set -e

GREEN='\\033[0;32m'
CYAN='\\033[0;36m'
YELLOW='\\033[0;33m'
NC='\\033[0m'

echo ""
echo -e "\${GREEN}====================================$\{NC}"
echo -e "\${GREEN}  SwitchBoard DNS Protection Installer\${NC}"
echo -e "\${GREEN}====================================$\{NC}"
echo ""
echo "DoH endpoint: ${dnsConfig.dohEndpoint}"
echo "DNS hostname: ${dnsConfig.dotHostname}"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
  echo "Please run with sudo: sudo ./switch-setup.sh"
  exit 1
fi

# Backup current DNS
echo -e "\${CYAN}Backing up current DNS config...\${NC}"
if [ -f /etc/resolv.conf ]; then
  cp /etc/resolv.conf /etc/resolv.conf.switch-backup
  echo "  Backed up to /etc/resolv.conf.switch-backup"
fi

# Detect and configure
if command -v resolvectl &> /dev/null; then
  echo -e "\${CYAN}Detected systemd-resolved. Configuring...\${NC}"

  # Configure systemd-resolved for DoT
  mkdir -p /etc/systemd/resolved.conf.d/
  cat > /etc/systemd/resolved.conf.d/switch-dns.conf << DNSEOF
[Resolve]
DNS=${dnsConfig.ipv4 || '172.64.36.1'}#${dnsConfig.dotHostname}
DNSOverTLS=yes
Domains=~.
DNSEOF

  systemctl restart systemd-resolved
  echo -e "\${GREEN}  systemd-resolved configured.\${NC}"

elif command -v nmcli &> /dev/null; then
  echo -e "\${CYAN}Detected NetworkManager. Configuring...\${NC}"

  CONN=$(nmcli -t -f NAME,DEVICE connection show --active | head -1 | cut -d: -f1)
  if [ -n "$CONN" ]; then
    nmcli connection modify "$CONN" ipv4.dns "${dnsConfig.ipv4 || '172.64.36.1'}"
    nmcli connection modify "$CONN" ipv4.ignore-auto-dns yes
    nmcli connection up "$CONN" > /dev/null 2>&1
    echo -e "\${GREEN}  NetworkManager configured for connection: $CONN\${NC}"
  fi

else
  echo -e "\${CYAN}Configuring /etc/resolv.conf directly...\${NC}"
  echo "nameserver ${dnsConfig.ipv4 || '172.64.36.1'}" > /etc/resolv.conf
  echo -e "\${GREEN}  resolv.conf updated.\${NC}"
fi

echo ""
echo -e "\${GREEN}====================================$\{NC}"
echo -e "\${GREEN}  Setup complete!\${NC}"
echo -e "\${GREEN}====================================$\{NC}"
echo ""
echo "Your device is now protected by Switch."
echo "To undo: sudo cp /etc/resolv.conf.switch-backup /etc/resolv.conf"
echo ""
`;
}

export function downloadLinuxScript(dnsConfig) {
  const script = generateLinuxScript(dnsConfig);
  const blob = new Blob([script], { type: 'text/x-shellscript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'switch-setup.sh';
  a.click();
  URL.revokeObjectURL(url);
}

// --- QR Code (simple inline generator for Android) ---

export function generateQRCodeSVG(text, size = 200) {
  // We'll use a lightweight QR code library loaded from CDN
  // For now, return a placeholder that app.js will fill with the real QR
  return { text, size };
}

// --- WARP Links ---

export function getWarpLinks(teamName) {
  return {
    ios: 'https://apps.apple.com/app/cloudflare-one-agent/id6443476492',
    android: 'https://play.google.com/store/apps/details?id=com.cloudflare.onedotonedotonedotone',
    windows: 'https://install.appcenter.ms/orgs/cloudflare/apps/1.1.1.1-windows-1/distribution_groups/release',
    linux: 'https://pkg.cloudflareclient.com/',
    enrollmentUrl: teamName ? `https://${teamName}.cloudflareaccess.com/warp` : null,
  };
}

// --- Share Link ---

export function generateShareLink(dnsConfig) {
  const params = new URLSearchParams();
  if (dnsConfig.teamName) params.set('team', dnsConfig.teamName);
  if (dnsConfig.dohEndpoint) params.set('doh', dnsConfig.dohEndpoint);
  if (dnsConfig.dotHostname) params.set('dot', dnsConfig.dotHostname);
  if (dnsConfig.ipv4) params.set('ipv4', dnsConfig.ipv4);
  return `${window.location.origin}/setup?${params}`;
}

export async function shareLink(dnsConfig) {
  const url = generateShareLink(dnsConfig);
  if (navigator.share) {
    await navigator.share({
      title: 'SwitchBoard DNS Protection',
      text: 'Set up Switch DNS blocking on your device',
      url,
    });
  } else {
    await navigator.clipboard.writeText(url);
    return 'copied';
  }
  return 'shared';
}

// --- Platform display info ---

export const platforms = [
  {
    id: 'ios',
    name: 'iPhone / iPad',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
    action: 'Install Profile',
    description: 'Downloads a configuration profile. Tap to install in Settings.',
  },
  {
    id: 'macos',
    name: 'Mac',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    action: 'Download Profile',
    description: 'Downloads a configuration profile for macOS.',
  },
  {
    id: 'android',
    name: 'Android',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
    action: 'Set Up Now',
    description: 'Copies your DNS hostname. Paste it in Private DNS settings.',
  },
  {
    id: 'windows',
    name: 'Windows',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    action: 'Download Setup',
    description: 'Downloads a setup script. Right-click → Run with PowerShell.',
  },
  {
    id: 'linux',
    name: 'Linux',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    action: 'Download Script',
    description: 'Downloads a shell script. Run with: sudo ./switch-setup.sh',
  },
  {
    id: 'router',
    name: 'Router (whole network)',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="14" width="20" height="6" rx="1"/><circle cx="6" cy="17" r="1" fill="currentColor"/><circle cx="10" cy="17" r="1" fill="currentColor"/><path d="M6 14V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6"/></svg>`,
    action: 'View DNS Addresses',
    description: 'Enter these DNS addresses in your router admin panel.',
  },
];
