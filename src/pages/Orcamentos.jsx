import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Download, FileText, QrCode, Building2, User, ChevronDown, ChevronUp, Receipt } from 'lucide-react'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import Header from '../components/layout/Header'
import { useClients } from '../context/ClientContext'

// ── PIX payload (Banco Central do Brasil spec) ────────────────────────────────

function crc16(str) {
  let crc = 0xFFFF
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1)
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')
}

function tlv(id, value) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`
}

function sanitizePix(str) {
  // Decompõe "ã" → "a" + combining mark, depois filtra caracteres por charCode (U+0300–U+036F)
  const nfd = str.normalize('NFD')
  let out = ''
  for (let i = 0; i < nfd.length; i++) {
    const code = nfd.charCodeAt(i)
    if (code >= 0x0300 && code <= 0x036F) continue // combining diacritics
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 32) out += nfd[i]
  }
  return out.trim()
}

function buildPixPayload({ key, name, city, amount }) {
  const n = sanitizePix(name || 'NOME').substring(0, 25) || 'NOME'
  const c = sanitizePix(city || 'CIDADE').substring(0, 15) || 'CIDADE'
  const gui = tlv('00', 'br.gov.bcb.pix') + tlv('01', key.trim())
  const merchant = tlv('26', gui)
  const additional = tlv('62', tlv('05', '***'))
  let payload = tlv('00', '01') + tlv('01', '12') + merchant
    + tlv('52', '0000') + tlv('53', '986')
    + (amount > 0 ? tlv('54', amount.toFixed(2)) : '')
    + tlv('58', 'BR') + tlv('59', n) + tlv('60', c)
    + additional + '6304'
  return payload + crc16(payload)
}

// ── Gone Hub logo SVG → PNG data URL (para o PDF) ────────────────────────────

const GONE_SVG = `<svg width="352" height="70" viewBox="0 0 176 35" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M161.063 7.23558C161.063 6.57219 161.144 5.93308 161.306 5.31823C161.468 4.698 161.7 4.12091 162.002 3.58696C162.309 3.05302 162.679 2.56762 163.11 2.13076C163.547 1.69389 164.035 1.31905 164.575 1.00624C165.114 0.693424 165.702 0.45342 166.338 0.286225C166.975 0.113638 167.649 0.0273438 168.361 0.0273438C169.067 0.0273438 169.739 0.113638 170.375 0.286225C171.012 0.45342 171.599 0.693424 172.139 1.00624C172.683 1.31905 173.172 1.69389 173.603 2.13076C174.04 2.56762 174.409 3.05302 174.711 3.58696C175.013 4.12091 175.245 4.698 175.407 5.31823C175.574 5.93308 175.658 6.57219 175.658 7.23558C175.658 7.89896 175.577 8.53807 175.415 9.15292C175.253 9.76776 175.019 10.3422 174.711 10.8761C174.409 11.41 174.04 11.8981 173.603 12.3404C173.172 12.7773 172.686 13.1521 172.147 13.4649C171.608 13.7777 171.02 14.0204 170.383 14.193C169.747 14.3656 169.073 14.4519 168.361 14.4519C167.649 14.4519 166.975 14.3656 166.338 14.193C165.702 14.0204 165.111 13.7777 164.566 13.4649C164.027 13.1521 163.542 12.7773 163.11 12.3404C162.679 11.8981 162.309 11.41 162.002 10.8761C161.7 10.3422 161.468 9.76776 161.306 9.15292C161.144 8.53807 161.063 7.89896 161.063 7.23558ZM162.754 7.23558C162.754 7.76952 162.816 8.2765 162.94 8.7565C163.064 9.23112 163.242 9.67338 163.474 10.0833C163.712 10.4878 163.995 10.8545 164.324 11.1835C164.658 11.5125 165.033 11.793 165.448 12.0249C165.864 12.2568 166.317 12.4348 166.807 12.5588C167.298 12.6829 167.816 12.7449 168.361 12.7449C169.175 12.7449 169.925 12.6074 170.61 12.3323C171.3 12.0572 171.893 11.677 172.39 11.1916C172.886 10.7008 173.271 10.1183 173.546 9.44416C173.827 8.76999 173.967 8.03379 173.967 7.23558C173.967 6.44275 173.827 5.70925 173.546 5.03508C173.271 4.36091 172.886 3.77843 172.39 3.28763C171.893 2.79684 171.303 2.41391 170.618 2.13885C169.933 1.86378 169.18 1.72625 168.361 1.72625C167.541 1.72625 166.786 1.86378 166.095 2.13885C165.411 2.41391 164.82 2.79684 164.324 3.28763C163.828 3.77843 163.442 4.36091 163.167 5.03508C162.892 5.70925 162.754 6.44275 162.754 7.23558ZM165.286 3.77304H167.794C168.576 3.77304 169.224 3.83776 169.736 3.9672C170.248 4.09124 170.656 4.26114 170.958 4.47687C171.26 4.6926 171.47 4.94609 171.589 5.23733C171.713 5.52318 171.775 5.82791 171.775 6.15151C171.775 6.39421 171.742 6.62613 171.678 6.84725C171.618 7.06838 171.519 7.27333 171.378 7.4621C171.243 7.64547 171.068 7.80997 170.852 7.95559C170.637 8.10121 170.372 8.22526 170.06 8.32773L171.904 10.5444H169.906L168.288 8.60279H167.835L166.937 8.5947V10.5444H165.286V3.77304ZM167.819 7.24367C168.239 7.24367 168.593 7.22209 168.878 7.17895C169.17 7.13041 169.402 7.06299 169.574 6.97669C169.747 6.88501 169.871 6.77714 169.946 6.65309C170.022 6.52365 170.06 6.37803 170.06 6.21623C170.06 6.05982 170.022 5.9169 169.946 5.78746C169.876 5.65802 169.752 5.54745 169.574 5.45577C169.402 5.36408 169.17 5.29396 168.878 5.24542C168.593 5.19149 168.231 5.16452 167.794 5.16452H166.937V7.24367H167.819Z" fill="white"/>
  <path d="M0 16.6196C0 14.2937 0.436987 12.1229 1.31096 10.1071C2.18493 8.0772 3.46065 6.31516 5.13812 4.82095C6.81558 3.32674 8.87365 2.14969 11.3123 1.28982C13.7651 0.429939 16.5703 0 19.7278 0C20.8696 0 22.0114 0.0634339 23.1532 0.190301C24.3091 0.303072 25.4439 0.486324 26.5575 0.740058C27.6852 0.993792 28.7777 1.31801 29.8349 1.71271C30.9062 2.09331 31.9212 2.55144 32.8797 3.0871L29.7926 8.16178C29.2147 7.82347 28.5592 7.5204 27.8262 7.25257C27.0932 6.97064 26.3038 6.73805 25.458 6.5548C24.6263 6.35745 23.7594 6.20944 22.8572 6.11076C21.9691 6.01209 21.074 5.96275 20.1719 5.96275C18.0856 5.96275 16.2249 6.23058 14.5897 6.76624C12.9545 7.28781 11.5731 8.02787 10.4454 8.98642C9.31768 9.93087 8.45781 11.0656 7.86576 12.3907C7.27371 13.7157 6.97769 15.1677 6.97769 16.7465C6.97769 18.3816 7.28781 19.8829 7.90805 21.2502C8.52829 22.6176 9.40931 23.7946 10.5511 24.7814C11.6929 25.7681 13.0744 26.5434 14.6954 27.1073C16.3165 27.657 18.1279 27.9319 20.1296 27.9319C21.7225 27.9319 23.1814 27.7557 24.5065 27.4033C25.8315 27.0368 26.9874 26.5223 27.9742 25.8597C28.9609 25.1972 29.7644 24.4008 30.3847 23.4704C31.0049 22.526 31.4137 21.4687 31.611 20.2987H20.0661V14.78H37.6372V14.8012L37.6584 14.78C38.0108 16.4716 38.1165 18.1208 37.9755 19.7278C37.8487 21.3207 37.4822 22.829 36.876 24.2528C36.284 25.6624 35.4664 26.9593 34.4233 28.1433C33.3801 29.3274 32.1326 30.3494 30.6807 31.2093C29.2288 32.0551 27.5795 32.7176 25.7329 33.1969C23.8863 33.6621 21.8634 33.8947 19.6644 33.8947C16.5914 33.8947 13.8356 33.4436 11.3969 32.5414C8.97232 31.6392 6.91426 30.4058 5.22269 28.8411C3.53113 27.2764 2.23427 25.4439 1.3321 23.3435C0.444035 21.2432 0 19.0019 0 16.6196Z" fill="white"/>
  <path d="M127.624 0.422363H155.767V6.30054H134.327V12.8976H153.315V18.4163H134.327V27.6142H156.211V33.4712H127.624V0.422363Z" fill="white"/>
  <path d="M84.2773 0.422363H90.9802L111.575 11.2061V0.422363H118.278V33.4712H111.575V18.3106L90.9802 7.59035V33.4712H84.2773V0.422363Z" fill="white"/>
  <path fill-rule="evenodd" clip-rule="evenodd" d="M60.2638 0.435198H60.8913H78.9005V16.6117L78.9062 16.9054L78.9038 17.1796L78.9005 17.4734C78.9005 18.5832 78.81 19.6472 78.6288 20.6721C78.4028 21.9516 78.0364 23.1658 77.5288 24.3148C76.6141 26.3842 75.3346 28.1533 73.6879 29.6286C72.0281 31.1235 70.0444 32.279 67.7376 33.095C66.5731 33.5063 65.3475 33.8131 64.0598 34.0154C62.7795 34.2178 61.438 34.3157 60.0353 34.3157L59.806 34.3223H41.1693L41.1701 17.4799C41.1701 14.9731 41.627 12.6687 42.541 10.5732C43.4557 8.4908 44.7426 6.70212 46.4031 5.19414C47.2387 4.43036 48.1616 3.75144 49.171 3.15739C49.8426 2.76571 50.5517 2.40667 51.3 2.08679C51.6435 1.93665 51.9944 1.79956 52.3534 1.669C54.675 0.839937 57.2356 0.422142 60.0353 0.422142L60.2638 0.435198ZM71.3035 12.8776C71.909 14.242 72.2109 15.7761 72.2109 17.4734C72.2109 19.1772 71.909 20.7048 71.3035 22.0561C70.685 23.4074 69.8339 24.5433 68.7502 25.4768C68.2517 25.9011 67.7139 26.2862 67.1362 26.6192C66.4434 27.0239 65.6943 27.3568 64.8889 27.6245C64.1863 27.8595 63.456 28.0358 62.6979 28.1533C62.0761 28.2512 61.4364 28.3165 60.7779 28.3426L60.0353 28.3622C58.2907 28.3622 56.6799 28.1206 55.2029 27.6245C53.7113 27.1349 52.4244 26.4168 51.3408 25.4768C50.8112 25.0198 50.3371 24.5171 49.9185 23.9623C49.6941 23.662 49.486 23.3486 49.2934 23.0222C49.1106 22.7154 48.9417 22.3955 48.7875 22.0561C48.4945 21.4163 48.271 20.7374 48.1167 20.0193C47.9446 19.2229 47.8589 18.3743 47.8589 17.4734L47.8785 16.7488L47.8956 16.4746L47.9478 15.9458C48.08 14.8426 48.3599 13.8177 48.7875 12.8776C48.8879 12.6557 48.9939 12.4403 49.1057 12.2314L49.4028 11.7091L49.5105 11.5329L49.7528 11.1673C49.9226 10.9192 50.0352 10.7691 50.2261 10.5406C50.3909 10.3382 50.5631 10.1424 50.7426 9.95308C50.9336 9.75071 51.1327 9.5614 51.3408 9.37209C52.4244 8.41899 53.7113 7.6748 55.2029 7.15908C56.6799 6.63684 58.2907 6.37572 60.0353 6.37572C61.7791 6.37572 63.3973 6.63684 64.8889 7.15908C66.3659 7.6748 67.6527 8.41899 68.7502 9.37209C69.8339 10.3448 70.685 11.5133 71.3035 12.8776Z" fill="#E03720"/>
