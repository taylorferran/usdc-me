import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { Hex, Address } from "viem";
import { generatePrivateKey, getAddressFromKey } from "../lib/wallet";
import {
  encryptPrivateKey,
  decryptPrivateKey,
  type EncryptedKeyBlob,
} from "../lib/crypto";
import { supabase } from "../lib/supabase";

interface WalletState {
  privateKey: Hex | null;
  address: Address | null;
  email: string | null;
  handle: string | null;
  loading: boolean;
}

interface WalletContextType extends WalletState {
  signup: (
    email: string,
    password: string,
    handle: string
  ) => Promise<{ address: Address }>;
  login: (email: string, password: string) => Promise<{ address: Address }>;
  logout: () => void;
  isUnlocked: boolean;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    privateKey: null,
    address: null,
    email: null,
    handle: null,
    loading: true,
  });

  // Check for existing Supabase session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // User has a session but we don't have the decrypted key.
        // They need to "login" again to decrypt. Just mark as not loading.
        setState((prev) => ({ ...prev, loading: false }));
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    });
  }, []);

  const signup = useCallback(async (email: string, password: string, handle: string) => {
    // 1. Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("Signup failed — no user returned");

    // 2. Generate key in browser
    const privateKey = generatePrivateKey();
    const address = getAddressFromKey(privateKey);

    // 3. Encrypt with password
    const encryptedKeyBlob = await encryptPrivateKey(privateKey, password);

    // 4. Store wallet data in profiles table (encrypted_key_blob is text, so stringify)
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      wallet_address: address,
      encrypted_key_blob: JSON.stringify(encryptedKeyBlob),
      handle: handle.toLowerCase().replace(/^@/, ""),
    });

    if (profileError) throw new Error(`Failed to save profile: ${profileError.message}`);

    setState({ privateKey, address, email, handle, loading: false });
    return { address };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // 1. Sign in with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("Login failed — no user returned");

    // 2. Fetch encrypted key blob + handle from profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("wallet_address, encrypted_key_blob, handle")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found. Please sign up first.");
    }

    // 3. Decrypt key in browser (encrypted_key_blob is stored as text, so parse it)
    const encryptedBlob = (
      typeof profile.encrypted_key_blob === "string"
        ? JSON.parse(profile.encrypted_key_blob)
        : profile.encrypted_key_blob
    ) as EncryptedKeyBlob;
    const privateKey = (await decryptPrivateKey(encryptedBlob, password)) as Hex;
    const address = getAddressFromKey(privateKey);

    // 4. Verify address matches what's stored
    if (address.toLowerCase() !== profile.wallet_address.toLowerCase()) {
      throw new Error("Decryption mismatch — key doesn't match stored address.");
    }

    setState({ privateKey, address, email, handle: profile.handle || null, loading: false });
    return { address };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ privateKey: null, address: null, email: null, handle: null, loading: false });
  }, []);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        signup,
        login,
        logout,
        isUnlocked: state.privateKey !== null,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
