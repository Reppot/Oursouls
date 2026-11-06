// Store already-compressed PNG/JPEG files directly in a standard ZIP archive.
const crcTable = Uint32Array.from({length: 256}, (_, value) => {
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    return value;
});
function header(length) {
    const bytes = new Uint8Array(length), view = new DataView(bytes.buffer);
    return {bytes, u16: (at, n) => view.setUint16(at, n, true), u32: (at, n) => view.setUint32(at, n, true)};
}
export async function createArchive(files) {
    const parts = [], directory = [], encoder = new TextEncoder();
    let offset = 0, directorySize = 0;
    for (const [path, blob] of files) {
        const name = encoder.encode(path);
        let crc = 0xffffffff;
        for (const byte of new Uint8Array(await blob.arrayBuffer())) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
        crc ^= 0xffffffff;
        const local = header(30);
        local.u32(0, 0x04034b50); local.u16(4, 20); local.u16(6, 0x800); local.u16(12, 33);
        local.u32(14, crc); local.u32(18, blob.size); local.u32(22, blob.size); local.u16(26, name.length);
        const central = header(46);
        central.u32(0, 0x02014b50); central.u16(4, 20); central.u16(6, 20); central.u16(8, 0x800); central.u16(14, 33);
        central.u32(16, crc); central.u32(20, blob.size); central.u32(24, blob.size); central.u16(28, name.length); central.u32(42, offset);
        parts.push(local.bytes, name, blob); directory.push(central.bytes, name);
        offset += local.bytes.length + name.length + blob.size;
        directorySize += central.bytes.length + name.length;
    }
    const end = header(22);
    end.u32(0, 0x06054b50); end.u16(8, files.length); end.u16(10, files.length); end.u32(12, directorySize); end.u32(16, offset);
    return new Blob([...parts, ...directory, end.bytes], {type:'application/zip'});
}
