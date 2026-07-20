import path from 'node:path';

export const PDF_TEMPLATE_DIR = path.resolve(process.cwd(), 'templates/pdf-template');
export const FONT_REGULAR_PATH = path.join(PDF_TEMPLATE_DIR, 'fonts/NotoSansKR-Regular.otf');
export const FONT_BOLD_PATH = path.join(PDF_TEMPLATE_DIR, 'fonts/NotoSansKR-Bold.otf');
