"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import type { Hex } from "viem"

import { supabase } from "@/lib/supabase"
import { generatePrivateKey, getAddressFromKey } from "@/lib/wallet"
import { encryptPrivateKey, decryptPrivateKey, type EncryptedKeyBlob } from "@/lib/crypto"

const SESSION_KEY = "usdc_pk"

function cacheKey(key: Hex) {
  if (typeof window !== "undefined") sessionStorage.setItem(SESSION_KEY, key)
}
function getCachedKey(): Hex | null {
  if (typeof window === "undefined") return null
  return (sessionStorage.getItem(SESSION_KEY) as Hex) ?? null
}
function clearCachedKey() {
  if (typeof window !== "undefined") sessionStorage.removeItem(SESSION_KEY)
}

interface User {
  handle: string
  address: string
}

interface AuthContextValue {
  user: User | null
  privateKey: Hex | null
  isLoading: boolean
  needsRecovery: boolean
  isUnlocked: boolean
  login: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    password: string,
    handle: string,
    recoveryPassword: string
  ) => Promise<void>
  recover: (
    email: string,
    recoveryPassword: string,
    newPassword: string
  ) => Promise<void>
  recoverWithPassword: (
    recoveryPassword: string,
    newPassword: string
  ) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  changeRecoveryPassword: (
    currentRecoveryPassword: string,
    newRecoveryPassword: string
  ) => Promise<void>
  logout: () => Promise<void>
  decryptKey: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [privateKey, setPrivateKey] = useState<Hex | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [needsRecovery, setNeedsRecovery] = useState(false)

  // On mount: restore Supabase session + private key from sessionStorage.
  // sessionStorage survives page refreshes but is cleared when the tab closes.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        setIsLoading(false)
        return
      }

      supabase
        .from("profiles")
        .select("handle, wallet_address")
        .eq("id", session.user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile?.handle && profile?.wallet_address) {
            setUser({ handle: profile.handle, address: profile.wallet_address })
            // Restore decrypted key from sessionStorage if available
            const cached = getCachedKey()
            if (cached) setPrivateKey(cached)
          }
          setIsLoading(false)
        })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_OUT") {
          setUser(null)
          setPrivateKey(null)
          setNeedsRecovery(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    // 1. Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error("Login failed")

    // 2. Fetch encrypted key blob + profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("handle, wallet_address, encrypted_key_blob")
      .eq("id", data.user.id)
      .single()

    if (profileError || !profile) throw new Error("Profile not found. Please sign up first.")

    // 3. Try to decrypt private key with login password
    if (profile.encrypted_key_blob) {
      const encryptedBlob = (
        typeof profile.encrypted_key_blob === "string"
          ? JSON.parse(profile.encrypted_key_blob)
          : profile.encrypted_key_blob
      ) as EncryptedKeyBlob

      try {
        const key = (await decryptPrivateKey(encryptedBlob, password)) as Hex
        const address = getAddressFromKey(key)

        if (address.toLowerCase() !== profile.wallet_address?.toLowerCase()) {
          throw new Error("Decryption mismatch")
        }

        cacheKey(key)
        setPrivateKey(key)
        setNeedsRecovery(false)
        setUser({
          handle: profile.handle,
          address: profile.wallet_address ?? "",
        })
        return
      } catch {
        // Decryption failed — password was likely reset. Enter recovery mode.
        setUser({
          handle: profile.handle,
          address: profile.wallet_address ?? "",
        })
        setNeedsRecovery(true)
        throw new Error("NEEDS_RECOVERY")
      }
    }

    // No encrypted key blob — legacy account without key management
    setUser({
      handle: profile.handle,
      address: profile.wallet_address ?? "",
    })
  }, [])

  const register = useCallback(
    async (
      email: string,
      password: string,
      handle: string,
      recoveryPassword: string
    ) => {
      // 1. Create Supabase auth user
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw new Error(error.message)
      if (!data.user) throw new Error("Registration failed")

      // 2. Generate wallet key pair in the browser
      const key = generatePrivateKey()
      const address = getAddressFromKey(key)

      // 3. Encrypt with login password AND recovery password
      const encryptedKeyBlob = await encryptPrivateKey(key, password)
      const recoveryKeyBlob = await encryptPrivateKey(key, recoveryPassword)

      // 4. Store profile with encrypted blobs
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        handle: handle.toLowerCase().replace(/^@/, ""),
        email,
        wallet_address: address,
        encrypted_key_blob: JSON.stringify(encryptedKeyBlob),
        recovery_key_blob: JSON.stringify(recoveryKeyBlob),
      })
      if (profileError) throw new Error(`Failed to save profile: ${profileError.message}`)

      cacheKey(key)
      setPrivateKey(key)
      setNeedsRecovery(false)
      setUser({ handle, address })
    },
    []
  )

  // Recovery when already authenticated (post-login decryption failure)
  const recoverWithPassword = useCallback(
    async (recoveryPassword: string, newPassword: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user)
        throw new Error("Not authenticated. Please log in first.")

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("wallet_address, recovery_key_blob, handle")
        .eq("id", session.user.id)
        .single()

      if (profileError || !profile) throw new Error("Profile not found.")
      if (!profile.recovery_key_blob)
        throw new Error("No recovery key found for this account.")

      const recoveryBlob = (
        typeof profile.recovery_key_blob === "string"
          ? JSON.parse(profile.recovery_key_blob)
          : profile.recovery_key_blob
      ) as EncryptedKeyBlob

      let key: Hex
      try {
        key = (await decryptPrivateKey(recoveryBlob, recoveryPassword)) as Hex
      } catch {
        throw new Error("Invalid recovery password.")
      }

      const address = getAddressFromKey(key)
      if (address.toLowerCase() !== profile.wallet_address?.toLowerCase()) {
        throw new Error("Recovery decryption mismatch.")
      }

      // Re-encrypt with new password
      const newEncryptedBlob = await encryptPrivateKey(key, newPassword)
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ encrypted_key_blob: JSON.stringify(newEncryptedBlob) })
        .eq("id", session.user.id)
      if (updateError) throw new Error(`Failed to update key: ${updateError.message}`)

      // Update Supabase auth password
      const { error: pwError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (pwError)
        throw new Error(`Failed to update password: ${pwError.message}`)

      cacheKey(key)
      setPrivateKey(key)
      setNeedsRecovery(false)
      setUser({
        handle: profile.handle || "",
        address: profile.wallet_address ?? "",
      })
    },
    []
  )

  // Recovery when NOT authenticated (forgot password entirely)
  const recover = useCallback(
    async (
      email: string,
      recoveryPassword: string,
      newPassword: string
    ) => {
      // 1. Fetch recovery blob from backend (no auth needed)
      const startRes = await fetch("/api/recover/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const startData = await startRes.json()
      if (!startRes.ok) throw new Error(startData.error || "Recovery failed")

      // 2. Decrypt with recovery password (client-side)
      const recoveryBlob = (
        typeof startData.recovery_key_blob === "string"
          ? JSON.parse(startData.recovery_key_blob)
          : startData.recovery_key_blob
      ) as EncryptedKeyBlob

      let key: Hex
      try {
        key = (await decryptPrivateKey(recoveryBlob, recoveryPassword)) as Hex
      } catch {
        throw new Error("Invalid recovery password.")
      }

      const address = getAddressFromKey(key)
      if (address.toLowerCase() !== startData.wallet_address?.toLowerCase()) {
        throw new Error("Recovery decryption mismatch.")
      }

      // 3. Re-encrypt with new password
      const newEncryptedBlob = await encryptPrivateKey(key, newPassword)

      // 4. Complete recovery via backend
      const completeRes = await fetch("/api/recover/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          newPassword,
          newEncryptedKeyBlob: JSON.stringify(newEncryptedBlob),
        }),
      })
      const completeData = await completeRes.json()
      if (!completeRes.ok)
        throw new Error(completeData.error || "Recovery completion failed")

      // 5. Log in with new credentials
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: newPassword,
      })
      if (authError) throw new Error(authError.message)

      // 6. Fetch handle
      const {
        data: { session },
      } = await supabase.auth.getSession()
      let handle = ""
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("handle")
          .eq("id", session.user.id)
          .single()
        handle = profile?.handle || ""
      }

      cacheKey(key)
      setPrivateKey(key)
      setNeedsRecovery(false)
      setUser({ handle, address })
    },
    []
  )

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!privateKey) throw new Error("Wallet not unlocked.")

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) throw new Error("Not authenticated.")

      // Verify current password by trying to decrypt
      const { data: profile } = await supabase
        .from("profiles")
        .select("encrypted_key_blob")
        .eq("id", session.user.id)
        .single()

      if (profile?.encrypted_key_blob) {
        const blob = (
          typeof profile.encrypted_key_blob === "string"
            ? JSON.parse(profile.encrypted_key_blob)
            : profile.encrypted_key_blob
        ) as EncryptedKeyBlob
        try {
          await decryptPrivateKey(blob, currentPassword)
        } catch {
          throw new Error("Current password is incorrect.")
        }
      }

      // Re-encrypt with new password
      const newBlob = await encryptPrivateKey(privateKey, newPassword)
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ encrypted_key_blob: JSON.stringify(newBlob) })
        .eq("id", session.user.id)
      if (updateError) throw new Error(`Failed to update: ${updateError.message}`)

      // Update Supabase auth password
      const { error: pwError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (pwError) throw new Error(`Failed to update password: ${pwError.message}`)
    },
    [privateKey]
  )

  const changeRecoveryPassword = useCallback(
    async (currentRecoveryPassword: string, newRecoveryPassword: string) => {
      if (!privateKey) throw new Error("Wallet not unlocked.")

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) throw new Error("Not authenticated.")

      // Verify current recovery password by trying to decrypt
      const { data: profile } = await supabase
        .from("profiles")
        .select("recovery_key_blob")
        .eq("id", session.user.id)
        .single()

      if (profile?.recovery_key_blob) {
        const blob = (
          typeof profile.recovery_key_blob === "string"
            ? JSON.parse(profile.recovery_key_blob)
            : profile.recovery_key_blob
        ) as EncryptedKeyBlob
        try {
          await decryptPrivateKey(blob, currentRecoveryPassword)
        } catch {
          throw new Error("Current recovery password is incorrect.")
        }
      }

      // Re-encrypt with new recovery password
      const newBlob = await encryptPrivateKey(privateKey, newRecoveryPassword)
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ recovery_key_blob: JSON.stringify(newBlob) })
        .eq("id", session.user.id)
      if (updateError) throw new Error(`Failed to update: ${updateError.message}`)
    },
    [privateKey]
  )

  // Decrypt the private key on demand (for scenarios where sessionStorage was cleared)
  const decryptKey = useCallback(async (password: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) throw new Error("Not logged in")

    const { data: profile } = await supabase
      .from("profiles")
      .select("encrypted_key_blob, wallet_address")
      .eq("id", session.user.id)
      .single()

    if (!profile?.encrypted_key_blob) throw new Error("No encrypted key found")

    const blob: EncryptedKeyBlob =
      typeof profile.encrypted_key_blob === "string"
        ? JSON.parse(profile.encrypted_key_blob)
        : profile.encrypted_key_blob
    const decryptedKey = (await decryptPrivateKey(blob, password)) as Hex

    // Verify address match
    const derivedAddress = getAddressFromKey(decryptedKey)
    if (derivedAddress.toLowerCase() !== profile.wallet_address?.toLowerCase()) {
      throw new Error("Decryption mismatch — key doesn't match stored address.")
    }

    cacheKey(decryptedKey)
    setPrivateKey(decryptedKey)
  }, [])

  const logout = useCallback(async () => {
    clearCachedKey()
    await supabase.auth.signOut()
    setUser(null)
    setPrivateKey(null)
    setNeedsRecovery(false)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        privateKey,
        isLoading,
        needsRecovery,
        isUnlocked: privateKey !== null,
        login,
        register,
        recover,
        recoverWithPassword,
        changePassword,
        changeRecoveryPassword,
        logout,
        decryptKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
