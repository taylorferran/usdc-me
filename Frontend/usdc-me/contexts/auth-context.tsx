"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"

import { supabase } from "@/lib/supabase"
import * as api from "@/lib/api"

interface User {
  handle: string
  address: string
}

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, handle: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session on mount and subscribe to auth changes
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("handle, wallet_address")
          .eq("id", session.user.id)
          .single()

        if (profile) {
          setUser({
            handle: profile.handle,
            address: profile.wallet_address ?? "",
          })
        }
      }
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_OUT") {
          setUser(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error("Login failed")

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("handle, wallet_address")
      .eq("id", data.user.id)
      .single()

    if (profileError || !profile) throw new Error("Profile not found")

    setUser({
      handle: profile.handle,
      address: profile.wallet_address ?? "",
    })
  }, [])

  const register = useCallback(
    async (email: string, password: string, handle: string) => {
      // 1. Create Supabase auth user
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw new Error(error.message)
      if (!data.user) throw new Error("Registration failed")

      // 2. Insert profile row with handle + email (wallet_address set after wallet creation)
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({ id: data.user.id, handle, email })
      if (profileError) throw new Error(profileError.message)

      // 3. User is now fully registered — set state immediately so the UI
      //    doesn't treat a wallet creation failure as a registration failure
      setUser({ handle, address: "" })

      // 4. Create wallet on backend and update profile (best-effort)
      try {
        const walletRes = await api.createWallet()
        await supabase
          .from("profiles")
          .update({ wallet_address: walletRes.address })
          .eq("id", data.user.id)
        setUser({ handle, address: walletRes.address })
      } catch {
        // Wallet creation failed — user is still registered and logged in.
        // The wallet will need to be created when the backend comes online.
      }
    },
    []
  )

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
