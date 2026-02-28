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
  needsRecovery: boolean;
}

interface WalletContextType extends WalletState {
  signup: (
    email: string,
    password: string,
    handle: string,
    recoveryPassword: string
  ) => Promise<{ address: Address }>;
  login: (email: string, password: string) => Promise<{ address: Address }>;
  recoverWithPassword: (
    recoveryPassword: string,
    newPassword: string
  ) => Promise<{ address: Address }>;
  recover: (
    email: string,
    recoveryPassword: string,
    newPassword: string
  ) => Promise<{ address: Address }>;
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
    needsRecovery: false,
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

  const signup = useCallback(async (email: string, password: string, handle: string, recoveryPassword: string) => {
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

    // 3. Encrypt with login password AND recovery password
    const encryptedKeyBlob = await encryptPrivateKey(privateKey, password);
    const recoveryKeyBlob = await encryptPrivateKey(privateKey, recoveryPassword);

    // 4. Store wallet data in profiles table
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      wallet_address: address,
      encrypted_key_blob: JSON.stringify(encryptedKeyBlob),
      recovery_key_blob: JSON.stringify(recoveryKeyBlob),
      handle: handle.toLowerCase().replace(/^@/, ""),
    });

    if (profileError) throw new Error(`Failed to save profile: ${profileError.message}`);

    setState({ privateKey, address, email, handle, loading: false, needsRecovery: false });
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

    // 3. Try to decrypt key with login password
    const encryptedBlob = (
      typeof profile.encrypted_key_blob === "string"
        ? JSON.parse(profile.encrypted_key_blob)
        : profile.encrypted_key_blob
    ) as EncryptedKeyBlob;

    try {
      const privateKey = (await decryptPrivateKey(encryptedBlob, password)) as Hex;
      const address = getAddressFromKey(privateKey);

      if (address.toLowerCase() !== profile.wallet_address.toLowerCase()) {
        throw new Error("Decryption mismatch");
      }

      setState({ privateKey, address, email, handle: profile.handle || null, loading: false, needsRecovery: false });
      return { address };
    } catch {
      // Decryption failed — password was likely reset via Supabase.
      // User is authenticated but we can't decrypt the key. Enter recovery mode.
      setState((prev) => ({
        ...prev,
        email,
        handle: profile.handle || null,
        loading: false,
        needsRecovery: true,
      }));
      throw new Error("NEEDS_RECOVERY");
    }
  }, []);

  const recoverWithPassword = useCallback(async (recoveryPassword: string, newPassword: string) => {
    // User must already be signed into Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("Not authenticated. Please log in first.");

    // 1. Fetch recovery blob from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("wallet_address, recovery_key_blob, handle")
      .eq("id", session.user.id)
      .single();

    if (profileError || !profile) throw new Error("Profile not found.");
    if (!profile.recovery_key_blob) throw new Error("No recovery key found. Recovery is not available for this account.");

    // 2. Decrypt with recovery password
    const recoveryBlob = (
      typeof profile.recovery_key_blob === "string"
        ? JSON.parse(profile.recovery_key_blob)
        : profile.recovery_key_blob
    ) as EncryptedKeyBlob;

    let privateKey: Hex;
    try {
      privateKey = (await decryptPrivateKey(recoveryBlob, recoveryPassword)) as Hex;
    } catch {
      throw new Error("Invalid recovery password.");
    }

    const address = getAddressFromKey(privateKey);

    // 3. Verify address matches stored address
    if (address.toLowerCase() !== profile.wallet_address.toLowerCase()) {
      throw new Error("Recovery decryption mismatch — key doesn't match stored address.");
    }

    // 4. Re-encrypt with new password and update Supabase
    const newEncryptedBlob = await encryptPrivateKey(privateKey, newPassword);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ encrypted_key_blob: JSON.stringify(newEncryptedBlob) })
      .eq("id", session.user.id);

    if (updateError) throw new Error(`Failed to update key: ${updateError.message}`);

    // 5. Update Supabase auth password to match
    const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
    if (pwError) throw new Error(`Failed to update password: ${pwError.message}`);

    // 6. Unlock wallet
    setState({
      privateKey,
      address,
      email: session.user.email || null,
      handle: profile.handle || null,
      loading: false,
      needsRecovery: false,
    });
    return { address };
  }, []);

  const API_URL = "http://localhost:3001/api";

  const recover = useCallback(async (email: string, recoveryPassword: string, newPassword: string) => {
    // 1. Fetch recovery blob from backend (no auth needed — backend uses service role)
    const startRes = await fetch(`${API_URL}/recover/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const startData = await startRes.json();
    if (!startRes.ok) throw new Error(startData.error || "Recovery failed");

    // 2. Decrypt with recovery password (client-side only)
    const recoveryBlob = (
      typeof startData.recovery_key_blob === "string"
        ? JSON.parse(startData.recovery_key_blob)
        : startData.recovery_key_blob
    ) as EncryptedKeyBlob;

    let privateKey: Hex;
    try {
      privateKey = (await decryptPrivateKey(recoveryBlob, recoveryPassword)) as Hex;
    } catch {
      throw new Error("Invalid recovery password.");
    }

    const address = getAddressFromKey(privateKey);

    // 3. Verify address matches what's stored
    if (address.toLowerCase() !== startData.wallet_address.toLowerCase()) {
      throw new Error("Recovery decryption mismatch — key doesn't match stored address.");
    }

    // 4. Re-encrypt with new password
    const newEncryptedBlob = await encryptPrivateKey(privateKey, newPassword);

    // 5. Send new blob + new password to backend to complete recovery
    const completeRes = await fetch(`${API_URL}/recover/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        newPassword,
        newEncryptedKeyBlob: JSON.stringify(newEncryptedBlob),
      }),
    });
    const completeData = await completeRes.json();
    if (!completeRes.ok) throw new Error(completeData.error || "Recovery completion failed");

    // 6. Log in with new credentials
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: newPassword,
    });
    if (authError) throw new Error(authError.message);

    // 7. Fetch handle from profile
    const { data: { session } } = await supabase.auth.getSession();
    let handle: string | null = null;
    if (session?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", session.user.id)
        .single();
      handle = profile?.handle || null;
    }

    setState({ privateKey, address, email, handle, loading: false, needsRecovery: false });
    return { address };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ privateKey: null, address: null, email: null, handle: null, loading: false, needsRecovery: false });
  }, []);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        signup,
        login,
        recoverWithPassword,
        recover,
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
