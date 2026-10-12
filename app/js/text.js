// Accent-insensitive folding. Same length as input (after NFC), so match
// positions map back to the original text.
export function fold(str) {
  return String(str).normalize('NFC').split('').map(ch =>
    ch === 'đ' || ch === 'Đ' ? 'd' : (ch.normalize('NFD')[0] || ch).toLowerCase()).join('');
}
