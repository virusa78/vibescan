import { useState, FormEvent } from "react";
import { signup } from "wasp/client/auth";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { AuthPageLayout } from "./AuthPageLayout";
import { useRedirectIfLoggedIn } from "./hooks/useRedirectIfLoggedIn";
import { Eye, EyeOff } from "lucide-react";

export function Signup() {
  useRedirectIfLoggedIn();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) {
      setError("Email is required");
      setIsLoading(false);
      return;
    }
    if (!trimmedPassword) {
      setError("Password is required");
      setIsLoading(false);
      return;
    }

    try {
      await signup({
        email: trimmedEmail,
        password: trimmedPassword,
        username: trimmedEmail,
        isAdmin: false
      });
      setSuccess("You've signed up successfully! Check your email for the confirmation link.");
      setEmail("");
      setPassword("");
    } catch (err: any) {
      const errMsg = err.data?.data?.message || err.message || "An error occurred during signup";
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordVisibility = (visible: boolean) => {
    setShowPassword(visible);
  };

  return (
    <AuthPageLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold text-white text-center">Create a new account</h2>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-success/10 border border-success/20 text-success text-sm rounded-lg p-3 font-medium">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-300">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-success/50 focus:ring-2 focus:ring-success/20 disabled:opacity-50 transition-all"
              placeholder="your.email@example.com"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-300">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                className="w-full pl-3 pr-10 py-2 bg-slate-950/80 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-success/50 focus:ring-2 focus:ring-success/20 disabled:opacity-50 transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handlePasswordVisibility(true);
                }}
                onMouseUp={() => handlePasswordVisibility(false)}
                onMouseLeave={() => handlePasswordVisibility(false)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handlePasswordVisibility(true);
                }}
                onTouchEnd={() => handlePasswordVisibility(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-success hover:bg-success/90 disabled:opacity-50 text-success-foreground font-semibold rounded-lg shadow-lg hover:shadow-success/20 transition-all cursor-pointer flex justify-center items-center"
          >
            {isLoading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <div className="flex flex-col gap-2 border-t border-slate-800 pt-4">
          <span className="text-slate-400 text-sm font-medium text-center">
            I already have an account ({" "}
            <WaspRouterLink to={routes.LoginRoute.to} className="text-primary hover:underline underline-offset-2 transition-all">
              go to login
            </WaspRouterLink>
            ).
          </span>
        </div>
      </div>
    </AuthPageLayout>
  );
}
