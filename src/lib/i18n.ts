export const i18n = {
  getMessage(key: string, defaultValue = ''): string {
    return chrome?.i18n.getMessage(key) ?? defaultValue;
  },
};
