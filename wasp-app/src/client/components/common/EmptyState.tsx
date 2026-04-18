import React from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '../ui/card';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  actionRoute?: string;
  icon?: React.ReactNode;
}

/**
 * Empty state display when no scans exist
 */
export function EmptyState({
  title = 'No scans yet',
  description = 'Submit your first scan to see results here',
  actionLabel = 'Create First Scan',
  actionRoute = '/new-scan',
  icon,
}: EmptyStateProps) {
  const navigate = useNavigate();

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="py-12 text-center">
        {icon && <div className="flex justify-center mb-4 text-muted-foreground text-4xl">{icon}</div>}
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm mb-6">{description}</p>
        <button
          onClick={() => navigate(actionRoute)}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition font-medium text-sm"
        >
          {actionLabel}
        </button>
      </CardContent>
    </Card>
  );
}
