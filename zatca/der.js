// ترميز ASN.1 DER الأدنى اللازم لطلب الشهادة (CSR) — بلا مكتبات خارجية
const len = (n) => { if (n < 128) return Buffer.from([n]); const b = []; while (n) { b.unshift(n & 255); n = Math.floor(n / 256); } return Buffer.from([0x80 | b.length, ...b]); };
export const tlv = (tag, content) => Buffer.concat([Buffer.from([tag]), len(content.length), content]);
export const seq = (...x) => tlv(0x30, Buffer.concat(x));
export const set = (...x) => tlv(0x31, Buffer.concat(x));
export const oid = (s) => {
  const p = s.split('.').map(Number); const out = [40 * p[0] + p[1]];
  for (const v of p.slice(2)) { const st = [v & 127]; let n = Math.floor(v / 128); while (n) { st.unshift((n & 127) | 128); n = Math.floor(n / 128); } out.push(...st); }
  return tlv(6, Buffer.from(out));
};
export const utf8 = (s) => tlv(0x0c, Buffer.from(String(s), 'utf8'));
export const printable = (s) => tlv(0x13, Buffer.from(String(s), 'ascii'));
export const int0 = () => tlv(2, Buffer.from([0]));
export const octet = (b) => tlv(4, b);
export const bitstr = (b) => tlv(3, Buffer.concat([Buffer.from([0]), b]));
export const ctx = (n, content) => tlv(0xa0 | n, content);   // [n] constructed (EXPLICIT / IMPLICIT SET)
// قراءة عنصر DER: يعيد {tag, start, hdr, len, end}
export function readTlv(buf, pos = 0) {
  const tag = buf[pos]; let l = buf[pos + 1], hdr = 2;
  if (l & 0x80) { const n = l & 0x7f; l = 0; for (let i = 0; i < n; i++) l = l * 256 + buf[pos + 2 + i]; hdr = 2 + n; }
  return { tag, start: pos, hdr, len: l, end: pos + hdr + l, body: buf.subarray(pos + hdr, pos + hdr + l) };
}