</svg>`

function svgToDataUrl(svgStr, w, h) {
  return new Promise(resolve => {
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPTY_SERVICE = { desc: '', qty: 1, unit: '' }

function calcTotals(services, discountType, discountVal) {
  const subtotal = services.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.unit) || 0), 0)
  const discountAmt = discountType === '%'
    ? subtotal * (parseFloat(discountVal) || 0) / 100
    : parseFloat(discountVal) || 0
  const total = Math.max(0, subtotal - discountAmt)
  return { subtotal, discountAmt, total }
}

function fmtBRL(n) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const DOC_TYPES = [
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'contrato', label: 'Contrato' },
]

// ── PDF generator ─────────────────────────────────────────────────────────────

async function generatePDF({ agencia, cliente, services, discountType, discountVal, notes, docType, docNumber, pixKey, pixQrUrl, validDays, contractTerms, logoUrl }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const M = 18
  const CW = W - M * 2
  let y = 0

  const { subtotal, discountAmt, total } = calcTotals(services, discountType, discountVal)

  // ── Header band ──
  doc.setFillColor(15, 15, 15)
  doc.rect(0, 0, W, 38, 'F')

  // Logo Gone Hub (canto superior esquerdo)
  if (logoUrl) {
    doc.addImage(logoUrl, 'PNG', M, 8, 44, 8.75)
  }

  // Linha divisória laranja sob a logo
  doc.setFillColor(224, 55, 32)
  doc.rect(M, 19, 44, 1, 'F')

  // Dados da agência abaixo da logo
  doc.setTextColor(160, 160, 160)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  if (agencia.nome) doc.text(agencia.nome, M, 26)
  if (agencia.cnpj) doc.text(`CNPJ: ${agencia.cnpj}`, M, 31)
  if (agencia.contato || agencia.endereco) doc.text([agencia.contato, agencia.endereco].filter(Boolean).join('  ·  '), M, 36)

  const titulo = docType === 'contrato' ? 'CONTRATO DE SERVIÇOS' : 'ORÇAMENTO'
  doc.setTextColor(249, 115, 22)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(titulo, W - M, 14, { align: 'right' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(160, 160, 160)
  doc.text(`Nº ${docNumber}`, W - M, 21, { align: 'right' })
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, W - M, 27, { align: 'right' })
  if (validDays && docType === 'orcamento') doc.text(`Válido por ${validDays} dias`, W - M, 33, { align: 'right' })

  y = 48

  // ── Client section ──
  doc.setFillColor(245, 245, 245)
  doc.roundedRect(M, y, CW, 28, 2, 2, 'F')
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('DADOS DO CLIENTE', M + 5, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(10)
  doc.text(cliente.nome || '—', M + 5, y + 14)
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  const clienteInfo = [cliente.cnpj, cliente.contato, cliente.endereco].filter(Boolean).join('  •  ')
  if (clienteInfo) doc.text(clienteInfo, M + 5, y + 21)

  y += 36

  // ── Services table ──
  doc.setFillColor(15, 15, 15)
  doc.rect(M, y, CW, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('DESCRIÇÃO', M + 4, y + 5.5)
  doc.text('QTD', M + CW * 0.62, y + 5.5, { align: 'center' })
  doc.text('UNIT.', M + CW * 0.77, y + 5.5, { align: 'center' })
  doc.text('TOTAL', M + CW - 4, y + 5.5, { align: 'right' })
  y += 8

  const validServices = services.filter(s => s.desc.trim())
  validServices.forEach((srv, i) => {
    const lineTotal = (parseFloat(srv.qty) || 0) * (parseFloat(srv.unit) || 0)
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250)
      doc.rect(M, y, CW, 8, 'F')
    }
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.text(srv.desc.substring(0, 55), M + 4, y + 5.5)
    doc.text(String(srv.qty), M + CW * 0.62, y + 5.5, { align: 'center' })
    doc.text(fmtBRL(parseFloat(srv.unit) || 0), M + CW * 0.77, y + 5.5, { align: 'center' })
    doc.text(fmtBRL(lineTotal), M + CW - 4, y + 5.5, { align: 'right' })
    y += 8
  })

  // ── Totals block ──
  y += 4
  const totalsX = M + CW * 0.55
  const totalsW = CW * 0.45

  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(totalsX, y, M + CW, y)

  y += 6
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text('Subtotal', totalsX, y)
  doc.text(fmtBRL(subtotal), M + CW - 4, y, { align: 'right' })

  if (discountAmt > 0) {
    y += 7
    doc.setTextColor(220, 50, 50)
    doc.text(`Desconto (${discountType === '%' ? `${discountVal}%` : fmtBRL(parseFloat(discountVal))})`, totalsX, y)
    doc.text(`-${fmtBRL(discountAmt)}`, M + CW - 4, y, { align: 'right' })
  }

  y += 4
  doc.setDrawColor(200, 200, 200)
  doc.line(totalsX, y, M + CW, y)
  y += 7

  doc.setFillColor(15, 15, 15)
  doc.roundedRect(totalsX - 2, y - 5, totalsW + 2, 10, 1, 1, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL', totalsX + 2, y + 1.5)
  doc.setTextColor(249, 115, 22)
  doc.text(fmtBRL(total), M + CW - 4, y + 1.5, { align: 'right' })

  y += 18

  // ── PIX section ──
  if (pixKey) {
    doc.setFillColor(255, 247, 237)
    doc.roundedRect(M, y, CW, pixQrUrl ? 50 : 22, 2, 2, 'F')
    doc.setDrawColor(249, 115, 22)
    doc.setLineWidth(0.4)
    doc.roundedRect(M, y, CW, pixQrUrl ? 50 : 22, 2, 2, 'S')

    doc.setTextColor(180, 90, 0)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('PAGAMENTO VIA PIX', M + 5, y + 7)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    doc.text(`Chave: ${pixKey}`, M + 5, y + 14)
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(fmtBRL(total), M + 5, y + 21)

    if (pixQrUrl) {
      doc.addImage(pixQrUrl, 'PNG', M + CW - 46, y + 4, 42, 42)
    }

    y += pixQrUrl ? 58 : 30
  }

  // ── Notes ──
  if (notes?.trim()) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(80, 80, 80)
    doc.text('OBSERVAÇÕES', M, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    const lines = doc.splitTextToSize(notes, CW)
    doc.text(lines, M, y)
    y += lines.length * 4.5 + 6
  }

  // ── Contract terms ──
  if (docType === 'contrato' && contractTerms?.trim()) {
    doc.addPage()
    y = M
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 15, 15)
    doc.text('TERMOS E CONDIÇÕES', M, y)
    y += 8
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    const termLines = doc.splitTextToSize(contractTerms, CW)
    doc.text(termLines, M, y)
    y += termLines.length * 5 + 20
  }

  // ── Signatures ──
  if (docType === 'contrato') {
    if (y > 240) { doc.addPage(); y = M }
    else y += 10
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.4)
    const sigY = y + 20
    doc.line(M, sigY, M + CW * 0.42, sigY)
    doc.line(M + CW * 0.58, sigY, M + CW, sigY)
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(agencia.nome || 'Agência', M + CW * 0.21, sigY + 5, { align: 'center' })
    doc.text(cliente.nome || 'Cliente', M + CW * 0.79, sigY + 5, { align: 'center' })
    doc.text('Contratada', M + CW * 0.21, sigY + 10, { align: 'center' })
    doc.text('Contratante', M + CW * 0.79, sigY + 10, { align: 'center' })
  }

  doc.save(`${docType}-${docNumber}-${(cliente.nome || 'cliente').replace(/\s+/g, '-')}.pdf`)
}

// ── Component ─────────────────────────────────────────────────────────────────

const DEFAULT_TERMS = `1. OBJETO: O presente contrato tem por objeto a prestação dos serviços descritos no orçamento anexo.

