import { LoginForm } from "wasp/client/auth";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { AuthPageLayout } from "./AuthPageLayout";
import { useRedirectIfLoggedIn } from "./hooks/useRedirectIfLoggedIn";

export default function Login() {
  useRedirectIfLoggedIn();

  return (
    <AuthPageLayout>
      <LoginForm />
      <br />
      <span className="text-muted-foreground text-sm font-medium">
        Don't have an account yet?{" "}
        <WaspRouterLink to={routes.SignupRoute.to} className="text-primary underline underline-offset-2">
          go to signup
        </WaspRouterLink>
        .
      </span>
      <br />
      <span className="text-muted-foreground text-sm font-medium">
        Forgot your password?{" "}
        <WaspRouterLink
          to={routes.RequestPasswordResetRoute.to}
          className="text-primary underline underline-offset-2"
        >
          reset it
        </WaspRouterLink>
        .
      </span>
    </AuthPageLayout>
  );
}
