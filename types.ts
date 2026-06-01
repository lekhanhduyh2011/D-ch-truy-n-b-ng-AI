
export interface TranslationResult {
  title: string;
  chapterNumber: string;
  chapterName: string;
  content: string;
  detectedGenre?: string;
  detectedStyle?: string;
}

export enum InputMode {
  TEXT = 'TEXT',
  URL = 'URL',
  FILE = 'FILE',
  HAN_VIET = 'HAN_VIET'
}

export type SourceLanguage = 'CN' | 'EN';

export interface TranslationState {
  isTranslating: boolean;
  error: string | null;
  result: TranslationResult | null;
  sourceText: string;
}

export type NovelGenre = 'Tu Tiên' | 'Kiếm Hiệp' | 'Huyền Huyễn' | 'Ngôn Tình' | 'Đô Thị' | 'Dã Sử' | 'Fantasy' | 'Sci-Fi' | 'Kinh Dị' | 'Tự động nhận diện';
export type NovelStyle = 'Cổ Phong' | 'Hiện Đại' | 'Hài Hước' | 'Trang Trọng' | 'Tự động nhận diện';
