// Community pages (directory, join, manage) are always routed, but the main
// homepage keeps them unadvertised. The /preview homepage surfaces the teaser +
// nav link so the feature can be exercised before a public launch — security by
// obscurity, no build flag required.
export const PREVIEW_PATH = '/preview';

// Gomry membership application form — new members apply here before an admin
// approves and adds their community profile. Overridable via env.
export const MEMBER_FORM_URL =
  import.meta.env.VITE_MEMBER_FORM_URL ||
  'https://www.gomry.com/form/Italian-Tech-Club-General-application-form-68uJSn7PbLmevuO2T0c5';
