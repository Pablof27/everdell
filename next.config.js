/** @type {import('next').NextConfig} */
module.exports = {
  webpack(config, { dev }) {
    if (dev) {
      // Dev wraps modules in eval(): sloppy-mode lodash then does dynamic scope
      // lookups, making the engine (e.g. the bot arena) ~9x slower.
      config.module.rules.push({
        test: /[\\/]node_modules[\\/]lodash[\\/]/,
        parser: { overrideStrict: "strict" },
      });
    }
    return config;
  },
};
