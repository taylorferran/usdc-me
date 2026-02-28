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
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, handle: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [privateKey, setPrivateKey] = useState<Hex | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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

    // 3. Decrypt private key in browser using password
    const encryptedBlob = (
      typeof profile.encrypted_key_blob === "string"
        ? JSON.parse(profile.encrypted_key_blob)
        : profile.encrypted_key_blob
    ) as EncryptedKeyBlob

    const decryptedKey = (await decryptPrivateKey(encryptedBlob, password)) as Hex

    // 4. Verify the decrypted key matches the stored address
    const derivedAddress = getAddressFromKey(decryptedKey)
    if (derivedAddress.toLowerCase() !== profile.wallet_address?.toLowerCase()) {
      throw new Error("Decryption mismatch — key doesn't match stored address.")
    }

    cacheKey(decryptedKey)
    setPrivateKey(decryptedKey)
    setUser({ handle: profile.handle, address: profile.wallet_address })
  }, [])

  const register = useCallback(
    async (email: string, password: string, handle: string) => {
      // 1. Create Supabase auth user
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw new Error(error.message)
      if (!data.user) throw new Error("Registration failed")

      // 2. Generate wallet key pair in the browser
      const key = generatePrivateKey()
      const address = getAddressFromKey(key)

      // 3. Encrypt private key with user's password (never leaves the browser unencrypted)
      const encryptedKeyBlob = await encryptPrivateKey(key, password)

      // 4. Store profile: handle + wallet address + encrypted key blob
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        handle: handle.toLowerCase().replace(/^@/, ""),
        email,
        wallet_address: address,
        encrypted_key_blob: JSON.stringify(encryptedKeyBlob),
      })
      if (profileError) throw new Error(`Failed to save profile: ${profileError.message}`)

      cacheKey(key)
      setPrivateKey(key)
      setUser({ handle, address })
    },
    []
  )

  const logout = useCallback(async () => {
    clearCachedKey()
    await supabase.auth.signOut()
    setUser(null)
    setPrivateKey(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, privateKey, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
