export type ZplSourceSegmentKind = 'command' | 'field-data' | 'comment' | 'graphic' | 'raw';

export interface ZplSourceSegment {
  kind: ZplSourceSegmentKind;
  command: string | null;
  start: number;
  end: number;
  raw: string;
}

export interface ZplSourceDiagnostic {
  code: 'unclosed-block' | 'malformed-control' | 'custom-control-prefix';
  message: string;
  offset: number;
}

export interface ZplSourceDocument {
  source: string;
  segments: ZplSourceSegment[];
  diagnostics: ZplSourceDiagnostic[];
}

export interface ZplSourceEdit {
  start: number;
  end: number;
  expected: string;
  replacement: string;
}

function commandAt(source: string, offset: number): string | null {
  const control = source[offset];
  const name = source.slice(offset + 1, offset + 3);
  if ((control !== '^' && control !== '~') || name.length !== 2 || !/^[A-Z0-9@!#$%&()*+\-./:<=>?[\]\\^_`{|}~]{2}$/.test(name)) {
    return null;
  }
  return `${control}${name}`;
}

function nextControl(source: string, from: number): number {
  const caret = source.indexOf('^', from);
  const tilde = source.indexOf('~', from);
  if (caret < 0) return tilde < 0 ? source.length : tilde;
  if (tilde < 0) return caret;
  return Math.min(caret, tilde);
}

function findBlockEnd(source: string, from: number): number {
  let cursor = from;
  while (cursor < source.length) {
    const control = nextControl(source, cursor);
    if (control >= source.length) return source.length;
    if (commandAt(source, control) === '^FS') return control + 3;
    cursor = control + 3;
  }
  return source.length;
}

export function parseZplSource(source: string): ZplSourceDocument {
  const segments: ZplSourceSegment[] = [];
  const diagnostics: ZplSourceDiagnostic[] = [];
  let offset = 0;

  const add = (kind: ZplSourceSegmentKind, start: number, end: number, command: string | null = null) => {
    if (end <= start) return;
    segments.push({ kind, command, start, end, raw: source.slice(start, end) });
  };

  while (offset < source.length) {
    const control = nextControl(source, offset);
    if (control > offset) add('raw', offset, control);
    if (control >= source.length) break;

    const command = commandAt(source, control);
    if (!command) {
      add('raw', control, control + 1);
      diagnostics.push({
        code: 'malformed-control',
        message: 'A control character is not followed by a complete ZPL command.',
        offset: control,
      });
      offset = control + 1;
      continue;
    }

    if (command === '^FD' || command === '^FX' || command === '^GF') {
      const blockEnd = findBlockEnd(source, control + command.length);
      const kind = command === '^FD' ? 'field-data' : command === '^FX' ? 'comment' : 'graphic';
      add(kind, control, blockEnd, command);
      if (blockEnd === source.length && !source.endsWith('^FS')) {
        diagnostics.push({
          code: 'unclosed-block',
          message: `${command} has no terminating ^FS; the remaining source is preserved as one opaque block.`,
          offset: control,
        });
      }
      offset = blockEnd;
      continue;
    }

    const end = nextControl(source, control + command.length);
    add('command', control, end, command);
    if (command === '^CC' || command === '^CT') {
      diagnostics.push({
        code: 'custom-control-prefix',
        message: `${command} changes the ZPL control prefix; following commands are preserved but not structurally interpreted.`,
        offset: control,
      });
      add('raw', end, source.length);
      break;
    }
    offset = end;
  }

  return { source, segments, diagnostics };
}

export function serializeZplSource(document: Pick<ZplSourceDocument, 'source' | 'segments'>): string {
  const reconstructed = document.segments.map((segment) => segment.raw).join('');
  if (reconstructed !== document.source) {
    throw new Error('ZPL source segments do not reconstruct the original source.');
  }
  return reconstructed;
}

export function applyZplSourceEdits(source: string, edits: ZplSourceEdit[]): string {
  const ordered = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  let previousEnd = 0;

  for (const edit of ordered) {
    if (!Number.isInteger(edit.start) || !Number.isInteger(edit.end) || edit.start < 0 || edit.end < edit.start || edit.end > source.length) {
      throw new Error('ZPL edit has an invalid source range.');
    }
    if (edit.start < previousEnd) throw new Error('ZPL edits overlap.');
    if (source.slice(edit.start, edit.end) !== edit.expected) {
      throw new Error('ZPL source changed since the edit range was captured.');
    }
    previousEnd = edit.end;
  }

  let result = source;
  for (const edit of ordered.reverse()) {
    result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
  }
  return result;
}

export function replaceZplSegment(
  document: Pick<ZplSourceDocument, 'source' | 'segments'>,
  segmentIndex: number,
  replacement: string
): string {
  const segment = document.segments[segmentIndex];
  if (!segment) throw new Error(`ZPL source segment ${segmentIndex} does not exist.`);
  return applyZplSourceEdits(document.source, [{
    start: segment.start,
    end: segment.end,
    expected: segment.raw,
    replacement,
  }]);
}
