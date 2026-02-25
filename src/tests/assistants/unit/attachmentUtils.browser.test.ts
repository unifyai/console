import { describe, it, expect } from 'vitest';
import {
  getAttachmentType,
  getAttachmentIcon,
  getAttachmentColor,
  validateFile,
  formatFileSize,
  truncateFilename,
  createAttachment,
} from '@/components/Chat/attachmentUtils';
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  Image,
  FileCode,
  FileArchive,
  File,
} from 'lucide-react';
import type { AttachmentType } from '@/types/assistants/chat';
import { createTestFile } from '../integration/fixtures/chatTestHarness';

describe('attachmentUtils', () => {
  describe('getAttachmentType', () => {
    it('should return pdf for .pdf files', () => {
      expect(getAttachmentType('report.pdf')).toBe('pdf');
    });

    it('should return word for .doc and .docx files', () => {
      expect(getAttachmentType('document.doc')).toBe('word');
      expect(getAttachmentType('document.docx')).toBe('word');
    });

    it('should return excel for .xls, .xlsx, .csv files', () => {
      expect(getAttachmentType('spreadsheet.xls')).toBe('excel');
      expect(getAttachmentType('spreadsheet.xlsx')).toBe('excel');
      expect(getAttachmentType('data.csv')).toBe('excel');
    });

    it('should return powerpoint for .ppt and .pptx files', () => {
      expect(getAttachmentType('presentation.ppt')).toBe('powerpoint');
      expect(getAttachmentType('presentation.pptx')).toBe('powerpoint');
    });

    it('should return image for image extensions', () => {
      expect(getAttachmentType('photo.png')).toBe('image');
      expect(getAttachmentType('photo.jpg')).toBe('image');
      expect(getAttachmentType('photo.jpeg')).toBe('image');
      expect(getAttachmentType('animation.gif')).toBe('image');
      expect(getAttachmentType('photo.webp')).toBe('image');
      expect(getAttachmentType('icon.svg')).toBe('image');
    });

    it('should return text for text file extensions', () => {
      expect(getAttachmentType('notes.txt')).toBe('text');
      expect(getAttachmentType('readme.md')).toBe('text');
    });

    it('should return code for code file extensions', () => {
      expect(getAttachmentType('data.json')).toBe('code');
      expect(getAttachmentType('script.js')).toBe('code');
      expect(getAttachmentType('component.ts')).toBe('code');
      expect(getAttachmentType('component.tsx')).toBe('code');
      expect(getAttachmentType('component.jsx')).toBe('code');
      expect(getAttachmentType('script.py')).toBe('code');
      expect(getAttachmentType('page.html')).toBe('code');
      expect(getAttachmentType('styles.css')).toBe('code');
      expect(getAttachmentType('data.xml')).toBe('code');
    });

    it('should return archive for archive extensions', () => {
      expect(getAttachmentType('archive.zip')).toBe('archive');
      expect(getAttachmentType('backup.tar')).toBe('archive');
      expect(getAttachmentType('compressed.gz')).toBe('archive');
    });

    it('should return generic for unknown extensions', () => {
      expect(getAttachmentType('file.xyz')).toBe('generic');
      expect(getAttachmentType('unknown.abc')).toBe('generic');
    });

    it('should handle uppercase extensions', () => {
      expect(getAttachmentType('REPORT.PDF')).toBe('pdf');
      expect(getAttachmentType('IMAGE.PNG')).toBe('image');
    });

    it('should handle files without extensions', () => {
      expect(getAttachmentType('README')).toBe('generic');
    });
  });

  describe('getAttachmentIcon', () => {
    it('should return FileText for pdf type', () => {
      expect(getAttachmentIcon('pdf')).toBe(FileText);
    });

    it('should return FileText for word type', () => {
      expect(getAttachmentIcon('word')).toBe(FileText);
    });

    it('should return FileSpreadsheet for excel type', () => {
      expect(getAttachmentIcon('excel')).toBe(FileSpreadsheet);
    });

    it('should return Presentation for powerpoint type', () => {
      expect(getAttachmentIcon('powerpoint')).toBe(Presentation);
    });

    it('should return Image for image type', () => {
      expect(getAttachmentIcon('image')).toBe(Image);
    });

    it('should return FileText for text type', () => {
      expect(getAttachmentIcon('text')).toBe(FileText);
    });

    it('should return FileCode for code type', () => {
      expect(getAttachmentIcon('code')).toBe(FileCode);
    });

    it('should return FileArchive for archive type', () => {
      expect(getAttachmentIcon('archive')).toBe(FileArchive);
    });

    it('should return File for generic type', () => {
      expect(getAttachmentIcon('generic')).toBe(File);
    });
  });

  describe('getAttachmentColor', () => {
    it('should return CSS variable for pdf', () => {
      expect(getAttachmentColor('pdf')).toBe('var(--file-pdf)');
    });

    it('should return CSS variable for word', () => {
      expect(getAttachmentColor('word')).toBe('var(--file-word)');
    });

    it('should return CSS variable for excel', () => {
      expect(getAttachmentColor('excel')).toBe('var(--file-excel)');
    });

    it('should return CSS variable for powerpoint', () => {
      expect(getAttachmentColor('powerpoint')).toBe('var(--file-powerpoint)');
    });

    it('should return CSS variable for image', () => {
      expect(getAttachmentColor('image')).toBe('var(--file-image)');
    });

    it('should return CSS variable for text', () => {
      expect(getAttachmentColor('text')).toBe('var(--file-text)');
    });

    it('should return CSS variable for code', () => {
      expect(getAttachmentColor('code')).toBe('var(--file-code)');
    });

    it('should return CSS variable for archive', () => {
      expect(getAttachmentColor('archive')).toBe('var(--file-archive)');
    });

    it('should return CSS variable for generic', () => {
      expect(getAttachmentColor('generic')).toBe('var(--file-generic)');
    });
  });

  describe('validateFile', () => {
    it('should accept files under 25MB', () => {
      const content = 'x'.repeat(20 * 1024 * 1024);
      const file = createTestFile('small.pdf', content, 'application/pdf');
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject files over 25MB', () => {
      const content = 'x'.repeat(26 * 1024 * 1024);
      const file = createTestFile('large.pdf', content, 'application/pdf');
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File exceeds 25MB limit');
    });

    it('should accept files exactly 25MB', () => {
      const content = 'x'.repeat(25 * 1024 * 1024);
      const file = createTestFile('exact.pdf', content, 'application/pdf');
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });
  });

  describe('formatFileSize', () => {
    it('should format 0 bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('should format bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1023)).toBe('1023 B');
    });

    it('should format KB correctly', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(102400)).toBe('100.0 KB');
    });

    it('should format MB correctly', () => {
      expect(formatFileSize(1048576)).toBe('1.0 MB');
      expect(formatFileSize(5242880)).toBe('5.0 MB');
      expect(formatFileSize(10485760)).toBe('10.0 MB');
    });

    it('should handle decimal places', () => {
      expect(formatFileSize(1536)).toMatch(/^1\.\d KB$/);
      expect(formatFileSize(2621440)).toMatch(/^2\.\d MB$/);
    });
  });

  describe('truncateFilename', () => {
    it('should not truncate short names', () => {
      expect(truncateFilename('file.pdf', 20)).toBe('file.pdf');
      expect(truncateFilename('short.txt', 20)).toBe('short.txt');
    });

    it('should truncate long names with ellipsis', () => {
      const result = truncateFilename('very-long-filename-that-needs-truncation.pdf', 20);
      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('should preserve file extension', () => {
      const result = truncateFilename('very-long-filename-that-needs-truncation.pdf', 20);
      expect(result).toMatch(/\.pdf$/);
    });

    it('should handle files without extensions', () => {
      const result = truncateFilename('verylongfilenamewithoutextension', 20);
      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('should use default maxLength of 20', () => {
      const result = truncateFilename('this-is-a-very-long-filename-indeed.txt');
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('should handle custom maxLength', () => {
      const result = truncateFilename('medium-length-file.pdf', 15);
      expect(result.length).toBeLessThanOrEqual(15);
    });
  });

  describe('createAttachment', () => {
    it('should create attachment with unique id', () => {
      const file = createTestFile('test.pdf', 'content', 'application/pdf');
      const attachment1 = createAttachment(file);
      const attachment2 = createAttachment(file);

      expect(attachment1.id).toBeTruthy();
      expect(attachment2.id).toBeTruthy();
      expect(attachment1.id).not.toBe(attachment2.id);
    });

    it('should derive correct type from filename', () => {
      const pdfFile = createTestFile('document.pdf', 'content', 'application/pdf');
      const pdfAttachment = createAttachment(pdfFile);
      expect(getAttachmentType(pdfAttachment.filename)).toBe('pdf');

      const imageFile = createTestFile('photo.png', 'content', 'image/png');
      const imageAttachment = createAttachment(imageFile);
      expect(getAttachmentType(imageAttachment.filename)).toBe('image');
    });

    it('should include file size as sizeBytes', () => {
      const file = createTestFile('test.txt', 'hello world', 'text/plain');
      const attachment = createAttachment(file);
      expect(attachment.sizeBytes).toBe(file.size);
    });

    it('should include filename', () => {
      const file = createTestFile(
        'myfile.docx',
        'content',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      const attachment = createAttachment(file);
      expect(attachment.filename).toBe('myfile.docx');
    });

    it('should include the file object', () => {
      const file = createTestFile('test.pdf', 'content', 'application/pdf');
      const attachment = createAttachment(file);
      expect(attachment.file).toBe(file);
    });
  });
});
