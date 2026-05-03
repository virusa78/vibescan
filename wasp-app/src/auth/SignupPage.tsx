import { SignupForm } from "wasp/client/auth";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { AuthPageLayout } from "./AuthPageLayout";
import { useRedirectIfLoggedIn } from "./hooks/useRedirectIfLoggedIn";

export function Signup() {
  useRedirectIfLoggedIn();

  return (
    <AuthPageLayout>
      <SignupForm />
      <br />
      <span className="text-muted-foreground text-sm font-medium">
        I already have an account (
        <WaspRouterLink to={routes.LoginRoute.to} className="text-primary underline underline-offset-2">
          go to login
        </WaspRouterLink>
        ).
      </span>
      <br />
    </AuthPageLayout>
  );
}
