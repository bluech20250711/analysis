import path from 'node:path';

export const HWPX_TEMPLATE_DIR = path.resolve(process.cwd(), 'templates/hwpx-template');
export const SECTION0_PATH = path.join(HWPX_TEMPLATE_DIR, 'Contents/section0.xml');
export const LISTENING_SINGLE_LINE_FRAGMENT_PATH = path.join(
  HWPX_TEMPLATE_DIR,
  'fragments/listening-single-line.template.xml',
);
