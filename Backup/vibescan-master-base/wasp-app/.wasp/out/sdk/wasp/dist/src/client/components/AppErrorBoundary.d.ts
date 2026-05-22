import React from 'react';
import { type AppLocale } from '../i18n';
type AppErrorBoundaryProps = {
    children: React.ReactNode;
    locale: AppLocale;
};
type AppErrorBoundaryState = {
    hasError: boolean;
    error: Error | null;
};
export declare class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
    constructor(props: AppErrorBoundaryProps);
    static getDerivedStateFromError(error: Error): AppErrorBoundaryState;
    componentDidCatch(error: Error, info: React.ErrorInfo): void;
    handleReload: () => void;
    handleReport: () => void;
    render(): string | number | bigint | boolean | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | React.JSX.Element | null | undefined;
}
export {};
//# sourceMappingURL=AppErrorBoundary.d.ts.map