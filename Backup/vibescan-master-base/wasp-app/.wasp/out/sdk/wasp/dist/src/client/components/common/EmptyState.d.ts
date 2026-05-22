import React from 'react';
interface EmptyStateProps {
    title?: string;
    description?: string;
    actionLabel?: string;
    actionRoute?: string;
    secondaryActionLabel?: string;
    secondaryActionRoute?: string;
    icon?: React.ReactNode;
}
/**
 * Empty state display when no scans exist
 */
export declare function EmptyState({ title, description, actionLabel, actionRoute, secondaryActionLabel, secondaryActionRoute, icon, }: EmptyStateProps): React.JSX.Element;
export {};
//# sourceMappingURL=EmptyState.d.ts.map