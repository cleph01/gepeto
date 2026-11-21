// Sentry's wrapper around Expo's default Metro config: adds debug IDs so
// production stack traces can be matched to uploaded source maps.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
