/** 0 empty, 1 too short (<8), then +1 each for 12+ characters, mixed case, and a digit or symbol (max 4). */
export function passwordScore(pw: string): number {
  if (pw.length < 8) return pw ? 1 : 0;
  return Math.min(4, 1 + Number(pw.length >= 12) + Number(/[a-z]/.test(pw) && /[A-Z]/.test(pw)) + Number(/[\d\W_]/.test(pw)));
}
