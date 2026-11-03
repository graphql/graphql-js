import { enableDevInstanceOf } from "./jsutils/instanceOf.mjs";
let devMode = false;
export function enableDevMode() {
    devMode = true;
    enableDevInstanceOf();
}
export function isDevModeEnabled() {
    return devMode;
}
//# sourceMappingURL=devMode.mjs.map