2. PRAZO: Os serviços serão executados conforme cronograma acordado entre as partes.

3. PAGAMENTO: O pagamento deverá ser efetuado conforme condições descritas no orçamento.

4. PROPRIEDADE INTELECTUAL: Todo material produzido é de propriedade da Contratante após quitação integral.

5. CONFIDENCIALIDADE: As partes se comprometem a manter sigilo sobre informações trocadas durante a vigência deste contrato.

6. RESCISÃO: Este contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 30 dias.

7. FORO: Fica eleito o foro da comarca do domicílio da Contratada para dirimir quaisquer controvérsias.`

export default function Orcamentos() {
  const { activeClient } = useClients()

  const [docType, setDocType] = useState('orcamento')
  const [docNumber, setDocNumber] = useState(() => `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 900) + 100)}`)
  const [validDays, setValidDays] = useState('30')

  const [agencia, setAgencia] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gh_agencia') || 'null') || { nome: '', cnpj: '', contato: '', endereco: '' } }
    catch { return { nome: '', cnpj: '', contato: '', endereco: '' } }
  })
  const [cliente, setCliente] = useState({ nome: '', cnpj: '', contato: '', endereco: '' })

  const [services, setServices] = useState([{ ...EMPTY_SERVICE }])
  const [discountType, setDiscountType] = useState('%')
  const [discountVal, setDiscountVal] = useState('')
  const [notes, setNotes] = useState('')
  const [contractTerms, setContractTerms] = useState(DEFAULT_TERMS)

  const [pixKey, setPixKey] = useState(() => localStorage.getItem('gh_pix_key') || '')
  const [pixName, setPixName] = useState(() => localStorage.getItem('gh_pix_name') || '')
  const [pixCity, setPixCity] = useState(() => localStorage.getItem('gh_pix_city') || '')
  const [pixQrUrl, setPixQrUrl] = useState('')
  const [generatingQr, setGeneratingQr] = useState(false)
  const [qrError, setQrError] = useState('')

  const [exporting, setExporting] = useState(false)
  const [showTerms, setShowTerms] = useState(false)

  // Persistir PIX e agência no localStorage
  useEffect(() => { localStorage.setItem('gh_pix_key', pixKey) }, [pixKey])
  useEffect(() => { localStorage.setItem('gh_pix_name', pixName) }, [pixName])
  useEffect(() => { localStorage.setItem('gh_pix_city', pixCity) }, [pixCity])
  useEffect(() => { localStorage.setItem('gh_agencia', JSON.stringify(agencia)) }, [agencia])

  // Pre-fill client from activeClient
  useEffect(() => {
    if (activeClient) {
      setCliente(prev => ({
        ...prev,
        nome: prev.nome || activeClient.name || '',
        contato: prev.contato || activeClient.ig_handle || '',
      }))
    }
  }, [activeClient])

  const { subtotal, discountAmt, total } = calcTotals(services, discountType, discountVal)

  function addService() {
    setServices(prev => [...prev, { ...EMPTY_SERVICE }])
  }

  function updateService(idx, field, value) {
    setServices(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  function removeService(idx) {
    setServices(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))
  }

  async function handleGenerateQr() {
    if (!pixKey.trim()) return
    setGeneratingQr(true)
    setQrError('')
    setPixQrUrl('')
    try {
      const payload = buildPixPayload({ key: pixKey, name: pixName || agencia.nome, city: pixCity || 'BRASIL', amount: total })
      const url = await QRCode.toDataURL(payload, { width: 300, margin: 1, color: { dark: '#0f0f0f', light: '#ffffff' } })
      setPixQrUrl(url)
    } catch (err) {
      setQrError(err?.message || 'Erro ao gerar QR Code. Verifique a chave PIX.')
    }
    setGeneratingQr(false)
  }

  async function handleExport() {
    setExporting(true)
    try {
      let qrUrl = pixQrUrl
      if (pixKey.trim() && !qrUrl) {
        const payload = buildPixPayload({ key: pixKey, name: pixName || agencia.nome, city: pixCity || 'BRASIL', amount: total })
        qrUrl = await QRCode.toDataURL(payload, { width: 300, margin: 1, color: { dark: '#0f0f0f', light: '#ffffff' } })
        setPixQrUrl(qrUrl)
      }
      const logoUrl = await svgToDataUrl(GONE_SVG, 352, 70)
      await generatePDF({ agencia, cliente, services, discountType, discountVal, notes, docType, docNumber, pixKey, pixQrUrl: qrUrl, validDays, contractTerms, logoUrl })
    } finally {
      setExporting(false)
    }
  }

  const inputCls = 'w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-orange-500/50 transition-colors'
  const labelCls = 'block text-[10px] text-[#555] uppercase tracking-wider mb-1 font-medium'

  return (
    <div>
      <Header title="Orçamentos & Contratos" />
      <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">

        {/* Doc type + number */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex bg-[#111] p-1 rounded-lg border border-[#222] gap-0.5">
            {DOC_TYPES.map(t => (
              <button key={t.value} onClick={() => setDocType(t.value)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${docType === t.value ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/40' : 'text-[#555] hover:text-[#888]'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-1">
            <div className="flex-1">
              <input value={docNumber} onChange={e => setDocNumber(e.target.value)}
                className={inputCls} placeholder="Número do documento" />
            </div>
            {docType === 'orcamento' && (
              <div className="w-32">
                <input value={validDays} onChange={e => setValidDays(e.target.value)}
                  className={inputCls} placeholder="Válido (dias)" />
              </div>
            )}
          </div>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all flex-shrink-0">
            <Download size={15} />
            {exporting ? 'Gerando...' : 'Exportar PDF'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Agência */}
          <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={15} className="text-orange-400" />
              <h2 className="text-sm font-semibold text-white">Dados da Agência</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Nome</label>
                <input value={agencia.nome} onChange={e => setAgencia(a => ({ ...a, nome: e.target.value }))} className={inputCls} placeholder="Nome da agência" />
              </div>
              <div>
                <label className={labelCls}>CNPJ / CPF</label>
                <input value={agencia.cnpj} onChange={e => setAgencia(a => ({ ...a, cnpj: e.target.value }))} className={inputCls} placeholder="00.000.000/0001-00" />
              </div>
              <div>
                <label className={labelCls}>Contato / E-mail</label>
                <input value={agencia.contato} onChange={e => setAgencia(a => ({ ...a, contato: e.target.value }))} className={inputCls} placeholder="contato@agencia.com" />
              </div>
              <div>
                <label className={labelCls}>Endereço</label>
                <input value={agencia.endereco} onChange={e => setAgencia(a => ({ ...a, endereco: e.target.value }))} className={inputCls} placeholder="Cidade, Estado" />
              </div>
            </div>
          </div>

          {/* Cliente */}
          <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <User size={15} className="text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Dados do Cliente</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Nome</label>
                <input value={cliente.nome} onChange={e => setCliente(c => ({ ...c, nome: e.target.value }))} className={inputCls} placeholder="Nome do cliente / empresa" />
              </div>
              <div>
                <label className={labelCls}>CNPJ / CPF</label>
                <input value={cliente.cnpj} onChange={e => setCliente(c => ({ ...c, cnpj: e.target.value }))} className={inputCls} placeholder="00.000.000/0001-00" />
              </div>
              <div>
                <label className={labelCls}>Contato / E-mail</label>
                <input value={cliente.contato} onChange={e => setCliente(c => ({ ...c, contato: e.target.value }))} className={inputCls} placeholder="contato@cliente.com" />
              </div>
              <div>
                <label className={labelCls}>Endereço</label>
                <input value={cliente.endereco} onChange={e => setCliente(c => ({ ...c, endereco: e.target.value }))} className={inputCls} placeholder="Cidade, Estado" />
              </div>
            </div>
          </div>
        </div>

        {/* Serviços */}
        <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Receipt size={15} className="text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Serviços</h2>
            </div>
            <button onClick={addService}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/15 border border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/25 rounded-lg text-xs font-medium transition-all">
              <Plus size={13} /> Adicionar
            </button>
          </div>

          {/* Table header */}
          <div className="hidden md:grid grid-cols-12 gap-2 mb-2 px-1">
            <div className="col-span-6 text-[10px] text-[#555] uppercase tracking-wider">Descrição</div>
            <div className="col-span-2 text-[10px] text-[#555] uppercase tracking-wider text-center">Qtd</div>
            <div className="col-span-2 text-[10px] text-[#555] uppercase tracking-wider text-center">Valor Unit.</div>
            <div className="col-span-2 text-[10px] text-[#555] uppercase tracking-wider text-right">Total</div>
          </div>

          <div className="space-y-2">
            {services.map((srv, idx) => {
              const lineTotal = (parseFloat(srv.qty) || 0) * (parseFloat(srv.unit) || 0)
              return (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-[#111]/50 rounded-lg p-2">
                  <div className="col-span-12 md:col-span-6">
                    <input value={srv.desc} onChange={e => updateService(idx, 'desc', e.target.value)}
                      className={inputCls} placeholder="Descrição do serviço" />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <input type="number" min="1" value={srv.qty} onChange={e => updateService(idx, 'qty', e.target.value)}
                      className={inputCls + ' text-center'} placeholder="1" />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <input type="number" min="0" step="0.01" value={srv.unit} onChange={e => updateService(idx, 'unit', e.target.value)}
                      className={inputCls + ' text-center'} placeholder="0,00" />
                  </div>
                  <div className="col-span-3 md:col-span-2 flex items-center justify-end gap-2">
                    <span className="text-sm font-semibold text-emerald-400">{fmtBRL(lineTotal)}</span>
                    <button onClick={() => removeService(idx)}
                      className="text-[#333] hover:text-red-400 transition-colors flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-[#2a2a2a] space-y-2">
            {/* Discount row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#888]">Desconto</span>
                <div className="flex bg-[#111] rounded-lg border border-[#2a2a2a] overflow-hidden">
                  {['%', 'R$'].map(t => (
                    <button key={t} onClick={() => setDiscountType(t)}
                      className={`px-2.5 py-1 text-xs font-bold transition-all ${discountType === t ? 'bg-orange-500 text-white' : 'text-[#555] hover:text-[#888]'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <input type="number" min="0" value={discountVal} onChange={e => setDiscountVal(e.target.value)}
                  className="w-24 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-orange-500/50 transition-colors"
                  placeholder="0" />
              </div>
              {discountAmt > 0 && <span className="text-sm text-red-400 font-medium">-{fmtBRL(discountAmt)}</span>}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-[#666]">Subtotal</span>
              <span className="text-sm text-[#ccc]">{fmtBRL(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between bg-[#111] rounded-xl px-4 py-3">
              <span className="text-sm font-bold text-white">TOTAL</span>
              <span className="text-lg font-bold text-orange-400">{fmtBRL(total)}</span>
            </div>
          </div>
        </div>

        {/* PIX */}
        <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <QrCode size={15} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Pagamento PIX</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-3">
              <div>
                <label className={labelCls}>Chave PIX (CPF, CNPJ, e-mail, telefone ou aleatória)</label>
                <input value={pixKey} onChange={e => { setPixKey(e.target.value); setPixQrUrl(''); setQrError('') }}
                  className={inputCls} placeholder="exemplo@email.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nome do recebedor</label>
                  <input value={pixName} onChange={e => { setPixName(e.target.value); setPixQrUrl('') }}
                    className={inputCls} placeholder="Nome (aparece no app)" />
                </div>
                <div>
                  <label className={labelCls}>Cidade</label>
                  <input value={pixCity} onChange={e => { setPixCity(e.target.value); setPixQrUrl('') }}
                    className={inputCls} placeholder="Brasília" />
                </div>
              </div>
              <button onClick={handleGenerateQr} disabled={!pixKey.trim() || generatingQr}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 disabled:opacity-40 rounded-lg text-xs font-semibold transition-all">
                <QrCode size={13} />
                {generatingQr ? 'Gerando...' : 'Gerar QR Code'}
              </button>
              {qrError && (
                <p className="text-xs text-red-400 bg-red-900/10 border border-red-900/30 rounded-lg px-3 py-2">{qrError}</p>
              )}
            </div>

            <div className="flex items-center justify-center">
              {pixQrUrl ? (
                <div className="text-center">
                  <img src={pixQrUrl} alt="QR Code PIX" className="w-36 h-36 rounded-xl border border-[#2a2a2a]" />
                  <p className="text-[10px] text-[#555] mt-1.5">{fmtBRL(total)}</p>
                </div>
              ) : (
                <div className="w-36 h-36 rounded-xl border-2 border-dashed border-[#2a2a2a] flex flex-col items-center justify-center gap-2">
                  <QrCode size={28} className="text-[#2a2a2a]" />
                  <p className="text-[10px] text-[#3a3a3a]">QR Code PIX</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-4">
          <label className="block text-sm font-semibold text-white mb-3">Observações</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            className={inputCls + ' resize-none'}
            placeholder="Condições de pagamento, prazo de entrega, informações adicionais..." />
        </div>

        {/* Contract terms (contrato only) */}
        {docType === 'contrato' && (
          <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-4">
            <button onClick={() => setShowTerms(v => !v)}
              className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-indigo-400" />
                <h2 className="text-sm font-semibold text-white">Termos e Condições</h2>
              </div>
              {showTerms ? <ChevronUp size={16} className="text-[#555]" /> : <ChevronDown size={16} className="text-[#555]" />}
            </button>
            {showTerms && (
              <div className="mt-3">
                <p className="text-[10px] text-[#555] mb-2">Edite os termos conforme necessário. Eles serão incluídos na segunda página do PDF.</p>
                <textarea value={contractTerms} onChange={e => setContractTerms(e.target.value)} rows={12}
                  className={inputCls + ' resize-none font-mono text-xs leading-relaxed'} />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
