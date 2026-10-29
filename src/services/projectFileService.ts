import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { LabelProject } from '../types';

const PROJECT_FORMAT = 'e-studio-project';
const PROJECT_VERSION = 1;
const PROJECT_ZIP_MANIFEST = 'manifest.json';
const PROJECT_ZIP_PAYLOAD = 'project.json';
const PBKDF2_ITERATIONS = 310_000;
const MAX_PROJECT_BYTES = 128 * 1024 * 1024;
const MAX_ZIP_DIRECTORY_BYTES = 65_557;

interface ProjectEnvelope {
  format: typeof PROJECT_FORMAT;
  version: typeof PROJECT_VERSION;
  encrypted: boolean;
  payload: string;
  salt?: string;
  iv?: string;
  kdf?: 'PBKDF2-SHA-256';
  iterations?: number;
  cipher?: 'AES-256-GCM';
}

interface ProjectZipManifest {
  format: typeof PROJECT_FORMAT;
  version: typeof PROJECT_VERSION;
  project_id: string;
  project_name: string;
  encrypted: boolean;
}

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure project encryption is not available in this environment.');
  }
  return globalThis.crypto;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function deriveProjectKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  if (password.length < 8) {
    throw new Error('Project passwords must contain at least 8 characters.');
  }
  const crypto = getCrypto();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(new TextEncoder().encode(password)),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: toArrayBuffer(salt), iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function validateProject(value: unknown): LabelProject {
  if (!value || typeof value !== 'object') {
    throw new Error('The project file does not contain a valid project object.');
  }
  const project = value as Partial<LabelProject>;
  if (
    typeof project.id !== 'string' ||
    !project.id.trim() ||
    typeof project.name !== 'string' ||
    !project.name.trim() ||
    !Array.isArray(project.templates) ||
    !Array.isArray(project.data_sources)
  ) {
    throw new Error('The project file is missing required project metadata, templates, or data sources.');
  }
  if (project.templates.some((template) => !template || typeof template !== 'object')) {
    throw new Error('The project file contains an invalid template.');
  }
  if (project.data_sources.some((source) =>
    !source ||
    typeof source.id !== 'string' ||
    typeof source.name !== 'string' ||
    !Array.isArray(source.records)
  )) {
    throw new Error('The project file contains an invalid data source.');
  }
  return project as LabelProject;
}

async function createEnvelope(project: LabelProject, password?: string): Promise<ProjectEnvelope> {
  const payload = new TextEncoder().encode(JSON.stringify(validateProject(project)));
  if (payload.length > MAX_PROJECT_BYTES) {
    throw new Error('The project is too large to export.');
  }
  if (!password) {
    return {
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      encrypted: false,
      payload: toBase64(payload),
    };
  }

  const crypto = getCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveProjectKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(payload)
  );
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    encrypted: true,
    payload: toBase64(new Uint8Array(ciphertext)),
    salt: toBase64(salt),
    iv: toBase64(iv),
    kdf: 'PBKDF2-SHA-256',
    iterations: PBKDF2_ITERATIONS,
    cipher: 'AES-256-GCM',
  };
}

function validateEnvelope(value: unknown): ProjectEnvelope {
  if (!value || typeof value !== 'object') {
    throw new Error('The file is not an E-Studio project.');
  }
  const envelope = value as Partial<ProjectEnvelope>;
  if (envelope.format !== PROJECT_FORMAT || envelope.version !== PROJECT_VERSION || typeof envelope.payload !== 'string') {
    throw new Error('Unsupported or invalid E-Studio project file.');
  }
  if (
    envelope.encrypted &&
    (
      envelope.kdf !== 'PBKDF2-SHA-256' ||
      envelope.cipher !== 'AES-256-GCM' ||
      !Number.isInteger(envelope.iterations) ||
      !envelope.salt ||
      !envelope.iv
    )
  ) {
    throw new Error('The encrypted project file has invalid security metadata.');
  }
  return envelope as ProjectEnvelope;
}

async function openEnvelope(envelopeValue: unknown, password?: string): Promise<LabelProject> {
  const envelope = validateEnvelope(envelopeValue);
  const payloadBytes = fromBase64(envelope.payload);
  if (payloadBytes.length > MAX_PROJECT_BYTES) {
    throw new Error('The project file exceeds the maximum supported size.');
  }

  let plaintext: Uint8Array;
  if (envelope.encrypted) {
    if (!password) throw new Error('This project is password-protected.');
    if (envelope.iterations !== PBKDF2_ITERATIONS) {
      throw new Error('Unsupported project encryption parameters.');
    }
    const crypto = getCrypto();
    const key = await deriveProjectKey(password, fromBase64(envelope.salt!));
    try {
      plaintext = new Uint8Array(await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(fromBase64(envelope.iv!)) },
        key,
        toArrayBuffer(payloadBytes)
      ));
    } catch {
      throw new Error('The password is incorrect or the project file is damaged.');
    }
  } else {
    plaintext = payloadBytes;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error('The project payload is not valid JSON.');
  }
  return validateProject(parsed);
}

