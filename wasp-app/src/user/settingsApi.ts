import { getUserSettings, updateUserSettings } from "wasp/client/operations";

export type UserSettingsInput = {
  displayName?: string;
  timezone?: string;
  language?: string;
  region?: "IN" | "PK" | "OTHER";
};

export const settingsApi = {
  get: () => getUserSettings(),
  update: (input: UserSettingsInput) => updateUserSettings(input),
};
