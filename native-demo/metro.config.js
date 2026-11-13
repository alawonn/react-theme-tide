// Runs the demo against the library's built files in ../dist, the same files
// the npm package ships. Run `npm run build` in the parent folder first.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const library = path.resolve(__dirname, "..");
const config = getDefaultConfig(__dirname);

config.watchFolders = [library];
// The library's own node_modules hold a second React; keep Metro out of it.
config.resolver.blockList = [
  new RegExp(`^${path.join(library, "node_modules").replace(/[/\\.]/g, "\\$&")}/.*`),
];
// With that folder blocked, the library's own imports (React, React Native,
// Skia, Reanimated) fall through to this folder's node_modules, so there's
// only one copy of each.
config.resolver.nodeModulesPaths = [path.join(__dirname, "node_modules")];
config.resolver.extraNodeModules = { "react-theme-tide": library };

module.exports = config;
