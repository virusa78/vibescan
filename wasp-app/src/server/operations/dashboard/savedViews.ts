import { HttpError, prisma } from 'wasp/server';
import { randomUUID } from 'crypto';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';

const MAX_SAVED_VIEWS = 20;

const savedViewConfigSchema = z.object({
  sortField: z.enum(['submitted', 'target', 'type', 'status', 'findings']),
  sortDirection: z.enum(['asc', 'desc']),
  statuses: z.array(z.enum(['pending', 'scanning', 'done', 'error', 'cancelled'])).max(5),
  query: z.string().trim().max(120).default(''),
});

const createSavedViewInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
  config: savedViewConfigSchema,
});

const updateSavedViewInputSchema = z.object({
  viewId: z.string().uuid(),
  name: z.string().trim().min(1).max(64).optional(),
  config: savedViewConfigSchema.optional(),
});

const deleteSavedViewInputSchema = z.object({
  viewId: z.string().uuid(),
});

export type SavedViewConfig = z.infer<typeof savedViewConfigSchema>;

export interface ScanSavedView extends SavedViewConfig {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

type UserUiPreferences = {
  scanSavedViews: ScanSavedView[];
  [key: string]: unknown;
};

function parsePreferences(raw: unknown): UserUiPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { scanSavedViews: [] };
  }

  const obj = raw as Record<string, unknown>;
  const rawViews = obj.scanSavedViews;
  if (!Array.isArray(rawViews)) {
    return { ...(obj as UserUiPreferences), scanSavedViews: [] };
  }

  const normalized = rawViews
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    .map((item): ScanSavedView | null => {
      const parsedConfig = savedViewConfigSchema.safeParse({
        sortField: item.sortField,
        sortDirection: item.sortDirection,
        statuses: item.statuses,
        query: item.query,
      });

      if (!parsedConfig.success) {
        return null;
      }

      if (typeof item.id !== 'string' || typeof item.name !== 'string') {
        return null;
      }

      const createdAt = typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString();
      const updatedAt = typeof item.updatedAt === 'string' ? item.updatedAt : createdAt;

      return {
        id: item.id,
        name: item.name,
        createdAt,
        updatedAt,
        ...parsedConfig.data,
      };
    })
    .filter((item): item is ScanSavedView => item !== null)
    .slice(0, MAX_SAVED_VIEWS);

  return {
    ...(obj as UserUiPreferences),
    scanSavedViews: normalized,
  };
}

async function readPreferencesForUser(userId: string): Promise<UserUiPreferences> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { uiPreferences: true },
  });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  return parsePreferences(user.uiPreferences);
}

async function writePreferencesForUser(userId: string, preferences: UserUiPreferences): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      uiPreferences: preferences as unknown as object,
    },
  });
}

function ensureUser(context: any): { id: string } {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  return context.user;
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function hasDuplicateName(views: ScanSavedView[], name: string, excludeId?: string): boolean {
  const normalized = name.toLowerCase();
  return views.some((view) => view.id !== excludeId && view.name.toLowerCase() === normalized);
}

export async function listScanSavedViews(_rawArgs: unknown, context: any): Promise<{ views: ScanSavedView[] }> {
  const user = ensureUser(context);
  const preferences = await readPreferencesForUser(user.id);
  return { views: preferences.scanSavedViews };
}

export async function createScanSavedView(rawArgs: unknown, context: any): Promise<{ view: ScanSavedView }> {
  const user = ensureUser(context);
  const args = ensureArgsSchemaOrThrowHttpError(createSavedViewInputSchema, rawArgs);
  const preferences = await readPreferencesForUser(user.id);
  const views = preferences.scanSavedViews;

  if (views.length >= MAX_SAVED_VIEWS) {
    throw new HttpError(422, `Cannot save more than ${MAX_SAVED_VIEWS} views`, {
      error: 'validation_error',
      validation_errors: [{ field: 'name', message: 'saved_views_limit_reached' }],
    });
  }

  const name = normalizeName(args.name);
  if (hasDuplicateName(views, name)) {
    throw new HttpError(422, 'Saved view name already exists', {
      error: 'validation_error',
      validation_errors: [{ field: 'name', message: 'duplicate_name' }],
    });
  }

  const now = new Date().toISOString();
  const view: ScanSavedView = {
    id: randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    ...args.config,
  };

  const nextPreferences: UserUiPreferences = {
    ...preferences,
    scanSavedViews: [view, ...views],
  };

  await writePreferencesForUser(user.id, nextPreferences);
  return { view };
}

export async function updateScanSavedView(rawArgs: unknown, context: any): Promise<{ view: ScanSavedView }> {
  const user = ensureUser(context);
  const args = ensureArgsSchemaOrThrowHttpError(updateSavedViewInputSchema, rawArgs);
  const preferences = await readPreferencesForUser(user.id);
  const existing = preferences.scanSavedViews.find((view) => view.id === args.viewId);

  if (!existing) {
    throw new HttpError(404, 'Saved view not found');
  }

  const nextName = args.name ? normalizeName(args.name) : existing.name;
  if (hasDuplicateName(preferences.scanSavedViews, nextName, existing.id)) {
    throw new HttpError(422, 'Saved view name already exists', {
      error: 'validation_error',
      validation_errors: [{ field: 'name', message: 'duplicate_name' }],
    });
  }

  const nextView: ScanSavedView = {
    ...existing,
    ...(args.config ?? {}),
    name: nextName,
    updatedAt: new Date().toISOString(),
  };

  const nextPreferences: UserUiPreferences = {
    ...preferences,
    scanSavedViews: preferences.scanSavedViews.map((view) => (view.id === existing.id ? nextView : view)),
  };

  await writePreferencesForUser(user.id, nextPreferences);
  return { view: nextView };
}

export async function deleteScanSavedView(rawArgs: unknown, context: any): Promise<{ success: true }> {
  const user = ensureUser(context);
  const args = ensureArgsSchemaOrThrowHttpError(deleteSavedViewInputSchema, rawArgs);
  const preferences = await readPreferencesForUser(user.id);

  const nextViews = preferences.scanSavedViews.filter((view) => view.id !== args.viewId);
  if (nextViews.length === preferences.scanSavedViews.length) {
    throw new HttpError(404, 'Saved view not found');
  }

  await writePreferencesForUser(user.id, {
    ...preferences,
    scanSavedViews: nextViews,
  });

  return { success: true };
}
