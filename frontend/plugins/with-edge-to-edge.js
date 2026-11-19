const { withMainActivity, withAndroidStyles } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to ensure Android Edge-to-Edge is configured natively
 * and persists across any future `npx expo prebuild` or CI builds.
 */
function withEdgeToEdgePlugin(config) {
  // 1. Ensure MainActivity enables WindowCompat.setDecorFitsSystemWindows(window, false)
  config = withMainActivity(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    if (!contents.includes("androidx.core.view.WindowCompat")) {
      contents = contents.replace(
        "import android.os.Bundle",
        "import android.os.Bundle\nimport androidx.core.view.WindowCompat"
      );
    }

    if (!contents.includes("WindowCompat.setDecorFitsSystemWindows")) {
      contents = contents.replace(
        "super.onCreate(null)",
        "WindowCompat.setDecorFitsSystemWindows(window, false)\n    super.onCreate(null)"
      );
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });

  // 2. Ensure styles.xml includes windowDrawsSystemBarBackgrounds
  config = withAndroidStyles(config, (modConfig) => {
    const resources = modConfig.modResults.resources;
    if (resources && resources.style) {
      const appTheme = resources.style.find((s) => s.$.name === "AppTheme");
      if (appTheme && appTheme.item) {
        const hasDrawsSystemBars = appTheme.item.some(
          (item) => item.$.name === "android:windowDrawsSystemBarBackgrounds"
        );
        if (!hasDrawsSystemBars) {
          appTheme.item.push({
            $: { name: "android:windowDrawsSystemBarBackgrounds" },
            _: "true",
          });
        }
      }
    }
    return modConfig;
  });

  return config;
}

module.exports = withEdgeToEdgePlugin;
