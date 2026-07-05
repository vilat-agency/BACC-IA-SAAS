import { GraduationCap, Loader2, Lock, Mail, User as UserIcon } from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#e5e7eb] font-sans px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="w-12 h-12 bg-[#3b82f6] rounded-lg flex items-center justify-center text-white font-bold text-2xl">
            B
          </div>
          <h1 className="text-lg font-bold text-gray-900">Bac IA</h1>
          <p className="text-xs text-gray-500 text-center">
            Connecte-toi pour retrouver tes copies et ton historique.
          </p>
        </div>

        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 text-xs font-bold py-2 rounded-md transition-colors ${mode === "login" ? "bg-white shadow-sm text-blue-600" : "text-gray-500"}`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(""); }}
            className={`flex-1 text-xs font-bold py-2 rounded-md transition-colors ${mode === "register" ? "bg-white shadow-sm text-blue-600" : "text-gray-500"}`}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "register" && (
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 focus-within:ring-1 focus-within:ring-blue-400">
              <UserIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                required
                placeholder="Nom complet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent text-sm outline-none text-gray-700"
              />
            </div>
          )}

          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 focus-within:ring-1 focus-within:ring-blue-400">
            <Mail className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="email"
              required
              placeholder="Adresse email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent text-sm outline-none text-gray-700"
            />
          </div>

          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 focus-within:ring-1 focus-within:ring-blue-400">
            <Lock className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Mot de passe (6 caractères min.)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent text-sm outline-none text-gray-700"
            />
          </div>

          {error && (
            <div className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg p-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GraduationCap className="h-4 w-4" />
            )}
            {mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>
      </div>
    </div>
  );
}
