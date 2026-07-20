import path from 'node:path';
import { resolveTemplateDir } from '../resolveTemplateDir';

export const HWPX_TEMPLATE_DIR = resolveTemplateDir(import.meta.url, 'templates/hwpx-template');
export const SECTION0_PATH = path.join(HWPX_TEMPLATE_DIR, 'Contents/section0.xml');
export const LISTENING_SINGLE_LINE_FRAGMENT_PATH = path.join(
  HWPX_TEMPLATE_DIR,
  'fragments/listening-single-line.template.xml',
);
