// الاتصال بمنصة «فاتورة» (الإصدار V2): شهادة الامتثال، فحص الامتثال، شهادة الإنتاج، الإبلاغ، الاعتماد
export const ZATCA_BASE = {
  sandbox: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
  simulation: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
  production: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core'
};
const basic = (token, secret) => 'Basic ' + Buffer.from(token + ':' + secret).toString('base64');
async function call(env, path, { method = 'POST', body, auth, otp, clearance } = {}) {
  const h = { 'Accept': 'application/json', 'Accept-Language': 'en', 'Accept-Version': 'V2', 'Content-Type': 'application/json' };
  if (auth) h.Authorization = basic(auth.token, auth.secret);
  if (otp) h.OTP = String(otp);
  if (clearance != null) h['Clearance-Status'] = clearance ? '1' : '0';
  const r = await fetch(ZATCA_BASE[env] + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { }
  return { status: r.status, ok: r.ok, json, text: json ? undefined : text.slice(0, 500) };
}
/** شهادة الامتثال (CCSID): تُطلب بالرمز المؤقت من بوابة «فاتورة» ← { binarySecurityToken, secret, requestID } */
export const complianceCsid = (env, csrPem, otp) => call(env, '/compliance', { body: { csr: Buffer.from(csrPem).toString('base64') }, otp });
/** فحص امتثال فاتورة بالشهادة التجريبية */
export const complianceCheck = (env, auth, inv) => call(env, '/compliance/invoices', { auth, body: { invoiceHash: inv.hash, uuid: inv.uuid, invoice: Buffer.from(inv.xml).toString('base64') } });
/** شهادة الإنتاج (PCSID) بعد اجتياز فحوص الامتثال */
export const productionCsid = (env, auth, requestID) => call(env, '/production/csids', { auth, body: { compliance_request_id: String(requestID) } });
/** إبلاغ فاتورة مبسّطة (خلال 24 ساعة) */
export const reportInvoice = (env, auth, inv) => call(env, '/invoices/reporting/single', { auth, clearance: false, body: { invoiceHash: inv.hash, uuid: inv.uuid, invoice: Buffer.from(inv.xml).toString('base64') } });
/** اعتماد فاتورة ضريبية (قبل تسليمها للمشتري) */
export const clearInvoice = (env, auth, inv) => call(env, '/invoices/clearance/single', { auth, clearance: true, body: { invoiceHash: inv.hash, uuid: inv.uuid, invoice: Buffer.from(inv.xml).toString('base64') } });
/** الشهادة (نص base64 لـ DER) من binarySecurityToken */
export const certFromToken = (token) => Buffer.from(token, 'base64').toString('utf8');
