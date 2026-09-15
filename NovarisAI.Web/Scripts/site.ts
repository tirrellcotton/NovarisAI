import { whenDocumentReady } from "./modules/dom.js";

whenDocumentReady(() => {
    // The application entry point is intentionally module-based so future client features
    // can use explicit imports rather than adding scripts to the global scope.
});
