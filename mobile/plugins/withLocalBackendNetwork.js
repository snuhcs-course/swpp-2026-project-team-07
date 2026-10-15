// AI-generated with OpenAI Codex, Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#playback-transcription-and-home-visual-corrections-october-14-2026
// Allow HTTP only for the USB-forwarded phone and Android emulator development hosts.
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const filename = 'outloud_local_network_security.xml';
const releaseContents = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">127.0.0.1</domain>
    <domain includeSubdomains="false">localhost</domain>
    <domain includeSubdomains="false">10.0.2.2</domain>
  </domain-config>
</network-security-config>
`;
// The debug build loads Metro from the development machine's LAN address.
const debugContents = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true" />
</network-security-config>
`;

module.exports = function withLocalBackendNetwork(config) {
  config = withAndroidManifest(config, value => {
    const app = value.modResults.manifest.application?.[0];
    if (!app) throw new Error('OutLoud Android application manifest is missing.');
    app.$['android:networkSecurityConfig'] = '@xml/outloud_local_network_security';
    return value;
  });
  return withDangerousMod(config, ['android', async value => {
    for (const [variant, contents] of [['main', releaseContents], ['debug', debugContents]]) {
      const target = path.join(value.modRequest.platformProjectRoot, 'app', 'src', variant, 'res', 'xml', filename);
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.writeFile(target, contents);
    }
    return value;
  }]);
};
