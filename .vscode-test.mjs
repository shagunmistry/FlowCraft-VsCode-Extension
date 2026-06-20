import { defineConfig } from '@vscode/test-cli';
import { tmpdir } from 'os';
import { join } from 'path';

const tempDir = process.env.VSCODE_TEST_TEMP_DIR || join(tmpdir(), 'vscode-test');

export default defineConfig({
	files: 'out/test/**/*.test.js',
	launchArgs: ['--user-data-dir', tempDir],
});
