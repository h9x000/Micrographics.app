export interface FontMetadata {
  family?: string;
  fullName?: string;
  postScriptName?: string;
}

interface NameRecord {
  encodingId: number;
  languageId: number;
  platformId: number;
  value: string;
}

const NAME_IDS = {
  family: 1,
  subfamily: 2,
  fullName: 4,
  postScriptName: 6,
  preferredFamily: 16,
  preferredSubfamily: 17
} as const;

function readTag(view: DataView, offset: number): string {
  return String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
}

function decodeUtf16BE(bytes: Uint8Array): string {
  let value = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    value += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  }
  return value.replace(/\0/g, "").trim();
}

function decodeMacRoman(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    try {
      return new TextDecoder("macintosh").decode(bytes).replace(/\0/g, "").trim();
    } catch {
      // Fall through to the ASCII-compatible fallback.
    }
  }
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("").replace(/\0/g, "").trim();
}

function decodeName(bytes: Uint8Array, platformId: number, encodingId: number): string {
  if (platformId === 0 || platformId === 3) return decodeUtf16BE(bytes);
  if (platformId === 1 && encodingId === 0) return decodeMacRoman(bytes);
  return decodeMacRoman(bytes);
}

function stripExtension(name: string): string {
  return name.replace(/\.(ttf|otf|woff|woff2)$/i, "").replace(/[-_]+/g, " ").trim();
}

export function fallbackFontFamily(fileName: string): string {
  return stripExtension(fileName) || fileName;
}

export function readFontMetadata(buffer: ArrayBuffer, fileName: string): FontMetadata {
  const view = new DataView(buffer);
  if (view.byteLength < 12) return { family: fallbackFontFamily(fileName) };

  const numTables = view.getUint16(4);
  let nameTableOffset = -1;
  let nameTableLength = 0;

  for (let i = 0; i < numTables; i += 1) {
    const offset = 12 + i * 16;
    if (offset + 16 > view.byteLength) break;
    if (readTag(view, offset) === "name") {
      nameTableOffset = view.getUint32(offset + 8);
      nameTableLength = view.getUint32(offset + 12);
      break;
    }
  }

  if (nameTableOffset < 0 || nameTableOffset + nameTableLength > view.byteLength) {
    return { family: fallbackFontFamily(fileName) };
  }

  const count = view.getUint16(nameTableOffset + 2);
  const stringOffset = nameTableOffset + view.getUint16(nameTableOffset + 4);
  const names = new Map<number, NameRecord[]>();

  for (let i = 0; i < count; i += 1) {
    const recordOffset = nameTableOffset + 6 + i * 12;
    if (recordOffset + 12 > view.byteLength) break;

    const platformId = view.getUint16(recordOffset);
    const encodingId = view.getUint16(recordOffset + 2);
    const languageId = view.getUint16(recordOffset + 4);
    const nameId = view.getUint16(recordOffset + 6);
    const length = view.getUint16(recordOffset + 8);
    const offset = stringOffset + view.getUint16(recordOffset + 10);
    if (offset + length > view.byteLength) continue;

    const decoded = decodeName(new Uint8Array(buffer, offset, length), platformId, encodingId);
    if (!decoded) continue;
    names.set(nameId, [...(names.get(nameId) ?? []), { encodingId, languageId, platformId, value: decoded }]);
  }

  const pick = (id: number) => {
    const records = names.get(id) ?? [];
    return (
      records.find((record) => record.platformId === 3 && record.languageId === 0x0409)?.value ??
      records.find((record) => record.platformId === 3)?.value ??
      records.find((record) => record.platformId === 0)?.value ??
      records.find((record) => record.platformId === 1 && record.languageId === 0)?.value ??
      records[0]?.value
    );
  };
  const family = pick(NAME_IDS.preferredFamily) ?? pick(NAME_IDS.family) ?? fallbackFontFamily(fileName);
  const subfamily = pick(NAME_IDS.preferredSubfamily) ?? pick(NAME_IDS.subfamily);
  const fullName = pick(NAME_IDS.fullName) ?? (subfamily && !/^regular$/i.test(subfamily) ? `${family} ${subfamily}` : family);

  return {
    family,
    fullName,
    postScriptName: pick(NAME_IDS.postScriptName)
  };
}
