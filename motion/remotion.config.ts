import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {Config} from '@remotion/cli/config';

// Reuse a local browser on Windows; other hosts use Remotion's managed browser.
const localChrome = process.platform === 'win32'
  ? join(process.env.ProgramFiles ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe')
  : undefined;
const browser = process.env.REMOTION_BROWSER_EXECUTABLE ??
  (localChrome && existsSync(localChrome) ? localChrome : undefined);
if (browser) Config.setBrowserExecutable(browser);
