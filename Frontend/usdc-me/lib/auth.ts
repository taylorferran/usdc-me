// Auth is now handled entirely by Supabase Auth via lib/supabase.ts.
// Session tokens (JWTs) are managed by the Supabase client automatically.
// The AuthContext (contexts/auth-context.tsx) is the single source of truth
// for user state (handle, wallet_address).
//
// This file is kept as a no-op shim so any legacy imports don't break at compile time.

export function getJwt(): string | null { return null }
export function setJwt(_jwt: string): void {}
export function clearJwt(): void {}
export function getHandle(): string | null { return null }
export function setHandle(_handle: string): void {}
export function getAddress(): string | null { return null }
export function setAddress(_address: string): void {}
export function clearSession(): void {}
