import { ResetPasswordForm } from "wasp/client/auth";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { AuthPageLayout } from "../AuthPageLayout";
export function PasswordResetPage() {
    return (<AuthPageLayout>
      <ResetPasswordForm />
      <br />
      <span className="text-muted-foreground text-sm font-medium">
        If everything is okay,{" "}
        <WaspRouterLink to={routes.LoginRoute.to} className="text-primary underline underline-offset-2">go to login</WaspRouterLink>
      </span>
    </AuthPageLayout>);
}
//# sourceMappingURL=PasswordResetPage.jsx.map