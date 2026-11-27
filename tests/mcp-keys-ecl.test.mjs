/** v56.40 (التحقق المحاسبي): موصل الخادم يحتفظ بمستندات المخصص كي يطابق ميزانه التطبيق */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MCP_OPS_KEYS } from '../server-mcp.js';
test('MCP_OPS_KEYS يشمل eclDocs', () => { assert.ok(MCP_OPS_KEYS.has('eclDocs')); });