function validateZipDirectory(data: Uint8Array): void {
  if (data.length > MAX_PROJECT_BYTES) {
    throw new Error('The ZIP project exceeds the maximum supported file size.');
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const searchStart = Math.max(0, data.length - MAX_ZIP_DIRECTORY_BYTES);
  let endRecordOffset = -1;
  for (let offset = data.length - 22; offset >= searchStart; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endRecordOffset = offset;
      break;
    }
  }
  if (endRecordOffset < 0) throw new Error('The ZIP project is missing its central directory.');

  const entryCount = view.getUint16(endRecordOffset + 10, true);
  const directorySize = view.getUint32(endRecordOffset + 12, true);
  const directoryOffset = view.getUint32(endRecordOffset + 16, true);
  if (
    entryCount === 0xffff ||
    directorySize === 0xffffffff ||
    directoryOffset === 0xffffffff ||
    directoryOffset + directorySize > endRecordOffset
  ) {
    throw new Error('ZIP64 or malformed ZIP project files are not supported.');
  }

  let offset = directoryOffset;
  let totalUncompressedSize = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > data.length || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('The ZIP project has a malformed central directory entry.');
    }
    const uncompressedSize = view.getUint32(offset + 24, true);
    const filenameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if (uncompressedSize === 0xffffffff) {
      throw new Error('ZIP64 project entries are not supported.');
    }
    totalUncompressedSize += uncompressedSize;
    if (totalUncompressedSize > MAX_PROJECT_BYTES) {
      throw new Error('The uncompressed ZIP project exceeds the maximum supported size.');
    }
    offset += 46 + filenameLength + extraLength + commentLength;
  }
  if (offset > directoryOffset + directorySize) {
    throw new Error('The ZIP project central directory has invalid bounds.');
  }
}

export const projectFileService = {
  async exportEproj(project: LabelProject, password?: string): Promise<string> {
    const envelope = await createEnvelope(project, password);
    return JSON.stringify(envelope);
  },

  async importEproj(contents: string, password?: string): Promise<LabelProject> {
    if (new TextEncoder().encode(contents).length > MAX_PROJECT_BYTES) {
      throw new Error('The project file exceeds the maximum supported size.');
    }
    let envelope: unknown;
    try {
      envelope = JSON.parse(contents);
    } catch {
      throw new Error('The E-Studio project file is not valid JSON.');
    }
    return await openEnvelope(envelope, password);
  },

  async exportZip(project: LabelProject, password?: string): Promise<Uint8Array> {
    const envelope = await createEnvelope(project, password);
    const manifest: ProjectZipManifest = {
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      project_id: project.id,
      project_name: project.name,
      encrypted: envelope.encrypted,
    };
    return zipSync({
      [PROJECT_ZIP_MANIFEST]: strToU8(JSON.stringify(manifest)),
      [PROJECT_ZIP_PAYLOAD]: strToU8(JSON.stringify(envelope)),
    });
  },

  async importZip(contents: Uint8Array, password?: string): Promise<LabelProject> {
    validateZipDirectory(contents);
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(contents);
    } catch {
      throw new Error('The ZIP project archive is invalid or damaged.');
    }
    const manifestBytes = files[PROJECT_ZIP_MANIFEST];
    const projectBytes = files[PROJECT_ZIP_PAYLOAD];
    if (!manifestBytes || !projectBytes || projectBytes.length > MAX_PROJECT_BYTES) {
      throw new Error('The ZIP archive is missing the required E-Studio project files.');
    }

    let manifest: unknown;
    let envelope: unknown;
    try {
      manifest = JSON.parse(strFromU8(manifestBytes));
      envelope = JSON.parse(strFromU8(projectBytes));
    } catch {
      throw new Error('The ZIP project manifest or payload is invalid.');
    }
    const project = await openEnvelope(envelope, password);
    const zipManifest = manifest as Partial<ProjectZipManifest>;
    if (
      zipManifest.format !== PROJECT_FORMAT ||
      zipManifest.version !== PROJECT_VERSION ||
      zipManifest.project_id !== project.id ||
      zipManifest.project_name !== project.name ||
      zipManifest.encrypted !== validateEnvelope(envelope).encrypted
    ) {
      throw new Error('The ZIP manifest does not match the E-Studio project payload.');
    }
    return project;
  },
};
